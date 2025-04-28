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
import { MatSort, Sort, SortDirection, MatSortHeader } from '@angular/material/sort';
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
import { NotificationService } from '../../../core/services/notification.service';
import { Collection } from '../../../protocol/data-protocol';
import { AccountService } from '../../../core/services/account.service';
import { Highlight, PersonnelAccount } from '../../../protocol/db-protocol';
import { HighlightEditDialogComponent } from '../highlight-edit-dialog/highlight-edit-dialog.component';
import { HermesHighlightService } from '../../../protocol/highlight-protocol.service';
import { StorageService } from '../../../core/services/storage.service';
import { LoadingIndicatorComponent } from '../../../components/loading-indicator/loading-indicator.component';
import { ScrollTopComponent } from '../../../components/scroll-top/scroll-top.component';
import { ConfirmationDirective } from '../../../components/confirmation/confirmation.directive';
import { TooltipAutoHideDirective } from '../../../shared/directives/tooltip-auto-hide.directive';
import { FilterService } from '../../../core/services/filter.service';

enum Column {
    Id = 'id',
    Code = 'code',
    Title = 'title',
    CreatedAt = 'createdAt',
    UpdatedAt = 'updatedAt',
    Actions = 'actions'
}

const DEFAULT_ORDER_BY = Column.Id;
const DEFAULT_ORDER_DIR: SortDirection = 'asc';
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_COLUMNS = [
    Column.Id,
    Column.Title,
    Column.Code,
    Column.CreatedAt,
    Column.UpdatedAt,
    Column.Actions
];

@Component({
    selector: 'app-highlight',
    templateUrl: './highlights-overview.component.html',
    styleUrls: ['./highlights-overview.component.scss'],
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
export class HighlightsOverviewComponent implements OnInit, OnDestroy {
    @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator;
    @ViewChild(MatSort, { static: false }) sort: MatSort;
    destroy$ = new Subject<void>();
    loading$ = new BehaviorSubject<boolean>(false);
    reload$ = new BehaviorSubject<boolean>(true);
    displayedColumns$ = new BehaviorSubject<string[]>(DEFAULT_COLUMNS);
    column = Column;
    highlights: Array<Highlight>;
    dataSource: MatTableDataSource<Highlight, MatPaginator>;
    sortBy = DEFAULT_ORDER_BY;
    sortDir = DEFAULT_ORDER_DIR;
    pageIndex = 0;
    pageSizes = [DEFAULT_PAGE_SIZE, 25, 50, 100];
    pageSize = DEFAULT_PAGE_SIZE;
    pageTag = 'highlight';

    filterControl = this.filterService.filterControl;
    needle$ = this.filterService.needle$;

    constructor(
        public accountService: AccountService,
        private storageService: StorageService,
        private highlightService: HermesHighlightService,
        private dialog: MatDialog,
        private notificationService: NotificationService,
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

        this.reload$
            .asObservable()
            .pipe(
                takeUntil(this.destroy$),
                tap(() => this.loading$.next(true)),
                switchMap(() =>
                    this.highlightService.getHighlights().pipe(takeUntil(this.destroy$))
                ),
                filter((response) => response instanceof Collection),
                map((response) => response.items)
            )
            .subscribe((highlights: Highlight[]) => {
                this.initialize(highlights);
                this.filterControl.updateValueAndValidity();
                this.loading$.next(false);
            });

        this.accountService.profile$
            .asObservable()
            .pipe(
                takeUntil(this.destroy$),
                filter((profile) => profile instanceof PersonnelAccount)
            )
            .subscribe((profile) => {
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
        this.loading$.complete();
        this.reload$.complete();
        this.displayedColumns$.complete();
    }

    refresh(): void {
        // FIXME: bad practice
        this.reload$.next(true);
        this.loading$.next(true);
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

    showHighlightEditDialog(highlight: Highlight | null): void {
        const dialogRef = this.dialog.open(HighlightEditDialogComponent, {
            autoFocus: false,

            data: highlight
        });

        dialogRef
            .afterClosed()
            .pipe(
                takeUntil(this.destroy$),
                filter((result) => Boolean(result))
            )
            .subscribe(() => this.refresh());
    }

    deleteHighlight(highlight: Highlight): void {
        this.highlightService
            .deleteHighlight(highlight.id)
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => {
                this.notificationService.success(`Highlight ${highlight.title} deleted`);
                this.refresh();
            });
    }

    private initialize(highlights: Highlight[]): void {
        this.highlights = highlights;
        this.dataSource = new MatTableDataSource(highlights);

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

    private filter(highlight: Highlight, needle: string): boolean {
        // NOTE: .toLowerCase() and .trim() are probably redundant
        const trimmedNeedle = needle.toLowerCase().trim();

        return (
            highlight.id.toString().includes(trimmedNeedle) ||
            highlight.title.toLowerCase().includes(trimmedNeedle) ||
            highlight.code.toLowerCase().includes(trimmedNeedle)
        );
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
