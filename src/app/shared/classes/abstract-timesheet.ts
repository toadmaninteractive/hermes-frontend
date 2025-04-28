import { MatDialog } from '@angular/material/dialog';
import { Component, HostListener, OnDestroy } from '@angular/core';
import { filter, switchMap, take, takeUntil, tap } from 'rxjs/operators';
import { BehaviorSubject, combineLatest, from, Observable, of, Subject } from 'rxjs';
import {
    Office,
    PersonnelAccount,
    Project,
    Team,
    TimeOffKind,
    TimesheetCell
} from '../../protocol/db-protocol';
import {
    CellEditDialogData,
    Occupancy
} from '../../components/table-grid/cell-edit-dialog/cell-edit-dialog.component';
import {
    BulkTimesheetAction,
    BulkTimesheetAllocate,
    BulkTimesheetProtect,
    BulkTimesheetTimeOff,
    EmployeeAlloc,
    MonthlyEmployeeTimesheet,
    SyncBambooTaskRequest,
    TeamError,
    TimesheetSelector
} from '../../protocol/web-protocol';
import { HermesEmployeeService } from '../../protocol/web-employee-protocol.service';
import { HermesTimesheetService } from '../../protocol/timesheet-protocol.service';
import { NotificationService } from '../../core/services/notification.service';
import { HermesTaskService } from '../../protocol/task-protocol.service';
import {
    BadRequestError,
    ForbiddenError,
    InternalServerError,
    NotFoundError
} from '../../protocol/data-protocol';
import { OneInputDialogComponent } from '../../components/one-input-dialog/one-input-dialog.component';
import { Empty } from '../../protocol/common-protocol';
import { Direction } from '../enums/direction.enum';
import { KeyboardNav } from '../interfaces/keyboard-nav.interface';
import { PseudoClipboardService } from '../../core/services/pseudo-clipboard.service';
import { CacheService } from '../../core/services/cache.service';
import { ExtendedCell } from '../interfaces/extended-cell.interface';
import {
    ConfirmDialogComponent,
    ConfirmInputData,
    ConfirmResultData
} from '../../components/table-grid/confirm-dialog/confirm-dialog.component';
import { OverlayService } from '../../core/services/overlay.service';
import { OneInputDialogData } from '../interfaces/dialog-data.interface';
import { ConfirmationService } from '../../components/confirmation/confirmation.service';

@Component({
    template: '',
    standalone: true
})
export class AbstractTimesheetComponent {
    destroy$ = new Subject<void>();
    direction$ = new BehaviorSubject<Direction | null>(null);
    navDirection$ = new BehaviorSubject<KeyboardNav | null>(null);
    enterPressedEvent$ = new BehaviorSubject<KeyboardEvent>(null);
    loading$ = new BehaviorSubject<boolean>(false);
    refreshTimesheet$ = new BehaviorSubject<boolean>(false);
    synchronizing$ = new BehaviorSubject<boolean>(false);
    updatedCells$ = new BehaviorSubject<TimesheetCell | TimesheetCell[] | null>(null);
    updatedEmployees$ = new BehaviorSubject<PersonnelAccount | PersonnelAccount[] | null>(null);
    timesheet$ = new BehaviorSubject<MonthlyEmployeeTimesheet[] | null>(null);

    previousValue: CellEditDialogData;
    selectedCells: Set<TimesheetCell> = new Set();

    constructor(
        public employeeService: HermesEmployeeService,
        public notificationService: NotificationService,
        public overlayService: OverlayService,
        public taskService: HermesTaskService,
        public timesheetService: HermesTimesheetService,
        public pseudoClipboardService: PseudoClipboardService,
        public dialog: MatDialog,
        public cacheService: CacheService,
        protected confirmationService: ConfirmationService
    ) {}

    @HostListener('window:keydown.alt.arrowright', ['$event']) onAltArrowRight(
        event: KeyboardEvent
    ): void {
        event.preventDefault();
        this.direction$.next(Direction.Right);
        setTimeout(() => this.direction$.next(null));
    }

    @HostListener('window:keydown.alt.arrowleft', ['$event']) onAltArrowLeft(
        event: KeyboardEvent
    ): void {
        event.preventDefault();
        this.direction$.next(Direction.Left);
        setTimeout(() => this.direction$.next(null));
    }

    @HostListener('window:keydown', ['$event'])
    onControlArrowLeft(event: KeyboardEvent): void {
        let direction: Direction = Direction.Unset;
        switch (event.code) {
            case 'ArrowLeft':
                direction = Direction.Left;
                break;
            case 'ArrowRight':
                direction = Direction.Right;
                break;
            case 'ArrowUp':
                direction = Direction.Up;
                break;
            case 'ArrowDown':
                direction = Direction.Down;
                break;
            case 'Enter': {
                this.overlayService.isDialogDisplayed$
                    .pipe(take(1), takeUntil(this.destroy$))
                    .subscribe((displayed) => {
                        if (!displayed) {
                            this.enterPressedEvent$.next(event);
                        }
                    });
                break;
            }
            case 'Insert': {
                if (event.ctrlKey) {
                    this.copyToClipboard();
                }

                if (event.shiftKey) {
                    this.pasteFromClipboard();
                }
                break;
            }
            case 'KeyC': {
                if (event.ctrlKey) {
                    this.copyToClipboard();
                }
                break;
            }

            case 'KeyV': {
                if (event.ctrlKey && this.selectedCells.size) {
                    this.pasteFromClipboard();
                }
                break;
            }

            case 'Delete': {
                if (this.selectedCells.size) {
                    this.clearCells();
                }
                break;
            }
            default:
                break;
        }

        if (direction) {
            event.preventDefault();
            this.navDirection$.next({ direction, isShiftPressed: event.shiftKey } as KeyboardNav);
        }
    }

    completeSubjects(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.direction$.complete();
        this.loading$.complete();
        this.refreshTimesheet$.complete();
        this.synchronizing$.complete();
        this.timesheet$.complete();
        this.updatedCells$.complete();
        this.updatedEmployees$.complete();
    }

    getPreferredProject(
        selectedCells: Set<TimesheetCell>,
        employeesIdArray: number[],
        projectAllocations: Map<number, number>
    ): number {
        const selectedCellsArray = Array.from(selectedCells);
        let projectMap = selectedCellsArray
            .filter((cell) => Boolean(cell.projectId))
            .map((cell) => cell.projectId)
            .reduce((m, projectId) => {
                const count = m.has(projectId) ? m.get(projectId) : 0;
                m.set(projectId, count + 1);
                return m;
            }, new Map<number, number>());

        // Assume current project ID if timesheet is project-based
        let preferredProjectId: number = null;

        // Assume project with most allocations if not set yet
        if (projectMap.size > 0) {
            preferredProjectId = Array.from(projectMap.entries())
                .sort(([, count1], [, count2]) => (count1 > count2 ? -1 : 1))
                .map(([projectId, _]) => projectId)
                .shift();
        }

        // Assume project with most assignments within the selection range if not set yet
        if (!preferredProjectId) {
            projectMap = employeesIdArray
                .map((employeeId) =>
                    projectAllocations.has(employeeId) ? projectAllocations.get(employeeId) : null
                )
                .filter((projectId) => typeof projectId === 'number')
                .reduce((m, projectId) => {
                    const count = m.has(projectId) ? m.get(projectId) : 0;
                    m.set(projectId, count + 1);
                    return m;
                }, new Map<number, number>());

            if (projectMap.size > 0) {
                preferredProjectId = Array.from(projectMap.entries())
                    .sort(([, count1], [, count2]) => (count1 > count2 ? -1 : 1))
                    .map(([projectId, _]) => projectId)
                    .shift();
            }
        }

        // Assume project with most assignments within the monthly timesheet if not set yet
        if (!preferredProjectId) {
            projectMap = Array.from(projectAllocations.values())
                .filter((projectId) => typeof projectId === 'number')
                .reduce((m, projectId) => {
                    const count = m.has(projectId) ? m.get(projectId) : 0;
                    m.set(projectId, count + 1);
                    return m;
                }, new Map<number, number>());

            if (projectMap.size > 0) {
                preferredProjectId = Array.from(projectMap.entries())
                    .sort(([, count1], [, count2]) => (count1 > count2 ? -1 : 1))
                    .map(([projectId, _]) => projectId)
                    .shift();
            }
        }
        return preferredProjectId;
    }

    sendRequests(
        result: CellEditDialogData | null,
        selectedCells: Set<TimesheetCell>,
        silent = false
    ): Observable<number> {
        let selectedCellsArray = Array.from(selectedCells);
        let cellObs: null | Observable<TimesheetCell[]> = null;
        let allocateObs = [];
        let updatedCellsCount = 0;

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
                    const request = new BulkTimesheetProtect();
                    const selector = new TimesheetSelector();
                    selector.ids = selectedCellsArray
                        .filter((cell) => !cell.isProtected)
                        .map((cell) => cell.id);
                    request.cells = selector;
                    request.comment = result.comment || null;
                    cellObs = this.timesheetService.protectTimesheetCellBulk(request);
                    break;
                }

                case Occupancy.Unprotect: {
                    const request = new BulkTimesheetProtect();
                    const selector = new TimesheetSelector();
                    selector.ids = selectedCellsArray
                        .filter((cell) => cell.isProtected)
                        .map((cell) => cell.id);
                    request.cells = selector;
                    request.comment = result.comment || null;
                    cellObs = this.timesheetService.unprotectTimesheetCellBulk(request);
                    break;
                }

                default:
                    break;
            }

            if (cellObs !== null) {
                cellObs.pipe(takeUntil(this.destroy$), take(1)).subscribe((response) => {
                    this.updatedCells$.next(response);
                    if (!silent) {
                        this.notificationService.success(
                            `Successfully updated ${response.length} ${
                                response.length === 1 ? 'cell' : 'cells'
                            }`
                        );
                    }
                    updatedCellsCount = response.length;
                });
            }

            if (allocateObs.length) {
                combineLatest(allocateObs)
                    .pipe(takeUntil(this.destroy$), take(1))
                    .subscribe((response: PersonnelAccount[]) => {
                        if (response.length) {
                            this.updatedEmployees$.next(response);
                            this.cacheService.reloadEmployees();
                        }
                    });
            }

            return of(updatedCellsCount);
        }
        return of(0);
    }

    isWeekend(date: Date): boolean {
        return date.getDay() === 6 || date.getDay() === 0;
    }

    isAllCellProtected(timesheet: MonthlyEmployeeTimesheet[]): boolean {
        return timesheet.every((employeeTimesheet) =>
            employeeTimesheet.cells.every((cell) => cell && cell.isProtected)
        );
    }

    isAllCellUnprotected(timesheet: MonthlyEmployeeTimesheet[]): boolean {
        return timesheet.every((employeeTimesheet) =>
            employeeTimesheet.cells.every((cell) => cell && !cell.isProtected)
        );
    }

    protectTimesheet(timesheet: MonthlyEmployeeTimesheet[]): void {
        const cells = timesheet
            .map((mt) => mt.cells)
            .reduce((acc, val) => acc.concat(val), [])
            .filter((cell) => !cell.isProtected)
            .map((cell) => cell.id);

        const request = new BulkTimesheetAction();
        const selector = new TimesheetSelector();
        selector.ids = cells;
        request.cells = selector;
        this.timesheetService
            .protectTimesheetCellBulk(request)
            .pipe(takeUntil(this.destroy$), take(1))
            .subscribe(() => {
                this.refreshTimesheet$.next(true);
                this.notificationService.success(`The timesheet successfully protected`);
            });
    }

    unprotectTimesheet(timesheet: MonthlyEmployeeTimesheet[]): void {
        const cells = timesheet
            .map((mt) => mt.cells)
            .reduce((acc, val) => acc.concat(val), [])
            .filter((cell) => cell.isProtected)
            .map((cell) => cell.id);

        this.dialog
            .open<OneInputDialogComponent, OneInputDialogData, string | undefined | null>(
                OneInputDialogComponent,
                {
                    data: { header: 'Unlock', input: '' }
                }
            )
            .afterClosed()
            .pipe(take(1), takeUntil(this.destroy$))
            .subscribe((comment) => {
                if (comment !== null && comment !== undefined) {
                    const request = new BulkTimesheetProtect();
                    const selector = new TimesheetSelector();
                    selector.ids = cells;
                    request.cells = selector;
                    request.comment = comment;
                    this.timesheetService
                        .unprotectTimesheetCellBulk(request)
                        .pipe(take(1), takeUntil(this.destroy$))
                        .subscribe(() => {
                            this.refreshTimesheet$.next(true);
                            this.notificationService.success(
                                `The timesheet successfully unprotected`
                            );
                        });
                }
            });
    }

    onSynchronize(destination: Office | Team | Project, date: Date): void {
        const request = new SyncBambooTaskRequest();

        if (destination instanceof Office) {
            request.officeId = destination.id;
        } else if (destination instanceof Project) {
            request.projectId = destination.id;
        } else if (destination instanceof Team) {
            request.teamId = destination.id;
        }

        this.synchronizing$.next(true);

        this.taskService
            .syncBamboo(request, date.getUTCFullYear(), date.getMonth() + 1)
            .pipe(takeUntil(this.destroy$), take(1))
            .subscribe(
                (response) => {
                    this.synchronizing$.next(false);

                    if (response.result) {
                        this.refreshTimesheet$.next(true);
                        this.notificationService.success('Synchronized successfully');
                        this.notificationService.success('Reloading data...');
                    } else {
                        this.notificationService.error('Synchronization failed');
                    }
                },
                (error) => {
                    if (error instanceof ForbiddenError) {
                        const errorMessage = 'You have no rights for synchronizing with BambooHR';
                        this.notificationService.error(errorMessage);
                    } else {
                        this.notificationService.error(error);
                    }
                    this.synchronizing$.next(false);
                }
            );
    }

    onRegenerate(date: Date): void {
        const request = new Empty();
        this.timesheetService
            .regenerateTimesheetCells(request, date.getFullYear(), date.getMonth() + 1)
            .pipe(
                takeUntil(this.destroy$),
                tap(() => this.synchronizing$.next(true))
            )
            .subscribe({
                next: (response) => {
                    this.synchronizing$.next(false);
                    if (response.result) {
                        this.refreshTimesheet$.next(true);
                        this.notificationService.success('Regenerate successfully');
                        this.notificationService.success('Reloading data...');
                    } else {
                        this.notificationService.error('Regeneration failed');
                    }
                },
                error: (error) => {
                    if (error instanceof ForbiddenError) {
                        const errorMessage = 'You have no rights for regenerate cells';
                        this.notificationService.error(errorMessage);
                    }
                    this.synchronizing$.next(false);
                }
            });
    }

    onRangeSelected(cells: Set<TimesheetCell>): void {
        this.selectedCells = cells;
    }

    handleBadRequestError(
        error: BadRequestError<TeamError> | ForbiddenError | NotFoundError | InternalServerError
    ): void {
        let errorMessage: string = null;

        if (error instanceof BadRequestError) {
            switch (error.error) {
                case TeamError.CreatedByNotExists:
                    errorMessage = 'Created by field does not exists';
                    break;
                case TeamError.InvalidCreatedBy:
                    errorMessage = 'Invalid created by property';
                    break;
                case TeamError.InvalidTitle:
                    errorMessage = 'Invalid title';
                    break;
                case TeamError.TitleAlreadyExists:
                    errorMessage = 'Title already exists';
                    break;
                default:
                    break;
            }
        } else if (error instanceof ForbiddenError) {
            errorMessage = 'Forbidden';
        } else if (error instanceof NotFoundError) {
            errorMessage = 'Not found';
        } else if (error instanceof InternalServerError) {
            errorMessage = 'Internal server error';
        }

        this.notificationService.error(errorMessage);
    }

    getCellOccupancy(cell: TimesheetCell): Occupancy {
        if (cell.isProtected) {
            return Occupancy.Protect;
        }
        if (cell.projectId) {
            return Occupancy.Project;
        }
        if (cell.timeOff) {
            return Occupancy.Absence;
        }
        return Occupancy.Deallocate;
    }

    getCellValue(cell: TimesheetCell): Project | TimeOffKind | null {
        if (cell.projectId) {
            const result = new Project();
            result.id = cell.projectId;
            return result;
        }

        if (cell.timeOff) {
            return cell.timeOff;
        }

        return null;
    }

    getRowCellIndex(cell: TimesheetCell, timesheets: MonthlyEmployeeTimesheet[]): number {
        return timesheets
            .filter((t) => t.cells.length)
            .findIndex((tc) => tc.personnelId === cell.personnelId);
    }

    getColCellIndex(cell: TimesheetCell, timesheets: MonthlyEmployeeTimesheet[]): number {
        return timesheets
            .filter((t) => t.cells.length)[0]
            .cells.findIndex((tc) => tc.cellDate.getTime() === cell.cellDate.getTime());
    }

    getCell(
        timesheets: MonthlyEmployeeTimesheet[],
        rowIndex: number,
        colIndex: number
    ): TimesheetCell | null {
        const row = timesheets.filter((t) => t.cells.length)[rowIndex];
        const cells = row ? row.cells : null;

        return cells ? cells[colIndex] : null;
    }

    convertTextToSetCells(str: string, projects: Project[]): Set<ExtendedCell> | undefined {
        try {
            str = str.split('\r').join('');
            const rows = str.split('\n');
            const rowsLength = str.split('\n').length;
            const colsLength = Math.max(...rows.map((row) => row.split('\t').length));

            const table = str.split('\n').map((row) => row.split('\t'));
            const result = new Set(
                table
                    .map((row, rowIndex) =>
                        row.map((cellValue, colIndex) => {
                            const cell = new TimesheetCell();
                            cell.projectId = this.getProjectId(cellValue, projects);
                            cell.projectName = cell.projectId ? cellValue : null;
                            cell.timeOff = this.getTimeOffKind(cellValue);
                            const extendedCell = {} as ExtendedCell;
                            extendedCell.cell = cell;
                            extendedCell.colIndex = colIndex;
                            extendedCell.rowIndex = rowIndex;
                            if (cellValue && !cell.projectId && !cell.timeOff) {
                                throw new Error(`Clipboard have unexpected value ${cellValue}`);
                            }
                            return extendedCell;
                        })
                    )
                    .reduce((acc, curr) => {
                        return acc.concat(curr);
                    }, [])
            );
            if (result.size !== colsLength * rowsLength) {
                throw new Error('Clipboard doesn`t fit to table');
            }
            return result;
        } catch (e) {
            this.notificationService.error(e.message);
            return undefined;
        }
    }

    getProjectId(projectName: string, projects: Project[]): number | null {
        return projects.find((project) => project.title === projectName)?.id || null;
    }

    getTimeOffKind(timeoffKey: string): TimeOffKind | undefined {
        try {
            return TimeOffKind.fromJsonKey(timeoffKey);
        } catch {
            return null;
        }
    }

    pasteFromOneCell(sourceCell: ExtendedCell, timesheet: MonthlyEmployeeTimesheet[]): void {
        let selectedTimesheetCells = Array.from(this.selectedCells);
        const targetStartRowIndex = Math.min(
            ...selectedTimesheetCells.map((cell) => this.getRowCellIndex(cell, timesheet))
        );
        const targetLastRowIndex = Math.max(
            ...selectedTimesheetCells.map((cell) => this.getRowCellIndex(cell, timesheet))
        );
        const targetStartColIndex = Math.min(
            ...selectedTimesheetCells.map((cell) => this.getColCellIndex(cell, timesheet))
        );
        const targetLastColIndex = Math.max(
            ...selectedTimesheetCells.map((cell) => this.getColCellIndex(cell, timesheet))
        );
        if (!this.checkSelectedCellsIsSquare(timesheet)) {
            selectedTimesheetCells = timesheet
                .map((mt, index) => {
                    if (index >= targetStartRowIndex && index <= targetLastRowIndex) {
                        return mt.cells.filter(
                            (cell, colIndex) =>
                                colIndex >= targetStartColIndex && colIndex <= targetLastColIndex
                        );
                    }
                    return [];
                })
                .reduce((acc, val) => acc.concat(val), [])
                .filter(Boolean);
        }

        const selectedCells = selectedTimesheetCells
            .map((cell) => {
                return {
                    cell,
                    rowIndex: this.getRowCellIndex(cell, timesheet),
                    colIndex: this.getColCellIndex(cell, timesheet)
                } as ExtendedCell;
            })
            .sort((a, b) => (a.rowIndex < b.rowIndex || a.colIndex < b.colIndex ? -1 : 1));

        const targetCells = Array.from(this.selectedCells)
            .map((cell) => {
                return {
                    cell,
                    rowIndex: this.getRowCellIndex(cell, timesheet),
                    colIndex: this.getColCellIndex(cell, timesheet)
                } as ExtendedCell;
            })
            .sort((a, b) => (a.rowIndex < b.rowIndex || a.colIndex < b.colIndex ? -1 : 1));

        this.dialog
            .open(ConfirmDialogComponent, {
                data: { sourceCells: [sourceCell], selectedCells, targetCells } as ConfirmInputData
            })
            .afterClosed()
            .pipe(take(1), takeUntil(this.destroy$))
            .subscribe((result: ConfirmResultData | null) => {
                if (result) {
                    const request = {
                        occupancy: this.getCellOccupancy(sourceCell.cell),
                        value: this.getCellValue(sourceCell.cell),
                        overwriteWeekend: result.overwriteWeekend,
                        assignToProject: false,
                        applyAbsence: result.applyAbsence,
                        comment: 'placed from clipboard'
                    } satisfies CellEditDialogData;
                    this.sendRequests(request, this.selectedCells);
                }
            });
    }

    pasteFromManyCells(sourceCells: ExtendedCell[], timesheet: MonthlyEmployeeTimesheet[]): void {
        const selectedTimesheetCells = Array.from(this.selectedCells);
        const targetStartRowIndex = this.getRowCellIndex(selectedTimesheetCells[0], timesheet);
        const targetStartColIndex = this.getColCellIndex(selectedTimesheetCells[0], timesheet);
        const selectedCells = selectedTimesheetCells
            .map((cell) => {
                return {
                    cell,
                    rowIndex: this.getRowCellIndex(cell, timesheet),
                    colIndex: this.getColCellIndex(cell, timesheet)
                } as ExtendedCell;
            })
            .sort((a, b) => (a.rowIndex < b.rowIndex || a.colIndex < b.colIndex ? -1 : 1));

        const rowShift = targetStartRowIndex - sourceCells[0].rowIndex;
        const colShift = targetStartColIndex - sourceCells[0].colIndex;

        const rowIndexArray = Array.from(
            new Set(selectedCells.map((sc) => sc.rowIndex).sort((a, b) => (a > b ? 1 : -1)))
        );
        const colIndexArray = Array.from(
            new Set(selectedCells.map((sc) => sc.colIndex).sort((a, b) => (a > b ? 1 : -1)))
        );

        const targetCells = this.getTargetCells(
            sourceCells,
            selectedCells,
            rowShift,
            colShift,
            timesheet,
            rowIndexArray,
            colIndexArray
        );

        const combinedTimeOffCells = this.filterTimeOffCells(targetCells, sourceCells);
        const combinedProjectCells = this.filterProjectCells(targetCells, sourceCells);
        const targetDeallocateCells = this.filterDeallocateCells(targetCells, sourceCells);

        let timeoffUpdates: Observable<number>;
        let projectsUpdates: Observable<number>;
        let deallocateUpdates: Observable<number>;

        this.dialog
            .open(ConfirmDialogComponent, {
                data: {
                    sourceCells,
                    selectedCells: this.selectedCells.size === 1 ? targetCells : selectedCells,
                    targetCells: selectedCells
                } as ConfirmInputData
            })
            .afterClosed()
            .pipe(take(1), takeUntil(this.destroy$))
            .subscribe((result: ConfirmResultData | null) => {
                if (result) {
                    Object.keys(combinedTimeOffCells).forEach((key) => {
                        const cells = combinedTimeOffCells[key];
                        timeoffUpdates = this.sendRequests(
                            {
                                occupancy: Occupancy.Absence,
                                value: TimeOffKind.fromJsonKey(key),
                                overwriteWeekend: result.overwriteWeekend,
                                assignToProject: false,
                                applyAbsence: result.applyAbsence,
                                comment: 'placed from clipboard'
                            } satisfies CellEditDialogData,
                            new Set(cells),
                            true
                        );
                    });

                    Object.keys(combinedProjectCells).forEach((key) => {
                        const cells = combinedProjectCells[key];
                        const project = new Project();
                        project.id = Number(key);
                        projectsUpdates = this.sendRequests(
                            {
                                occupancy: Occupancy.Project,
                                value: project,
                                overwriteWeekend: result.overwriteWeekend,
                                assignToProject: false,
                                applyAbsence: result.applyAbsence,
                                comment: 'placed from clipboard'
                            } as CellEditDialogData,
                            new Set(cells),
                            true
                        );
                    });

                    if (targetDeallocateCells.length) {
                        deallocateUpdates = this.sendRequests(
                            {
                                occupancy: Occupancy.Deallocate,
                                value: null,
                                overwriteWeekend: result.overwriteWeekend,
                                assignToProject: false,
                                applyAbsence: result.applyAbsence,
                                comment: 'placed from clipboard'
                            } as CellEditDialogData,
                            new Set(targetDeallocateCells.map((c) => c.cell)),
                            true
                        );
                    }

                    // combineLatest([timeoffUpdates, projectsUpdates, deallocateUpdates])
                    //     .pipe(takeUntil(this.destroy$))
                    //     .subscribe(([timeoffCellUpdates, projectsCellUpdates, deallocateCellUpdates]) => {
                    //         const sum = timeoffCellUpdates + projectsCellUpdates + deallocateCellUpdates;
                    //         this.notificationService.success(
                    //             `Successfully updated ${sum} ${sum === 1 ? 'cell' : 'cells'}`
                    //         );
                    //     });
                }
            });
    }

    getTargetCells(
        sourceCells: ExtendedCell[],
        selectedCells: ExtendedCell[],
        rowShift: number,
        colShift: number,
        timesheet: MonthlyEmployeeTimesheet[],
        rowIndexArray: number[],
        colIndexArray: number[]
    ): ExtendedCell[] {
        let targetCells: ExtendedCell[];
        if (selectedCells.length > 1) {
            targetCells = sourceCells
                .map((sourceCell) =>
                    selectedCells.find(
                        (cell) =>
                            sourceCell.colIndex ===
                                colIndexArray.findIndex((ind) => ind === cell.colIndex) &&
                            sourceCell.rowIndex ===
                                rowIndexArray.findIndex((ind) => ind === cell.rowIndex)
                    )
                )
                .filter(Boolean);
        } else {
            targetCells = sourceCells
                .map((sourceCell) => {
                    const cell = this.getCell(
                        timesheet,
                        sourceCell.rowIndex + rowShift,
                        sourceCell.colIndex + colShift
                    );

                    return cell
                        ? ({
                              cell,
                              rowIndex: this.getRowCellIndex(cell, timesheet),
                              colIndex: this.getColCellIndex(cell, timesheet)
                          } as ExtendedCell)
                        : null;
                })
                .filter(Boolean);
        }

        return targetCells;
    }

    filterTimeOffCells(
        targetCells: ExtendedCell[],
        sourceCells: ExtendedCell[]
    ): Array<Array<TimesheetCell>> {
        const rowIndexArray = Array.from(
            new Set(targetCells.map((sc) => sc.rowIndex).sort((a, b) => (a > b ? 1 : -1)))
        );
        const colIndexArray = Array.from(
            new Set(targetCells.map((sc) => sc.colIndex).sort((a, b) => (a > b ? 1 : -1)))
        );

        const targetTimeoffCells = targetCells.filter((cell) => {
            const sc = sourceCells.find((c) => {
                // console.log('colIndex', c, c.colIndex, colIndexArray, cell.colIndex);
                // console.log('rowIndex', c, c.rowIndex, rowIndexArray, cell.rowIndex);
                return (
                    c.colIndex === colIndexArray.findIndex((ind) => ind === cell.colIndex) &&
                    c.rowIndex === rowIndexArray.findIndex((ind) => ind === cell.rowIndex)
                );
            }).cell;
            const value = this.getCellValue(sc);
            return !(value instanceof Project) && value !== null;
        });

        const combinedTimeOffCells = targetTimeoffCells.reduce((acc, cell) => {
            const sc = sourceCells.find(
                (c) =>
                    c.colIndex === colIndexArray.findIndex((ind) => ind === cell.colIndex) &&
                    c.rowIndex === rowIndexArray.findIndex((ind) => ind === cell.rowIndex)
            ).cell;
            const value = this.getCellValue(sc);
            const key = TimeOffKind.toJsonKey(value as TimeOffKind) as string;
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(cell.cell);
            return acc as Array<TimesheetCell>;
        }, []);

        return combinedTimeOffCells as Array<Array<TimesheetCell>>;
    }

    filterProjectCells(
        targetCells: ExtendedCell[],
        sourceCells: ExtendedCell[]
    ): Array<Array<TimesheetCell>> {
        const rowIndexArray = Array.from(
            new Set(targetCells.map((sc) => sc.rowIndex).sort((a, b) => (a > b ? 1 : -1)))
        );
        const colIndexArray = Array.from(
            new Set(targetCells.map((sc) => sc.colIndex).sort((a, b) => (a > b ? 1 : -1)))
        );
        const targetProjectCells = targetCells.filter((cell) => {
            const sc = sourceCells.find(
                (c) =>
                    c.colIndex === colIndexArray.findIndex((ind) => ind === cell.colIndex) &&
                    c.rowIndex === rowIndexArray.findIndex((ind) => ind === cell.rowIndex)
            ).cell;
            const value = this.getCellValue(sc);
            return value instanceof Project;
        });

        const combinedProjectCells = targetProjectCells.reduce((acc, cell) => {
            const sc = sourceCells.find(
                (c) =>
                    c.colIndex === colIndexArray.findIndex((ind) => ind === cell.colIndex) &&
                    c.rowIndex === rowIndexArray.findIndex((ind) => ind === cell.rowIndex)
            ).cell;
            const value = this.getCellValue(sc);
            const key = (value as Project).id;
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(cell.cell);
            return acc as Array<TimesheetCell>;
        }, []);
        return combinedProjectCells as Array<Array<TimesheetCell>>;
    }

    filterDeallocateCells(
        targetCells: ExtendedCell[],
        sourceCells: ExtendedCell[]
    ): Array<ExtendedCell> {
        const rowIndexArray = Array.from(
            new Set(targetCells.map((sc) => sc.rowIndex).sort((a, b) => (a > b ? 1 : -1)))
        );
        const colIndexArray = Array.from(
            new Set(targetCells.map((sc) => sc.colIndex).sort((a, b) => (a > b ? 1 : -1)))
        );
        return targetCells.filter((cell) => {
            const sc = sourceCells.find(
                (c) =>
                    c.colIndex === colIndexArray.findIndex((ind) => ind === cell.colIndex) &&
                    c.rowIndex === rowIndexArray.findIndex((ind) => ind === cell.rowIndex)
            ).cell;
            const value = this.getCellValue(sc);
            return value === null;
        });
    }

    copyToClipboard(): void {
        this.timesheet$
            .asObservable()
            .pipe(take(1), takeUntil(this.destroy$))
            .subscribe((timesheet) => {
                this.pseudoClipboardService.savedCells$.next(
                    new Set(
                        Array.from(this.selectedCells).map((cell) => {
                            return {
                                cell,
                                rowIndex: this.getRowCellIndex(cell, timesheet),
                                colIndex: this.getColCellIndex(cell, timesheet)
                            } as ExtendedCell;
                        })
                    )
                );
            });
    }

    pasteFromClipboard(): void {
        try {
            navigator.clipboard.readText().then((result) => {
                try {
                    combineLatest([
                        this.timesheet$.asObservable(),
                        this.cacheService.projects$.asObservable()
                    ])
                        .pipe(takeUntil(this.destroy$), take(1))
                        .subscribe(([timesheet, projects]) => {
                            const savedCells = this.convertTextToSetCells(result, projects);
                            if (savedCells) {
                                const sourceCells = Array.from(savedCells).sort((a, b) =>
                                    a.rowIndex < b.rowIndex || a.colIndex < b.colIndex ? -1 : 1
                                );
                                if (sourceCells.length === 1) {
                                    this.pasteFromOneCell(sourceCells[0], timesheet);
                                } else if (this.checkSelectedCellsIsSquare(timesheet)) {
                                    this.pasteFromManyCells(sourceCells, timesheet);
                                }
                            }
                        });
                } catch (e) {
                    this.notificationService.error(e.message);
                }
            });
        } catch (e) {
            this.pseudoClipboardService.savedCells$
                .asObservable()
                .pipe(
                    take(1),
                    filter((cells) => cells.size > 0),
                    switchMap(() =>
                        this.confirmationService.fire({
                            data: {
                                title: 'Warning',
                                html: `Sorry clipboard is not available now. Do you want use data from in-app clipboard?`,
                                confirmText: 'Yes'
                            }
                        })
                    ),
                    filter(Boolean),
                    switchMap(() =>
                        combineLatest([
                            this.timesheet$.asObservable(),
                            this.pseudoClipboardService.savedCells$.asObservable()
                        ]).pipe(take(1))
                    )
                )
                .subscribe(([timesheet, savedCells]) => {
                    const sourceCells = Array.from(savedCells).sort((a, b) =>
                        a.rowIndex < b.rowIndex || a.colIndex < b.colIndex ? -1 : 1
                    );
                    if (sourceCells.length === 1) {
                        this.pasteFromOneCell(sourceCells[0], timesheet);
                    } else if (this.checkSelectedCellsIsSquare(timesheet)) {
                        this.pasteFromManyCells(sourceCells, timesheet);
                    }
                });
        }
    }

    clearCells(): void {
        this.timesheet$
            .asObservable()
            .pipe(take(1), takeUntil(this.destroy$))
            .subscribe((timesheet) => {
                const emptyCell = {
                    cell: new TimesheetCell(),
                    rowIndex: 0,
                    colIndex: 0
                } as ExtendedCell;
                this.pasteFromOneCell(emptyCell, timesheet);
            });
    }

    checkSelectedCellsIsSquare(timesheet: MonthlyEmployeeTimesheet[]): boolean {
        const selectedCells = Array.from(this.selectedCells)
            .map((cell) => {
                return {
                    cell,
                    rowIndex: this.getRowCellIndex(cell, timesheet),
                    colIndex: this.getColCellIndex(cell, timesheet)
                } as ExtendedCell;
            })
            .sort((a, b) => (a.rowIndex < b.rowIndex || a.colIndex < b.colIndex ? -1 : 1));

        const colsLength = new Set(selectedCells.map((c) => c.colIndex)).size;

        const rowsLength = new Set(selectedCells.map((c) => c.rowIndex)).size;

        try {
            if (selectedCells.length !== colsLength * rowsLength) {
                throw new Error('Selected area doesn`t fit to table');
            }
            return selectedCells.length === colsLength * rowsLength;
        } catch (e) {
            this.notificationService.error(e.message);
            return false;
        }
    }
}
