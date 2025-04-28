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
import { BehaviorSubject, Subject } from 'rxjs';
import { compare } from '../../../shared/functions/compare';
import { repeat } from '../../../shared/functions/repeat';
import { OfficeEditDialogComponent } from '../office-edit-dialog/office-edit-dialog.component';
import { AccountService } from '../../../core/services/account.service';
import { NotificationService } from '../../../core/services/notification.service';
import { HermesOfficeService } from '../../../protocol/web-office-protocol.service';
import { Office } from '../../../protocol/db-protocol';
import { Collection } from '../../../protocol/data-protocol';
import { OfficeRolesDialogComponent } from '../office-roles-dialog/office-roles-dialog.component';
import { HermesRoleService } from '../../../protocol/role-protocol.service';
import { CacheService } from '../../../core/services/cache.service';
import { simplifyTitle } from '../../../shared/functions/simplify-title';
import { SelectedDateService } from '../../../core/services/selected-date.service';
import { StorageService } from '../../../core/services/storage.service';
import { LoadingIndicatorComponent } from '../../../components/loading-indicator/loading-indicator.component';
import { CountryFlagComponent } from '../../../components/country-flag/country-flag.component';
import { OfficeRolesDialogData } from '../../../shared/interfaces/dialog-data.interface';
import { ScrollTopComponent } from '../../../components/scroll-top/scroll-top.component';
import { ConfirmationDirective } from '../../../components/confirmation/confirmation.directive';
import { TooltipAutoHideDirective } from '../../../shared/directives/tooltip-auto-hide.directive';
import { FilterService } from '../../../core/services/filter.service';
enum Column {
    Id = 'id',
    Name = 'name',
    CountryName = 'countryName',
    VismaTag = 'vismaTag',
    CreatedAt = 'createdAt',
    UpdatedAt = 'updatedAt',
    Actions = 'actions'
}

const DEFAULT_ORDER_BY = Column.Id;
const DEFAULT_ORDER_DIR: SortDirection = 'asc';
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_COLUMNS = [
    Column.Id,
    Column.Name,
    Column.CountryName,
    Column.VismaTag,
    Column.CreatedAt,
    Column.UpdatedAt,
    Column.Actions
];

@Component({
    selector: 'app-offices',
    templateUrl: './offices.component.html',
    styleUrls: ['./offices.component.scss'],
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
        CountryFlagComponent,
        MatToolbarModule,
        ScrollTopComponent,
        ConfirmationDirective,
        TooltipAutoHideDirective,
        ReactiveFormsModule
    ],
    providers: [FilterService],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class OfficesComponent implements OnInit, OnDestroy {
    @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator;
    @ViewChild(MatSort, { static: false }) sort: MatSort;
    destroy$ = new Subject<void>();
    date$ = new BehaviorSubject<Date>(new Date());
    loading$ = new BehaviorSubject<boolean>(true);
    reload$ = new BehaviorSubject<boolean>(true);
    dataSource: MatTableDataSource<Office, MatPaginator>;
    displayedColumns = [];
    column = Column;
    sortBy = DEFAULT_ORDER_BY;
    sortDir = DEFAULT_ORDER_DIR;
    pageIndex = 0;
    pageSize = DEFAULT_PAGE_SIZE;
    pageSizes = [DEFAULT_PAGE_SIZE, 25, 50, 100];
    pageTag = 'offices';

    filterControl = this.filterService.filterControl;
    private needle$ = this.filterService.needle$;

    constructor(
        private cdr: ChangeDetectorRef,
        private dialog: MatDialog,
        public accountService: AccountService,
        private storageService: StorageService,
        private notificationService: NotificationService,
        private hermesOfficeService: HermesOfficeService,
        private hermesRoleService: HermesRoleService,
        private cacheService: CacheService,
        private selectedDateService: SelectedDateService,
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

        this.accountService.profile$.pipe(takeUntil(this.destroy$)).subscribe((profile) => {
            this.displayedColumns = !profile?.isSuperadmin
                ? [...DEFAULT_COLUMNS].filter((e) => e !== Column.Actions)
                : [...DEFAULT_COLUMNS];

            const config = JSON.parse(this.storageService.getStoredConfig(profile.username)) || {};

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

        this.reload$
            .asObservable()
            .pipe(
                takeUntil(this.destroy$),
                tap(() => this.loading$.next(true)),
                switchMap(() =>
                    this.hermesOfficeService.getOffices().pipe(takeUntil(this.destroy$))
                ),
                filter((offices) => offices instanceof Collection),
                map((officeCollection) => officeCollection.items)
            )
            .subscribe((offices) => {
                this.initialize(offices);
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
        this.cacheService.reloadOffices();
        this.reload$.next(true);
    }

    showOfficeCreateDialog(): void {
        const dialogRef = this.dialog.open(OfficeEditDialogComponent, {
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

    showRoleChangeDialog(office: Office): void {
        this.hermesRoleService
            .getRoles()
            .pipe(
                takeUntil(this.destroy$),
                map((collection) => collection.items),
                switchMap((roles) => {
                    const dialogRef = this.dialog.open<
                        OfficeRolesDialogComponent,
                        OfficeRolesDialogData
                    >(OfficeRolesDialogComponent, {
                        autoFocus: false,

                        data: { payload: roles, office }
                    });

                    return dialogRef.afterClosed().pipe(takeUntil(this.destroy$));
                })
            )
            .subscribe(() => this.refresh());
    }

    showOfficeEditDialog(office: Office): void {
        const dialogRef = this.dialog.open(OfficeEditDialogComponent, {
            autoFocus: false,

            data: office
        });

        dialogRef
            .afterClosed()
            .pipe(
                takeUntil(this.destroy$),
                filter((result: Office) => Boolean(result))
            )
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
            if (sort.active === Column.VismaTag) {
                return compare(
                    a.vismaCountry + a.vismaCompanyId,
                    b.vismaCountry + b.vismaCompanyId,
                    isAsc
                );
            }
            return compare(a[sort.active], b[sort.active], isAsc);
        });

        this.setProps(username, 'sortBy', this.sort.active);
        this.setProps(username, 'sortDir', this.sort.direction);

        setTimeout(() => this.cdr.detectChanges());
    }

    deleteOffice(office: Office): void {
        this.hermesOfficeService
            .deleteOffice(office.id)
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                () => {
                    this.notificationService.success(`Office ${office.name} deleted`);
                    this.refresh();
                },
                (error) => {
                    this.notificationService.error(error);
                }
            );
    }

    private initialize(offices: Office[]): void {
        this.dataSource = new MatTableDataSource(offices);

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

    private filter(office: Office, needle: string): boolean {
        // NOTE: .toLowerCase() and .trim() are probably redundant
        const trimmedNeedle = needle.toLowerCase().trim();
        return (
            office.id?.toString().includes(trimmedNeedle) ||
            office.name?.toLowerCase().includes(trimmedNeedle) ||
            office.countryName?.toLowerCase().includes(trimmedNeedle) ||
            office?.city?.toLowerCase().includes(trimmedNeedle) ||
            office?.vismaCountry?.toLowerCase().includes(trimmedNeedle) ||
            office?.vismaCompanyId?.toLowerCase().includes(trimmedNeedle)
        );
    }

    getOfficeLink(title: string): string {
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
