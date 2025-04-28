import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    EventEmitter,
    HostListener,
    Input,
    OnDestroy,
    OnInit,
    Output
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { AsyncPipe, UpperCasePipe, SlicePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { filter, map, switchMap, take, takeUntil, tap } from 'rxjs/operators';
import { BehaviorSubject, combineLatest, Observable, Subject } from 'rxjs';
import {
    CalendarEvent,
    CalendarMonthViewDay,
    CalendarView,
    CalendarMonthModule,
    CalendarCommonModule
} from 'angular-calendar';
import { Color } from '../../shared/classes/event-color';
import { AccountService } from '../../core/services/account.service';
import { HermesEmployeeService } from '../../protocol/web-employee-protocol.service';
import { HermesTimesheetService } from '../../protocol/timesheet-protocol.service';
import { PersonnelAccount, Project, TimeOffKind, TimesheetCell } from '../../protocol/db-protocol';
import { HermesProjectService } from '../../protocol/project-protocol.service';

import {
    BulkTimesheetAction,
    BulkTimesheetAllocate,
    BulkTimesheetTimeOff,
    EmployeeAlloc,
    TimesheetSelector
} from '../../protocol/web-protocol';
import {
    CellEditDialogComponent,
    CellEditDialogData
} from '../table-grid/cell-edit-dialog/cell-edit-dialog.component';
import { NotificationService } from '../../core/services/notification.service';
import { HermesTaskService } from '../../protocol/task-protocol.service';
import {
    HistoryDialogComponent,
    HistoryDialogData
} from '../table-grid/history-dialog/history-dialog.component';
import { Direction } from '../../shared/enums/direction.enum';
import { ProjectWithDays } from '../../shared/interfaces/days-spent-on-project.interface';
import { MonthPickerComponent } from '../month-picker/month-picker.component';

enum BackgroundCell {
    Empty = 'var(--bs-tertiary-bg, rgb(229, 231, 238))',
    AnotherMonth = 'var(--bs-warning-bg-subtle, rgb(241, 242, 244))'
}

export enum Occupancy {
    Project = 'project',
    Absence = 'absence',
    Deallocate = 'deallocate',
    Protect = 'protect',
    Unprotect = 'unprotect'
}

export interface TimesheetCellData {
    preferredProjectId: number;
    cells: Array<TimesheetCell>;
}

@Component({
    selector: 'app-project-calendar',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: 'project-calendar.component.html',
    styleUrls: ['./project-calendar.component.scss'],
    standalone: true,
    imports: [
        MonthPickerComponent,
        MatButtonModule,
        CalendarMonthModule,
        AsyncPipe,
        UpperCasePipe,
        SlicePipe,
        CalendarCommonModule,
        MatIconModule
    ]
})
export class ProjectCalendarComponent implements OnInit, OnDestroy {
    @Output() readonly onChangeProjectsForMonth = new EventEmitter<ProjectWithDays[]>();
    destroy$ = new Subject<void>();
    direction$ = new BehaviorSubject<Direction | null>(null);
    filteredProjects$ = new BehaviorSubject<Set<number>>(new Set());
    selectedDays$ = new BehaviorSubject<Set<CalendarMonthViewDay>>(new Set());
    viewDate$ = new BehaviorSubject<Date>(new Date());
    refresh$ = new BehaviorSubject<boolean>(true);
    employeeId$ = new BehaviorSubject<number>(null);
    employee: PersonnelAccount;
    timeOffKind = TimeOffKind;
    view: CalendarView = CalendarView.Month;
    canReassignProject = false;
    projects: Project[];
    events: CalendarEvent[] = [];
    previousValue: CellEditDialogData;
    allowedProjects: Project[] = [];

    constructor(
        private dialog: MatDialog,
        public timesheetService: HermesTimesheetService,
        private route: ActivatedRoute,
        private hermesProjectService: HermesProjectService,
        public employeeService: HermesEmployeeService,
        public notificationService: NotificationService,
        public taskService: HermesTaskService,
        public accountService: AccountService,
        private cdr: ChangeDetectorRef
    ) {}

    @Input() set employeeId(value: number) {
        this.employeeId$.next(value);
    }

    @Input() set filteredProjects(value: Set<number>) {
        this.filteredProjects$.next(value);
    }

    @HostListener('document:keydown.alt.arrowright', ['$event']) onAltArrowRight(
        event: KeyboardEvent
    ): void {
        event.preventDefault();
        this.direction$.next(Direction.Right);
        setTimeout(() => this.direction$.next(null));
    }

    @HostListener('document:keydown.alt.arrowleft', ['$event']) onAltArrowLeft(
        event: KeyboardEvent
    ): void {
        event.preventDefault();
        this.direction$.next(Direction.Left);
        setTimeout(() => this.direction$.next(null));
    }

    ngOnInit(): void {
        combineLatest([
            this.viewDate$.asObservable(),
            this.employeeId$.asObservable(),
            this.refresh$.asObservable()
        ])
            .pipe(
                takeUntil(this.destroy$),
                switchMap(([date, employeeId]) =>
                    combineLatest([
                        this.accountService.profile$.asObservable().pipe(
                            takeUntil(this.destroy$),
                            filter((profile) => profile instanceof PersonnelAccount)
                        ),
                        this.timesheetService
                            .getMonthlyTimesheetForEmployee(
                                date.getFullYear(),
                                date.getMonth() + 1,
                                employeeId
                            )
                            .pipe(
                                takeUntil(this.destroy$),
                                map((timesheet) => timesheet.cells)
                            ),
                        this.hermesProjectService.getProjects().pipe(
                            takeUntil(this.destroy$),
                            map((collection) => collection.items)
                        ),
                        this.employeeService.getEmployee(employeeId).pipe(takeUntil(this.destroy$))
                    ])
                ),
                tap(([profile, , projects, employee]) => {
                    this.canReassignProject =
                        profile.isSuperadmin ||
                        (profile.isOfficeManager && profile.officeId === employee.officeId);

                    this.employee = employee;
                    this.projects = projects;
                    this.allowedProjects = projects;

                    // TODO: temporarily disabled due to project manager confusion
                    /*
                    if (profile.isSuperadmin) {
                        this.allowedProjects = projects;
                    } else if (profile.isOfficeManager) {
                        this.allowedProjects = projects.filter((item) => item.leadingOfficeId === profile.officeId);
                    } else {
                        this.allowedProjects = projects.filter((item) => item.supervisorId === profile.id);
                    }
                    */
                }),
                map(([, cells, projects]) => {
                    const projectMap = projects.reduce((m, project) => {
                        m.set(project.id, project);
                        return m;
                    }, new Map<number, Project>());

                    const projectsForMonth = new Set<Project>(
                        cells
                            .map((cell) => projectMap.get(cell.projectId))
                            .filter((project) => project instanceof Project)
                    );

                    // FIXME: Need to be replaced by reduce
                    const projectWithDays = [...projectsForMonth.values()].map((project) => {
                        return {
                            project,
                            days: cells.filter((cell) => cell.projectId === project.id).length
                        } as ProjectWithDays;
                    });

                    const calendarEvents: CalendarEvent[] = cells.map((cell) => {
                        const project = projectMap.get(cell.projectId);

                        return {
                            start: cell.cellDate,
                            end: cell.cellDate,
                            title:
                                cell.projectName || TimeOffKind.getDescription(cell.timeOff) || '',
                            color: new Color(
                                project?.color
                                    ? `${project?.color}C0`
                                    : cell.timeOff && !cell.projectId
                                      ? '#D5A6BDC0'
                                      : BackgroundCell.Empty
                            ),
                            meta: {
                                cell,
                                cellId: cell.id,
                                timeOff: cell.timeOff,
                                projectId: cell.projectId,
                                protected: cell.isProtected
                            }
                        } as CalendarEvent;
                    });

                    return [calendarEvents, projectWithDays];
                })
            )
            .subscribe(([events, projectWithDays]: [CalendarEvent[], ProjectWithDays[]]) => {
                this.events = events;
                this.cdr.detectChanges();
                this.onChangeProjectsForMonth.emit(projectWithDays);
            });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.direction$.complete();
        this.filteredProjects$.complete();
        this.refresh$.complete();
        this.viewDate$.complete();
        this.employeeId$.complete();
    }

    onChangeDate(newDate: Date): void {
        this.viewDate$.next(newDate);
    }

    getColorEventDay(day: CalendarMonthViewDay): string {
        if (day.inMonth) {
            return day.events.length > 0 ? day.events[0].color.primary : BackgroundCell.Empty;
        }

        return BackgroundCell.AnotherMonth;
    }

    getTitleEventDay(day: CalendarMonthViewDay): string {
        return day.events.length > 0 && Boolean(day.events[0].title) ? day.events[0].title : '';
    }

    checkIsEmptyMonthDay(day: CalendarMonthViewDay): boolean {
        return this.events.length
            ? day.inMonth && !day.events[0]?.meta.timeOff && !day.events[0]?.meta.projectId
            : false;
    }

    isWeekend(date: Date): boolean {
        return date.getDay() === 6 || date.getDay() === 0;
    }

    protectCells(): void {
        const request = new BulkTimesheetAllocate();
        const timesheetSelector = new TimesheetSelector();
        timesheetSelector.ids = this.events.map((event) => Number(event.meta.cellId));
        request.cells = timesheetSelector;

        this.timesheetService
            .protectTimesheetCellBulk(request)
            .pipe(take(1))
            .subscribe(() => {
                this.refresh$.next(true);
            });
    }

    unprotectCells(): void {
        const request = new BulkTimesheetAllocate();
        const timesheetSelector = new TimesheetSelector();
        timesheetSelector.ids = this.events.map((event) => Number(event.meta.cellId));
        request.cells = timesheetSelector;

        this.timesheetService
            .unprotectTimesheetCellBulk(request)
            .pipe(take(1))
            .subscribe(() => this.refresh$.next(true));
    }

    getPreferredProjectId(day?: CalendarMonthViewDay): number {
        const projectMap = this.events
            .filter((event) => Boolean(event.meta.projectId))
            .map((event) => Number(event.meta.projectId))
            .reduce((m, projectId) => {
                const count = m.has(projectId) ? m.get(projectId) : 0;
                m.set(projectId, count + 1);
                return m;
            }, new Map<number, number>());
        let preferredProjectId: number = Number(day?.events[0].meta.projectId) || null;
        if (!preferredProjectId && projectMap.size > 0) {
            preferredProjectId = Array.from(projectMap.entries())
                .sort(([, count1], [, count2]) => (count1 > count2 ? -1 : 1))
                .map(([projectId, _]) => projectId)
                .shift();
        }
        return preferredProjectId;
    }

    onRightClick(day: CalendarMonthViewDay, ctrlKey: boolean): false {
        if (!day.inMonth) {
            return false;
        }

        const cells = new Set<TimesheetCell>();
        const selectedDays = this.selectedDays$.getValue();

        if (!ctrlKey && !selectedDays.has(day)) {
            selectedDays.clear();
        }

        selectedDays.add(day);
        this.selectedDays$.next(selectedDays);
        selectedDays.forEach((elem) => cells.add(elem.events[0].meta.cell));
        cells.add(day.events[0].meta.cell);

        const dialogRef = this.dialog
            .open(CellEditDialogComponent, {
                data: {
                    previousValue: this.previousValue,
                    preferredProjectId: this.getPreferredProjectId(day),
                    cells: [...cells],
                    projects: this.allowedProjects
                } as TimesheetCellData
            })
            .afterClosed()
            .pipe(takeUntil(this.destroy$), take(1))
            .subscribe((result) => {
                this.sendRequests(result, cells);
            });
        return false;
    }

    sendRequests(result: CellEditDialogData | null, selectedCells: Set<TimesheetCell>): void {
        let selectedCellsArray = Array.from(selectedCells);
        let cellObs: null | Observable<TimesheetCell[]> = null;
        let allocateObs = [];

        if (result) {
            this.previousValue = result;

            if (!result.overwriteWeekend) {
                selectedCellsArray = selectedCellsArray.filter(
                    (item) => !this.isWeekend(item.cellDate)
                );
            }

            if (!result.applyAbsence) {
                selectedCellsArray = selectedCellsArray.filter((item) => !item.timeOff);
            }

            const availableCells = selectedCellsArray
                .filter((cell) => !cell.isProtected)
                .map((cell) => cell.id);

            switch (result.occupancy) {
                case Occupancy.Deallocate: {
                    const request = new BulkTimesheetAction();
                    const selector = new TimesheetSelector();
                    selector.ids = availableCells;
                    request.cells = selector;

                    cellObs = this.timesheetService.resetTimesheetCellBulk(request);
                    break;
                }

                case Occupancy.Project: {
                    const request = new BulkTimesheetAllocate();
                    const selector = new TimesheetSelector();
                    selector.ids = availableCells;
                    request.cells = selector;
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    request.projectId = result.value.id as number;

                    cellObs = this.timesheetService.allocateTimesheetCellBulk(request);

                    if (result.assignToProject) {
                        allocateObs = selectedCellsArray.map((cell) => {
                            const req = new EmployeeAlloc();
                            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                            // @ts-ignore
                            req.projectId = result.value.id as number;
                            return this.employeeService.allocateEmployee(req, cell.personnelId);
                        });
                    }

                    break;
                }

                case Occupancy.Absence: {
                    const request = new BulkTimesheetTimeOff();
                    const selector = new TimesheetSelector();
                    selector.ids = availableCells;
                    request.timeOff = result.value as TimeOffKind;
                    request.cells = selector;
                    cellObs = this.timesheetService.setTimesheetCellOffBulk(request);
                    break;
                }

                case Occupancy.Protect: {
                    const request = new BulkTimesheetAction();
                    const selector = new TimesheetSelector();
                    selector.ids = selectedCellsArray
                        .filter((cell) => !cell.isProtected)
                        .map((cell) => cell.id);
                    request.cells = selector;
                    cellObs = this.timesheetService.protectTimesheetCellBulk(request);
                    break;
                }

                case Occupancy.Unprotect: {
                    const request = new BulkTimesheetAction();
                    const selector = new TimesheetSelector();
                    selector.ids = selectedCellsArray
                        .filter((cell) => cell.isProtected)
                        .map((cell) => cell.id);
                    request.cells = selector;
                    cellObs = this.timesheetService.unprotectTimesheetCellBulk(request);
                    break;
                }

                default:
                    break;
            }

            if (cellObs !== null) {
                cellObs.pipe(takeUntil(this.destroy$), take(1)).subscribe((response) => {
                    this.refresh$.next(true);
                    this.notificationService.success(
                        `Successfully updated ${response.length} ${
                            response.length === 1 ? 'cell' : 'cells'
                        }`
                    );
                });
            }

            if (allocateObs.length) {
                combineLatest(allocateObs)
                    .pipe(takeUntil(this.destroy$), take(1))
                    .subscribe((response: PersonnelAccount[]) => {
                        if (response.length) {
                            this.refresh$.next(true);
                        }
                    });
            }
        }
    }

    selectCell(
        day: CalendarMonthViewDay,
        selectedDays: Set<CalendarMonthViewDay>,
        ctrlKey: boolean
    ): void {
        if (!day.inMonth) {
            return;
        }

        if (!ctrlKey) {
            selectedDays.clear();
        }

        if (!selectedDays.has(day)) {
            selectedDays.add(day);
        } else {
            selectedDays.delete(day);
        }

        this.selectedDays$.next(selectedDays);
    }

    showCellHistory(selectedDays: Set<CalendarMonthViewDay>): void {
        const selectedCells = new Set<TimesheetCell>();
        selectedDays.forEach((elem) => selectedCells.add(elem.events[0].meta.cell));
        this.dialog.open(HistoryDialogComponent, {
            autoFocus: false,

            data: {
                date: new Date(),
                entity: [...selectedCells]
            } as HistoryDialogData
        });
    }
}
