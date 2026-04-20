import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnDestroy,
    OnInit,
    ViewChild
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort, Sort, MatSortHeader } from '@angular/material/sort';
import { toSignal } from '@angular/core/rxjs-interop';
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
import { MatDialog } from '@angular/material/dialog';
import { MatTooltip } from '@angular/material/tooltip';
import { AsyncPipe, DatePipe } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import {
    debounceTime,
    distinctUntilChanged,
    filter,
    map,
    switchMap,
    take,
    takeUntil,
    tap
} from 'rxjs/operators';
import { BehaviorSubject, combineLatest, from, Subject } from 'rxjs';
import { InlineSVGModule } from 'ng-inline-svg-2';
import { format, isBefore, isSameMonth } from 'date-fns/esm';
import {
    Office,
    PersonnelAccount,
    ReportStatus,
    TimeOffKind,
    TimesheetCell,
    VismaReport
} from '../../protocol/db-protocol';
import { CacheService } from '../../core/services/cache.service';
import { HermesReportService } from '../../protocol/report-protocol.service';
import {
    CreateVismaReportRequest,
    MonthlyEmployeeTimesheet,
    UpdateVismaReportRequest
} from '../../protocol/web-protocol';
import { NotificationService } from '../../core/services/notification.service';
import { WindowRefService } from '../../core/services/window-ref.service';
import { repeat } from '../../shared/functions/repeat';
import { Empty } from '../../protocol/common-protocol';
import { AccountService } from '../../core/services/account.service';
import { simplifyTitle } from '../../shared/functions/simplify-title';
import { StorageService } from '../../core/services/storage.service';
import { compare } from '../../shared/functions/compare';
import { LoadingIndicatorComponent } from '../../components/loading-indicator/loading-indicator.component';
import { MonthPickerComponent } from '../../components/month-picker/month-picker.component';
import { OfficeSelectorComponent } from '../../components/office-selector/office-selector.component';
import {
    ReportCreateDialogData,
    RoleReportDialogData
} from '../../shared/interfaces/dialog-data.interface';
import { ScrollTopComponent } from '../../components/scroll-top/scroll-top.component';
import { TooltipAutoHideDirective } from '../../shared/directives/tooltip-auto-hide.directive';
import { HermesTimesheetService } from '../../protocol/timesheet-protocol.service';
import { ConfirmationDirective } from '../../components/confirmation/confirmation.directive';
import { ExcelService } from '../../core/services/excel.service';
import { ReportCreateDialogComponent } from './report-create-dialog/report-create-dialog.component';
import { RoleReportDialogComponent } from './role-report-dialog/role-report-dialog.component';
import { AbsenceReportDialogComponent } from './absence-report-dialog/absence-report-dialog.component';
import {
    Column,
    DEFAULT_COLUMNS,
    DEFAULT_ORDER_BY,
    DEFAULT_ORDER_DIR,
    DEFAULT_PAGE_SIZE
} from './reports.structures';

const LINE_BREAK = '\r\n';

@Component({
    selector: 'app-reports',
    templateUrl: './reports.component.html',
    styleUrls: ['./reports.component.scss'],
    standalone: true,
    imports: [
        MatTooltip,
        OfficeSelectorComponent,
        MonthPickerComponent,
        MatTable,
        MatSort,
        MatColumnDef,
        MatHeaderCellDef,
        MatHeaderCell,
        MatSortHeader,
        MatCellDef,
        MatCell,
        RouterLink,
        MatHeaderRowDef,
        MatHeaderRow,
        MatRowDef,
        MatRow,
        LoadingIndicatorComponent,
        MatPaginator,
        AsyncPipe,
        DatePipe,
        MatButtonModule,
        MatToolbarModule,
        MatIconModule,
        ScrollTopComponent,
        MatInputModule,
        InlineSVGModule,
        TooltipAutoHideDirective,
        ConfirmationDirective
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportsComponent implements OnInit, OnDestroy {
    @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator;
    @ViewChild(MatSort, { static: false }) sort: MatSort;
    destroy$ = new Subject<void>();
    date$ = new BehaviorSubject<Date | null>(null);
    editCommentSet$ = new BehaviorSubject<Set<number>>(new Set());
    initPicker$ = new BehaviorSubject<Date | null>(null);
    loading$ = new BehaviorSubject<boolean>(false);
    office$ = new BehaviorSubject<Office | null>(null);
    officeName$ = new BehaviorSubject<string | null>(null);
    reports$ = new BehaviorSubject<VismaReport[]>([]);
    refresh$ = new BehaviorSubject(false);
    statusMap$ = new BehaviorSubject<Map<number, ReportStatus>>(new Map());

    displayedColumns = DEFAULT_COLUMNS;
    column = Column;
    reports: Array<VismaReport>;
    dataSource: MatTableDataSource<VismaReport, MatPaginator>;
    sortBy = DEFAULT_ORDER_BY;
    sortDir = DEFAULT_ORDER_DIR;
    pageIndex = 0;
    pageSizes = [DEFAULT_PAGE_SIZE, 25, 50, 100];
    pageSize = DEFAULT_PAGE_SIZE;
    pageTag = 'reports';
    needle = '';

    readonly employees = toSignal(this.cacheService.employees$);
    readonly projects = toSignal(this.cacheService.projects$);

    constructor(
        private cdr: ChangeDetectorRef,
        private dialog: MatDialog,
        private route: ActivatedRoute,
        private router: Router,
        public accountService: AccountService,
        public cacheService: CacheService,
        private notificationService: NotificationService,
        public reportService: HermesReportService,
        private storageService: StorageService,
        private windowRefService: WindowRefService,
        private timesheetService: HermesTimesheetService,
        private excelService: ExcelService
    ) {}

    ngOnInit(): void {
        this.route.paramMap
            .pipe(
                filter(
                    (paramMap) =>
                        paramMap.has('officeName') && paramMap.has('year') && paramMap.has('month')
                ),
                map((paramMap) => {
                    const dateResult = new Date(
                        Number(paramMap.get('year')),
                        Number(paramMap.get('month')) - 1,
                        1,
                        12
                    );
                    return [dateResult, paramMap.get('officeName') ?? null];
                }),
                takeUntil(this.destroy$)
            )
            .subscribe(([date, officeName]: [Date, string]) => {
                this.initPicker$.next(date);
                this.date$.next(date);
                this.officeName$.next(officeName);
            });

        combineLatest([
            this.accountService.profile$
                .asObservable()
                .pipe(filter((profile) => profile instanceof PersonnelAccount)),
            this.cacheService.offices$.asObservable().pipe(filter((offices) => Boolean(offices))),
            this.officeName$.asObservable()
        ])
            .pipe(takeUntil(this.destroy$))
            .subscribe(([profile, offices, officeName]) => {
                const config =
                    JSON.parse(this.storageService.getStoredConfig(profile.username)) || {};
                this.needle =
                    config[this.pageTag] && config[this.pageTag].needle
                        ? config[this.pageTag].needle
                        : '';

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

                if (officeName) {
                    this.cacheService.selectedOffice$.next(
                        offices.find((office) => simplifyTitle(office.name) === officeName)
                    );
                } else {
                    const officeFromStorage = JSON.parse(
                        this.storageService.getStoredConfig(profile.username)
                    )[this.pageTag].office_id;

                    let firstOffice;
                    if (officeFromStorage) {
                        firstOffice =
                            offices.filter((o) => o.id === officeFromStorage)[0] || offices[0];
                    } else {
                        firstOffice =
                            offices.filter((o) => o.id === profile.officeId)[0] || offices[0];
                    }

                    if (firstOffice instanceof Office) {
                        this.cacheService.selectedOffice$.next(firstOffice);
                    }
                }

                // eslint-disable-next-line prefer-destructuring
                const date =
                    config[this.pageTag] && config[this.pageTag].date
                        ? config[this.pageTag].date
                        : false;
                if (date) {
                    this.date$.next(new Date(date));
                }
            });

        combineLatest([
            this.cacheService.selectedOffice$.asObservable(),
            this.date$.asObservable().pipe(filter((date) => Boolean(date))),
            this.cacheService.offices$.asObservable(),
            this.refresh$.asObservable()
        ])
            .pipe(
                tap(() => this.loading$.next(true)),
                takeUntil(this.destroy$),
                distinctUntilChanged(),
                debounceTime(250),
                filter(
                    ([selectedOffice, date, offices]) =>
                        Boolean(selectedOffice) && Boolean(offices) && Boolean(date)
                ),
                map(([selectedOffice, date, offices]) => [
                    selectedOffice instanceof Office ? selectedOffice.id : Number(selectedOffice),
                    date,
                    offices
                ]),
                tap(([selectedOffice, _, offices]: [number, Date, Office[]]) =>
                    this.office$.next(offices.find((office) => office.id === selectedOffice))
                ),
                switchMap(([selectedOffice, date, _]) => {
                    return this.reportService
                        .getVismaReportsForOffice(
                            new Date(date).getFullYear(),
                            new Date(date).getMonth() + 1,
                            selectedOffice
                        )
                        .pipe(take(1), takeUntil(this.destroy$));
                }),
                map((collection) => collection.items),
                map((items: VismaReport[]) =>
                    items.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
                )
            )
            .subscribe((reports: VismaReport[]) => {
                const statusMap = new Map<number, ReportStatus>(
                    reports
                        .filter((report) => report.deliveryStatus)
                        .map((report) => [report.id, report.deliveryStatus])
                );
                this.statusMap$.next(statusMap);
                this.reports$.next(reports);
                this.initialize(reports);
                this.loading$.next(false);
            });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.editCommentSet$.complete();
        this.initPicker$.complete();
        this.loading$.complete();
        this.office$.complete();
        this.officeName$.complete();
        this.reports$.complete();
        this.refresh$.complete();
        this.statusMap$.complete();
        this.date$.complete();
    }

    onSendReport(reportId: number, statusMap: Map<number, ReportStatus>): void {
        this.reportService
            .deliverVismaReport(new Empty(), reportId)
            .pipe(
                take(1),
                map((report) => report.deliveryStatus),
                takeUntil(this.destroy$)
            )
            .subscribe({
                next: (status) => {
                    statusMap.set(reportId, status || ReportStatus.Created);
                    this.statusMap$.next(statusMap);
                    this.notificationService.success('Report has been sent successfully');
                },
                error: (error) => this.notificationService.error(error)
            });
    }

    onUpdateDeliveryStatus(reportId: number, statusMap: Map<number, ReportStatus>): void {
        this.reportService
            .updateVismaReportDeliveryStatus(new Empty(), reportId)
            .pipe(
                take(1),
                map((response) => response.deliveryStatus),
                takeUntil(this.destroy$)
            )
            .subscribe({
                next: (status) => {
                    statusMap.set(reportId, status);
                    this.statusMap$.next(statusMap);
                    this.notificationService.success('Report status updated');
                },
                error: (error) => {
                    this.notificationService.error(error);
                }
            });
    }

    onStartEditing(reportId: number, editingSet: Set<number>): void {
        editingSet.add(reportId);
        this.editCommentSet$.next(editingSet);
        this.windowRefService.focusElementById(`comment-${reportId}`, 150);
    }

    onFinishEditing(reportId: number, editingSet: Set<number>): void {
        editingSet.delete(reportId);
        this.editCommentSet$.next(editingSet);
    }

    updateReportComment(
        comment: string,
        reportId: number,
        editingSet: Set<number>,
        reports: VismaReport[]
    ): void {
        if (comment === reports.find((r) => r.id === reportId).comment) {
            this.onFinishEditing(reportId, editingSet);
            return;
        }

        const request = new UpdateVismaReportRequest();
        request.comment = comment;
        this.reportService
            .updateVismaReport(request, reportId)
            .pipe(take(1), takeUntil(this.destroy$))
            .subscribe({
                next: (response) => {
                    this.notificationService.success(`Successfully updated ${response.id}`);
                    reports.splice(
                        reports.findIndex((r) => r.id === response.id),
                        1,
                        response
                    );
                    this.reports$.next(reports);
                    this.initialize(reports);
                    this.onFinishEditing(reportId, editingSet);
                },
                error: (error) => {
                    this.notificationService.error(error);
                }
            });
    }

    getName(employees: PersonnelAccount[], id: number): string {
        return employees.find((emp) => emp.id === id).name || 'Unknown';
    }

    getUsername(employees: PersonnelAccount[], id: number): string {
        return employees.find((emp) => emp.id === id).username || null;
    }

    getStatusDescription(status: ReportStatus): string {
        switch (status) {
            case ReportStatus.Created:
                return 'Created';
            case ReportStatus.Running:
                return 'Running...';
            case ReportStatus.Stopped:
                return 'Stopped';
            case ReportStatus.Completed:
                return 'Completed';
            case ReportStatus.Error:
                return 'Error';
            case ReportStatus.Scheduled:
                return 'Scheduled';
            default:
                return 'Undefined';
        }
    }

    private initialize(reports: VismaReport[]): void {
        this.reports = reports;
        this.dataSource = new MatTableDataSource(reports);

        setTimeout(() => {
            if (this.sort) {
                this.dataSource.sort = this.sort;
            }
        });

        if (this.paginator) {
            const { pageIndex } = this.paginator;
            this.dataSource.paginator = this.paginator;
            this.dataSource.paginator.firstPage();
            setTimeout(() => repeat(pageIndex, () => this.dataSource.paginator.nextPage()), 0);
        }
    }

    saveReport(office: Office, date: Date): void {
        this.dialog
            .open(ReportCreateDialogComponent, {
                autoFocus: false,
                data: {
                    officeId: office.id,
                    date,
                    officeRolesId: office.allowedRoles
                } satisfies ReportCreateDialogData
            })
            .afterClosed()
            .pipe(
                take(1),
                filter((response) => response !== null && response !== undefined),
                switchMap((response) => {
                    const request = new CreateVismaReportRequest();
                    request.comment = response.comment;
                    request.omitIds = response.omitted;
                    request.officeId = office.id;
                    request.year = date.getFullYear();
                    request.month = date.getMonth() + 1;
                    return this.reportService
                        .createVismaReport(request)
                        .pipe(take(1), takeUntil(this.destroy$));
                }),
                takeUntil(this.destroy$)
            )
            .subscribe({
                next: (report) => {
                    this.notificationService.success(`Report ${report.id} saved`);
                    this.refresh$.next(true);
                },
                error: (error) => this.notificationService.error(error.error)
            });
    }

    openRoleReportDialog(officeId: number, date: Date): void {
        this.dialog.open(RoleReportDialogComponent, {
            autoFocus: false,

            data: { officeId, date } satisfies RoleReportDialogData
        });
    }

    openBDOReportDialog(officeId: number, date: Date): void {
        this.dialog.open(AbsenceReportDialogComponent, {
            autoFocus: false,

            data: { officeId, date } satisfies RoleReportDialogData
        });
    }

    onNavigate(date: Date, office: Office | null): void {
        this.router
            .navigate([
                '/',
                'reports',
                simplifyTitle(office.name),
                date.getFullYear(),
                date.getMonth() + 1
            ])
            .then();
    }

    getColorStatus(reportStatus: ReportStatus): string {
        switch (reportStatus) {
            case ReportStatus.Created:
            case ReportStatus.Completed:
                return 'text-success';
            case ReportStatus.Error:
                return 'text-danger';
            case ReportStatus.Running:
                return 'text-info';
            default:
                return 'text-info';
        }
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

    onDateChange(date: Date): void {
        this.date$.next(date);
    }

    buildAllocationPerProjectReport(
        timesheets: MonthlyEmployeeTimesheet[],
        reportDate: Date
    ): Map<string, string>[] {
        const terminationDatesByEmployeeId = new Map(
            this.employees()
                .filter((emp) => emp.firedAt)
                .map((emp) => [emp.id, emp.firedAt])
        );

        const projectsWithVismaCode101 = new Set(
            this.projects()
                .filter((p) => p.financeCode === '101')
                .map((p) => p.id)
        );

        const rows = timesheets
            .filter((timesheet) => timesheet.cells.length)
            // .filter(
            //     (timesheet) =>
            //         !terminationDatesByEmployeeId.has(timesheet.personnelId) ||
            //         isBefore(reportDate, terminationDatesByEmployeeId.get(timesheet.personnelId)) ||
            //         isSameMonth(reportDate, terminationDatesByEmployeeId.get(timesheet.personnelId))
            // )
            .sort((a, b) => a.personnelName.localeCompare(b.personnelName))
            .map((timesheet) => {
                const cols = new Map<string, string>().set('name', timesheet.personnelName);

                const getCellValue = (cell: TimesheetCell) => {
                    if (projectsWithVismaCode101.has(cell.projectId)) {
                        return 'Visma 101';
                    } else if (cell.projectName) {
                        return cell.projectName;
                    } else if (cell.timeOff !== null) {
                        return TimeOffKind.getDescription(cell.timeOff);
                    } else if (
                        isBefore(terminationDatesByEmployeeId.get(cell.personnelId), cell.cellDate)
                    ) {
                        return 'Fired';
                    } else {
                        return '-';
                    }
                };

                timesheet.cells.forEach((cell) => {
                    cols.set(cell.cellDateIso, getCellValue(cell));
                });

                return cols;
            });

        return rows;
    }

    downloadAllocationPerProject(date: Date) {
        from(this.cacheService.reloadEmployees())
            .pipe(
                switchMap(() =>
                    this.timesheetService
                        .getMonthlyTimesheetForEveryone(date.getFullYear(), date.getMonth() + 1)
                        .pipe(
                            map((collection) => collection.items),
                            take(1)
                        )
                ),
                takeUntil(this.destroy$)
            )
            .subscribe((v) => {
                const rows = this.buildAllocationPerProjectReport(v, date);

                this.excelService.generateDailyAllocationReport(
                    rows,
                    `Allocation-per-project-${format(date, 'MMM-Y')}`
                );
            });
    }
}
