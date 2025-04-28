import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnDestroy,
    OnInit,
    Self,
    ViewChild
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort, SortDirection, MatSortHeader, Sort } from '@angular/material/sort';
import {
    MatTableDataSource,
    MatTable,
    MatColumnDef,
    MatHeaderCellDef,
    MatHeaderCell,
    MatCellDef,
    MatCell,
    MatHeaderRowDef,
    MatHeaderRow,
    MatRowDef,
    MatRow
} from '@angular/material/table';
import { MatMenuTrigger, MatMenu, MatMenuItem } from '@angular/material/menu';
import { RouterLink } from '@angular/router';
import { MatTooltip } from '@angular/material/tooltip';
import { MatIcon } from '@angular/material/icon';
import { MatIconButton, MatButton } from '@angular/material/button';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatInput } from '@angular/material/input';
import { MatFormField, MatSuffix } from '@angular/material/form-field';
import { AsyncPipe, DatePipe } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { filter, map, switchMap, takeUntil, tap } from 'rxjs/operators';
import { BehaviorSubject, combineLatest, of, Subject } from 'rxjs';
import { compare } from '../../../shared/functions/compare';
import { repeat } from '../../../shared/functions/repeat';
import { NotificationService } from '../../../core/services/notification.service';
import { BadRequestError, Collection, OrderDirection } from '../../../protocol/data-protocol';
import { HermesTeamService } from '../../../protocol/team-protocol.service';
import { AccountService } from '../../../core/services/account.service';
import { PersonnelAccount, Team } from '../../../protocol/db-protocol';
import { TeamEditDialogComponent } from '../team-edit-dialog/team-edit-dialog.component';
import { HermesEmployeeService } from '../../../protocol/web-employee-protocol.service';
import { HermesProjectService } from '../../../protocol/project-protocol.service';
import { PersonnelAccountOrderBy, TeamError } from '../../../protocol/web-protocol';
import { SelectedDateService } from '../../../core/services/selected-date.service';
import { simplifyTitle } from '../../../shared/functions/simplify-title';
import { StorageService } from '../../../core/services/storage.service';
import { TeamManagerDialogComponent } from '../team-manager-dialog/team-manager-dialog.component';
import { CacheService } from '../../../core/services/cache.service';
import { LoadingIndicatorComponent } from '../../../components/loading-indicator/loading-indicator.component';
import { ScrollTopComponent } from '../../../components/scroll-top/scroll-top.component';
import { ConfirmationDirective } from '../../../components/confirmation/confirmation.directive';
import { TooltipAutoHideDirective } from '../../../shared/directives/tooltip-auto-hide.directive';
import { FilterService } from '../../../core/services/filter.service';

enum Column {
    Id = 'id',
    Title = 'title',
    CreatedByName = 'createdByName',
    CreatedAt = 'createdAt',
    UpdatedAt = 'updatedAt',
    Actions = 'actions',
    MemberCount = '$memberCount' // Column doesn't present in the Team entity
}

const DEFAULT_ORDER_BY = Column.Id;
const DEFAULT_ORDER_DIR: SortDirection = 'asc';
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_COLUMNS = [
    Column.Id,
    Column.Title,
    // Column.MemberCount,
    Column.CreatedByName,
    Column.CreatedAt,
    Column.UpdatedAt,
    Column.Actions
];

@Component({
    selector: 'app-teams',
    templateUrl: './teams.component.html',
    styleUrls: ['./teams.component.scss'],
    standalone: true,
    imports: [
        MatFormField,
        MatInput,
        FormsModule,
        MatIconButton,
        MatSuffix,
        MatIcon,
        MatTooltip,
        MatButton,
        MatTable,
        MatSort,
        MatColumnDef,
        MatHeaderCellDef,
        MatHeaderCell,
        MatSortHeader,
        MatCellDef,
        MatCell,
        RouterLink,
        MatMenuTrigger,
        MatMenu,
        MatMenuItem,
        MatHeaderRowDef,
        MatHeaderRow,
        MatRowDef,
        MatRow,
        LoadingIndicatorComponent,
        MatPaginator,
        AsyncPipe,
        DatePipe,
        MatToolbarModule,
        ScrollTopComponent,
        ConfirmationDirective,
        TooltipAutoHideDirective,
        ReactiveFormsModule
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [FilterService]
})
export class TeamsComponent implements OnInit, OnDestroy {
    @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator;
    @ViewChild(MatSort, { static: false }) sort: MatSort;
    destroy$ = new Subject<void>();
    date$ = new BehaviorSubject<Date>(new Date());
    loading$ = new BehaviorSubject<boolean>(false);
    reload$ = new BehaviorSubject<boolean>(true);
    displayedColumns$ = new BehaviorSubject<string[]>([]);
    column = Column;
    teams: Array<Team>;
    dataSource: MatTableDataSource<Team, MatPaginator>;
    sortBy = DEFAULT_ORDER_BY;
    sortDir = DEFAULT_ORDER_DIR;
    pageIndex = 0;
    pageSizes = [DEFAULT_PAGE_SIZE, 25, 50, 100];
    pageSize = DEFAULT_PAGE_SIZE;
    pageTag = 'teams';

    allowedUsersSet = new Set<number>();

    filterControl = this.filterService.filterControl;
    needle$ = this.filterService.needle$;

    constructor(
        public accountService: AccountService,
        private cacheService: CacheService,
        private hermesTeamService: HermesTeamService,
        private hermesEmployeeService: HermesEmployeeService,
        private hermesProjectService: HermesProjectService,
        private dialog: MatDialog,
        private notificationService: NotificationService,
        private selectedDateService: SelectedDateService,
        private storageService: StorageService,
        private cdr: ChangeDetectorRef,
        @Self()
        private filterService: FilterService
    ) {}

    ngOnInit(): void {
        this.initialize([]);

        this.needle$.pipe(takeUntil(this.destroy$)).subscribe(({ needle, profile }) => {
            this.setProps(profile.username, 'needle', needle);
            this.dataSource.filter = needle;

            if (this.dataSource.paginator) {
                this.dataSource.paginator.firstPage();
            }
        });

        this.selectedDateService.selectedDate$
            .asObservable()
            .pipe(
                takeUntil(this.destroy$),
                filter((date) => Boolean(date))
            )
            .subscribe((date) => this.date$.next(date));

        this.reload$
            .asObservable()
            .pipe(
                takeUntil(this.destroy$),
                tap(() => this.loading$.next(true)),
                switchMap(() => this.hermesTeamService.getTeams().pipe(takeUntil(this.destroy$))),
                filter((response) => response instanceof Collection),
                map((response) => response.items)
            )
            .subscribe((teams: Array<Team>) => {
                teams.forEach((team) => (team[Column.MemberCount] = team.members.length));
                this.initialize(teams);
                this.filterControl.updateValueAndValidity();
                this.loading$.next(false);
            });

        combineLatest([
            this.hermesEmployeeService.getEmployees(
                null,
                PersonnelAccountOrderBy.Id,
                OrderDirection.Asc,
                0,
                10000
            ),
            this.hermesProjectService.getProjects(),
            this.accountService.profile$
        ])
            .pipe(
                takeUntil(this.destroy$),
                map(([employees, projects, profile]) => [
                    ...employees.items.map((employee: PersonnelAccount) =>
                        employee.isOfficeManager ? employee.id : null
                    ),
                    ...projects.items.map((project) => project.supervisorId),
                    profile?.isSuperadmin ? profile.id : null
                ]),
                switchMap((res) => combineLatest([of(res), this.accountService.profile$])),
                filter(([, profile]) => profile instanceof PersonnelAccount)
            )
            .subscribe(([res, profile]) => {
                this.allowedUsersSet = new Set(res);
                this.displayedColumns$.next(
                    !this.allowedUsersSet.has(profile.id)
                        ? [...DEFAULT_COLUMNS].filter((e) => e !== Column.Actions)
                        : [...DEFAULT_COLUMNS]
                );

                const config =
                    JSON.parse(this.storageService.getStoredConfig(profile.username)) || {};
                this.filterControl.patchValue(
                    config[this.pageTag] && config[this.pageTag].needle
                        ? config[this.pageTag].needle
                        : ''
                );

                if (config[this.pageTag]) {
                    const { sortBy } = config[this.pageTag];

                    const { sortDir } = config[this.pageTag];
                    if (sortBy && sortDir) {
                        this.sortBy = sortBy;
                        this.sortDir = sortDir;
                    }
                    const { pageIndex } = config[this.pageTag];

                    const { pageSize } = config[this.pageTag];
                    if (pageIndex && pageSize) {
                        this.pageIndex = pageIndex;
                        this.pageSize = pageSize;
                    }
                }
            });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.date$.complete();
        this.loading$.complete();
        this.reload$.complete();
        this.displayedColumns$.complete();
    }

    refresh(): void {
        // FIXME: bad practice
        this.reload$.next(true);
        this.loading$.next(true);
        this.cacheService.reloadTeams();
    }

    sortTable(sort: Sort, username: string): void {
        if (!this.dataSource) {
            return;
        }

        const data = this.dataSource.data.slice();

        if (!sort.active || sort.direction === '') {
            this.dataSource.data = data;
            return;
        }

        this.dataSource.data = data.sort((a, b) => {
            const isAsc = sort.direction === 'asc';
            return compare(a[sort.active], b[sort.active], isAsc);
        });

        this.setProps(username, 'sortBy', this.sort.active);
        this.setProps(username, 'sortDir', this.sort.direction);

        setTimeout(() => this.cdr.detectChanges());
    }

    showTeamCreateDialog(): void {
        const dialogRef = this.dialog.open(TeamEditDialogComponent, {
            autoFocus: false,

            data: null
        });

        dialogRef
            .afterClosed()
            .pipe(
                takeUntil(this.destroy$),
                filter((result) => Boolean(result))
            )
            .subscribe(() => this.refresh());
    }

    showTeamEditDialog(team: Team): void {
        const dialogRef = this.dialog.open(TeamEditDialogComponent, {
            autoFocus: false,

            data: team
        });

        dialogRef
            .afterClosed()
            .pipe(
                takeUntil(this.destroy$),
                filter((result) => Boolean(result))
            )
            .subscribe(() => this.refresh());
    }

    showTeamManagerEditDialog(team: Team): void {
        const dialogRef = this.dialog.open(TeamManagerDialogComponent, {
            autoFocus: false,

            data: team
        });

        dialogRef
            .afterClosed()
            .pipe(
                takeUntil(this.destroy$),
                filter((result) => Boolean(result))
            )
            .subscribe(() => this.refresh());
    }

    deleteTeam(team: Team): void {
        this.hermesTeamService
            .deleteTeam(team.id)
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                () => {
                    this.notificationService.success(`Team ${team.title} deleted`);
                    this.refresh();
                },
                (error) => {
                    if (error instanceof BadRequestError) {
                        const errorMessage = TeamError.getDescription(error.error);
                        this.notificationService.error(errorMessage ?? error);
                    } else {
                        this.notificationService.error(error);
                    }
                }
            );
    }

    private initialize(teams: Team[]): void {
        this.teams = teams;
        this.dataSource = new MatTableDataSource(teams);

        setTimeout(() => {
            if (this.sort) {
                this.dataSource.sort = this.sort;
            }
        });

        this.dataSource.filterPredicate = this.filter;

        if (this.paginator) {
            const { pageIndex } = this.paginator;
            this.dataSource.paginator = this.paginator;
            this.dataSource.paginator.firstPage();
            setTimeout(() => repeat(pageIndex, () => this.dataSource.paginator.nextPage()), 0);
        }
    }

    private filter(team: Team, needle: string): boolean {
        // NOTE: .toLowerCase() and .trim() are probably redundant
        const trimmedNeedle = needle.toLowerCase().trim();

        return (
            team.id.toString().includes(trimmedNeedle) ||
            team.title.toLowerCase().includes(trimmedNeedle) ||
            team.createdByName.toLowerCase().includes(trimmedNeedle) ||
            team.createdByUsername.toLowerCase().includes(trimmedNeedle)
        );
    }

    getTeamLink(title: string): string {
        return simplifyTitle(title);
    }

    paginatorChanged(event: PageEvent, username: string): void {
        const config = JSON.parse(this.storageService.getStoredConfig(username)) || {};
        config[this.pageTag].pageIndex = event.pageIndex;
        config[this.pageTag].pageSize = event.pageSize;
        this.storageService.setStoredConfig(username, JSON.stringify(config));
    }

    setProps(username: string, key: string, value: string): void {
        const config = JSON.parse(this.storageService.getStoredConfig(username)) || {};

        if (!config[this.pageTag]) {
            config[this.pageTag] = {};
        }
        config[this.pageTag][key] = value;

        this.storageService.setStoredConfig(username, JSON.stringify(config));
    }
}
