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
import { MatCheckbox } from '@angular/material/checkbox';
import { MatTooltip } from '@angular/material/tooltip';
import { MatIcon } from '@angular/material/icon';
import { MatIconButton, MatButton } from '@angular/material/button';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatInput } from '@angular/material/input';
import { MatFormField, MatSuffix } from '@angular/material/form-field';
import { AsyncPipe, DatePipe } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { filter, map, switchMap, takeUntil, tap } from 'rxjs/operators';
import { BehaviorSubject, Subject } from 'rxjs';
import { compare } from '../../../shared/functions/compare';
import { repeat } from '../../../shared/functions/repeat';
import { Project } from '../../../protocol/db-protocol';
import { NotificationService } from '../../../core/services/notification.service';
import { ProjectEditDialogComponent } from '../project-edit-dialog/project-edit-dialog.component';
import { BadRequestError, Collection } from '../../../protocol/data-protocol';
import { HermesProjectService } from '../../../protocol/project-protocol.service';
import { AccountService } from '../../../core/services/account.service';
import { CacheService } from '../../../core/services/cache.service';
import { ProjectError, UpdateProjectRequest } from '../../../protocol/web-protocol';
import { simplifyTitle } from '../../../shared/functions/simplify-title';
import { SelectedDateService } from '../../../core/services/selected-date.service';
import { StorageService } from '../../../core/services/storage.service';
import { getErrorDescription } from '../../../shared/functions/project-error-descriptions';
import { LoadingIndicatorComponent } from '../../../components/loading-indicator/loading-indicator.component';
import { ScrollTopComponent } from '../../../components/scroll-top/scroll-top.component';
import { ConfirmationDirective } from '../../../components/confirmation/confirmation.directive';
import { TooltipAutoHideDirective } from '../../../shared/directives/tooltip-auto-hide.directive';
import { FilterService } from '../../../core/services/filter.service';

enum Column {
    Id = 'id',
    Title = 'title',
    Key = 'key',
    FinanceCode = 'financeCode',
    LeadingOfficeName = 'leadingOfficeName',
    SupervisorName = 'supervisorName',
    Summary = 'summary',
    StartedAt = 'startedAt',
    FinishedAt = 'finishedAt',
    UpdatedAt = 'updatedAt',
    Archived = 'isArchived',
    Actions = 'actions'
}

interface CustomFilter {
    needle: string;
    showArchived: boolean;
}

const DEFAULT_ORDER_BY = Column.Id;
const DEFAULT_ORDER_DIR: SortDirection = 'asc';
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_COLUMNS = [
    Column.Id,
    Column.Title,
    Column.FinanceCode,
    Column.LeadingOfficeName,
    Column.SupervisorName,
    Column.Archived,
    Column.Summary,
    Column.StartedAt,
    Column.FinishedAt,
    Column.UpdatedAt,
    Column.Actions
];

@Component({
    selector: 'app-projects',
    templateUrl: './projects.component.html',
    styleUrls: ['./projects.component.scss'],
    standalone: true,
    imports: [
        MatFormField,
        MatInput,
        FormsModule,
        MatIconButton,
        MatSuffix,
        MatIcon,
        MatTooltip,
        MatCheckbox,
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
export class ProjectsComponent implements OnInit, OnDestroy {
    @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator;
    @ViewChild(MatSort, { static: false }) sort: MatSort;
    destroy$ = new Subject<void>();
    date$ = new BehaviorSubject<Date>(new Date());
    loading$ = new BehaviorSubject<boolean>(false);
    reload$ = new BehaviorSubject<boolean>(true);
    column = Column;
    projects: Array<Project>;
    dataSource: MatTableDataSource<Project, MatPaginator>;
    displayedColumns = [];
    showArchived = false;
    sortBy = DEFAULT_ORDER_BY;
    sortDir = DEFAULT_ORDER_DIR;
    pageIndex = 0;
    pageSizes = [DEFAULT_PAGE_SIZE, 25, 50, 100];
    pageSize = DEFAULT_PAGE_SIZE;
    pageTag = 'projects';

    needle$ = this.filterService.needle$;
    filterControl = this.filterService.filterControl;

    constructor(
        private cdr: ChangeDetectorRef,
        private dialog: MatDialog,
        public accountService: AccountService,
        private cacheService: CacheService,
        private storageService: StorageService,
        private hermesProjectService: HermesProjectService,
        private notificationService: NotificationService,
        private selectedDateService: SelectedDateService,
        @Self()
        private filterService: FilterService
    ) {}

    ngOnInit(): void {
        this.initialize([]);

        this.needle$.pipe(takeUntil(this.destroy$)).subscribe(({ needle, profile }) => {
            this.setProps(profile.username, 'needle', needle);
            this.dataSource.filter = JSON.stringify({
                needle: needle,
                showArchived: this.showArchived
            });

            if (this.dataSource.paginator) {
                this.dataSource.paginator.firstPage();
            }
        });

        this.accountService.profile$.pipe(takeUntil(this.destroy$)).subscribe((profile) => {
            this.displayedColumns = !profile?.isSuperadmin
                ? [...DEFAULT_COLUMNS].filter((e) => e !== Column.Actions)
                : [...DEFAULT_COLUMNS];

            const config = JSON.parse(this.storageService.getStoredConfig(profile.username)) || {};
            this.showArchived =
                config[this.pageTag] && config[this.pageTag].showArchived
                    ? config[this.pageTag].showArchived === 'true'
                    : false;

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

        this.selectedDateService.selectedDate$
            .asObservable()
            .pipe(
                filter((date) => Boolean(date)),
                takeUntil(this.destroy$)
            )
            .subscribe((date) => this.date$.next(date));

        this.reload$
            .asObservable()
            .pipe(
                takeUntil(this.destroy$),
                tap(() => this.loading$.next(true)),
                switchMap(() =>
                    this.hermesProjectService.getProjects().pipe(takeUntil(this.destroy$))
                ),
                filter((colletion) => colletion instanceof Collection),
                map((projects) => projects.items)
            )
            .subscribe((projects: Project[]) => {
                this.initialize(projects);
                this.filterControl.updateValueAndValidity();
                this.loading$.next(false);
            });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.date$.complete();
        this.loading$.complete();
        this.reload$.complete();
    }

    refresh(): void {
        this.cacheService.reloadProjects();
        this.reload$.next(true);
        this.loading$.next(true);
    }

    showProjectCreateDialog(): void {
        const dialogRef = this.dialog.open(ProjectEditDialogComponent, {
            data: null
        });

        dialogRef
            .afterClosed()
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => {
                this.refresh();
            });
    }

    showProjectEditDialog(project: Project): void {
        const dialogRef = this.dialog.open(ProjectEditDialogComponent, {
            data: project
        });

        dialogRef
            .afterClosed()
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => this.refresh());
    }

    sortTable(sort: Sort, username: string): void {
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

    onArchivedChecked(projects: Array<Project>, username: string): void {
        this.dataSource.filter = JSON.stringify({
            needle: this.filterService.needle,
            showArchived: this.showArchived
        });
        this.setProps(username, 'showArchived', `${this.showArchived}`);
    }

    archiveProject(project: Project): void {
        const request = new UpdateProjectRequest();
        request.isArchived = !project.isArchived;

        this.hermesProjectService
            .updateProject(request, project.id)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (response) => {
                    this.notificationService.success(
                        `Project ${response.title} is ${
                            response.isArchived ? 'unarchived' : 'archived'
                        }`
                    );
                    this.refresh();
                },
                error: (err) => {
                    if (err instanceof BadRequestError) {
                        const errorMessage = getErrorDescription(err.error);
                        this.notificationService.error(errorMessage ?? err);
                    } else {
                        this.notificationService.error(err);
                    }
                }
            });
    }

    deleteProject(project: Project): void {
        this.hermesProjectService
            .deleteProject(project.id)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: () => {
                    this.notificationService.success(`Project ${project.title} deleted`);
                    this.refresh();
                },
                error: (error) => {
                    if (error instanceof BadRequestError) {
                        const errorMessage = ProjectError.getDescription(error.error);
                        this.notificationService.error(errorMessage ?? error);
                    } else {
                        this.notificationService.error(error);
                    }
                }
            });
    }

    getSimpleTitle(title: string): string {
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

    private initialize(projects: Project[]): void {
        this.projects = projects;
        this.dataSource = new MatTableDataSource(projects);

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

    private filter(project: Project, filterJson: string): boolean {
        const filterObj = JSON.parse(filterJson) as CustomFilter;
        // NOTE: .toLowerCase() and .trim() are probably redundant
        const trimmedNeedle = filterObj.needle.toLowerCase().trim();

        return (
            (filterObj.showArchived ? true : !project.isArchived) &&
            (project?.id?.toString().includes(trimmedNeedle) ||
                project?.title?.toLowerCase().includes(trimmedNeedle) ||
                project?.supervisorName?.toLowerCase().includes(trimmedNeedle) ||
                project?.supervisorUsername?.toLowerCase().includes(trimmedNeedle) ||
                project?.leadingOfficeName?.toLowerCase().includes(trimmedNeedle) ||
                project?.financeCode?.toLowerCase().includes(trimmedNeedle))
        );
    }
}
