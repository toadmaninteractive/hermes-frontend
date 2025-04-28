import {
    ChangeDetectionStrategy,
    Component,
    ContentChild,
    ElementRef,
    EventEmitter,
    HostListener,
    Input,
    OnDestroy,
    OnInit,
    Output,
    Self,
    TemplateRef,
    ViewChild
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatInput } from '@angular/material/input';
import { MatFormField, MatSuffix } from '@angular/material/form-field';
import { NgTemplateOutlet, AsyncPipe, SlicePipe } from '@angular/common';
import { filter, map, switchMap, take, takeUntil, tap } from 'rxjs/operators';
import { BehaviorSubject, combineLatest, Subject } from 'rxjs';
import { NgClickOutsideDirective } from 'ng-click-outside2';
import { CacheService } from '../../core/services/cache.service';
import { WindowRefService } from '../../core/services/window-ref.service';
import { hexToRgbA } from '../../shared/functions/color';
import { MonthlyEmployeeTimesheet } from '../../protocol/web-protocol';
import { PersonnelAccount, Project, TimeOffKind, TimesheetCell } from '../../protocol/db-protocol';
import { Direction } from '../../shared/enums/direction.enum';
import { KeyboardNav } from '../../shared/interfaces/keyboard-nav.interface';
import { ProjectWithDays } from '../../shared/interfaces/days-spent-on-project.interface';
import { ProjectLegendComponent } from '../project-legend/project-legend.component';
import { MosaicLoaderComponent } from '../mosaic-loader/mosaic-loader.component';
import { ScrollTopComponent } from '../scroll-top/scroll-top.component';
import { FilterService } from '../../core/services/filter.service';
import { smoothOpacity, visible } from '../../shared/interfaces/animations';

@Component({
    selector: 'app-table-grid',
    templateUrl: './table-grid.component.html',
    styleUrls: ['./table-grid.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: [visible, smoothOpacity],
    standalone: true,
    imports: [
        MosaicLoaderComponent,
        MatFormField,
        MatInput,
        FormsModule,
        MatIconButton,
        MatSuffix,
        MatIcon,
        ProjectLegendComponent,
        NgTemplateOutlet,
        AsyncPipe,
        SlicePipe,
        NgClickOutsideDirective,
        ScrollTopComponent,
        ReactiveFormsModule
    ],
    providers: [FilterService]
})
export class TableGridComponent implements OnInit, OnDestroy {
    @ContentChild('menuTemplate') menuTemplate: TemplateRef<ElementRef>;
    @ContentChild('employeeColumn') employeeColumn: TemplateRef<{
        employee: PersonnelAccount;
        linkedList: unknown;
        vismaTooltip: string | null;
    }>;
    @ViewChild('tableWrapper', { read: ElementRef }) tableWrapper: ElementRef<HTMLDivElement>;

    @Input() loading = true;
    @Input() excludedEmployeeFromReport = new Set<number>();
    @Input() navDirection$: BehaviorSubject<KeyboardNav>;
    @Input() enterPressed$: BehaviorSubject<KeyboardEvent>;
    @Output() readonly rangeSelected = new EventEmitter<Set<TimesheetCell>>();
    @Output() readonly rightClick = new EventEmitter<Set<TimesheetCell>>();
    @Output() readonly dblClick = new EventEmitter<Set<TimesheetCell>>();
    destroy$ = new Subject<void>();
    canEditCell$ = new BehaviorSubject<boolean>(false);
    cellUpdated$ = new BehaviorSubject<boolean>(false);
    monthDays$ = new BehaviorSubject<Date[]>([]);
    projects$ = new BehaviorSubject<Project[]>([]);
    projectsWithDays$ = new BehaviorSubject<ProjectWithDays[]>([]);
    projectsColorMap$ = new BehaviorSubject<Map<number, string>>(new Map());
    rowUpdated$ = new BehaviorSubject<boolean>(false);
    timesheetRows: MonthlyEmployeeTimesheet[] = [];
    timesheet$ = new BehaviorSubject<MonthlyEmployeeTimesheet[] | null>(null);
    selectedCells$ = new BehaviorSubject<Set<TimesheetCell>>(new Set());
    selectedCellsId$ = new BehaviorSubject<Set<number>>(new Set());
    filteredIdSet$ = new BehaviorSubject<Set<number>>(new Set());

    cellsMap = new Map<number, TimesheetCell>();
    employeesMap = new Map<number, PersonnelAccount>();
    lastMouseEvent: MouseEvent | null = null;
    filteredEmployeesId: number[] = [];
    firstRangeCell: TimesheetCell;
    lastPressedCell: TimesheetCell;
    selectedProjectsId = new Set<number>();
    rangeStarted = false;
    today = new Date();
    timerId: NodeJS.Timeout;
    lastDir: Direction;

    filterControl = this.filterService.filterControl;

    constructor(
        private cacheService: CacheService,
        private windowRefService: WindowRefService,
        @Self()
        private filterService: FilterService
    ) {}

    @Input() set canEditCell(value: boolean | null) {
        if (value !== null) {
            this.canEditCell$.next(value);
        }
    }

    @Input() set timesheet(value: MonthlyEmployeeTimesheet[]) {
        if (!value) {
            return;
        }
        const monthlyTimesheets = value.filter((mt) => mt.cells.length);
        const uniqueMonthDays = [
            ...new Set(
                monthlyTimesheets
                    .map((mt) => mt.cells)
                    .reduce((acc, val) => acc.concat(val), [])
                    .map((cell) => cell.cellDateIso)
            )
        ]
            .map((item) => new Date(item))
            .sort((a, b) => (a > b ? 1 : -1));
        this.monthDays$.next(uniqueMonthDays);

        this.cellsMap = new Map(
            monthlyTimesheets
                .map((mt) => mt.cells)
                .reduce((acc, val) => acc.concat(val), [])
                .map((cell) => [cell.id, cell])
        );
        this.timesheetRows = monthlyTimesheets;
        this.filterControl.updateValueAndValidity();
        this.timesheet$.next(monthlyTimesheets);
    }

    @Input() set updatedCell(value: TimesheetCell | TimesheetCell[] | null) {
        if (!value) {
            return;
        }

        if (value instanceof Array) {
            value.forEach((cell) => this.cellsMap.set(cell.id, cell));
        } else {
            this.cellsMap.set(value.id, value);
        }

        this.selectedCells$.next(new Set());
        this.cellUpdated$.next(true);
    }

    @Input() set updatedRow(value: MonthlyEmployeeTimesheet | null) {
        if (value) {
            value.cells.forEach((cell) => this.cellsMap.set(cell.id, cell));
            this.timesheetRows.push(value);
            this.timesheet$.next(this.timesheetRows);
            this.filterControl.updateValueAndValidity();
            this.selectedCells$.next(new Set());
            this.rowUpdated$.next(true);
            const uniqueMonthDays = [
                ...new Set(
                    value.cells
                        .reduce((acc, val) => acc.concat(val), [])
                        .map((cell) => cell.cellDateIso)
                )
            ]
                .map((item) => new Date(item))
                .sort((a, b) => (a > b ? 1 : -1));
            this.monthDays$.next(uniqueMonthDays);
            setTimeout(
                () => this.windowRefService.scrollElementIntoView(`emp-${value.personnelId}`, true),
                150
            );
        }
    }

    @Input() set removeRowId(personalId: number | null) {
        if (personalId !== null) {
            this.timesheetRows
                .find((mt) => mt.personnelId === personalId)
                .cells.forEach((cell) => this.cellsMap.delete(cell.id));
            this.timesheetRows.splice(
                this.timesheetRows.findIndex((mt) => mt.personnelId === personalId),
                1
            );
            this.timesheet$.next(this.timesheetRows);
            this.selectedCells$.next(new Set());
            this.rowUpdated$.next(true);
        }
    }

    @Input() set updatedEmployees(value: PersonnelAccount | PersonnelAccount[] | null) {
        if (!value) {
            return;
        }

        if (value instanceof Array) {
            value.forEach((employee) => this.employeesMap.set(employee.id, employee));
        } else {
            this.employeesMap.set(value.id, value);
        }
    }

    @HostListener('document:keydown.escape', ['$event']) onEscape(event: KeyboardEvent) {
        this.selectedCells$.next(new Set());
        this.firstRangeCell = null;
        this.lastPressedCell = null;
    }

    ngOnInit(): void {
        this.filterService.needle$
            .pipe(
                switchMap(({ needle }) =>
                    this.timesheet$.pipe(
                        filter(Boolean),
                        map(
                            (timesheet) =>
                                timesheet
                                    .filter((mt) => mt.personnelName.toLowerCase().includes(needle))
                                    .map((mt) => mt.personnelId) || []
                        )
                    )
                ),
                takeUntil(this.destroy$)
            )
            .subscribe((filteredIds) => {
                this.filteredEmployeesId = filteredIds;
                this.filteredIdSet$.next(new Set(filteredIds));
            });

        combineLatest([
            this.timesheet$.asObservable().pipe(filter((t) => Boolean(t))),
            this.cacheService.projects$
                .asObservable()
                .pipe(filter((projects) => projects instanceof Array)),
            this.cellUpdated$.asObservable(),
            this.rowUpdated$.asObservable()
        ])
            .pipe(
                tap((_) => (this.selectedProjectsId = new Set())),
                takeUntil(this.destroy$)
            )
            .subscribe(([timesheet, projects, cellUpdated, rowUpdated]) => {
                const timesheetCells = [...this.cellsMap.values()];
                const usingProjectsId = new Set(timesheetCells.map((cell) => cell.projectId));
                const filteredProjects = projects.filter((project) =>
                    usingProjectsId.has(project.id)
                );
                this.projects$.next(filteredProjects);
                // FIXME: Need to be replaced by reduce
                const projectWithDays = filteredProjects.map((project) => {
                    return {
                        project,
                        days: timesheetCells.filter((cell) => cell.projectId === project.id).length
                    } as ProjectWithDays;
                });
                this.projectsWithDays$.next(projectWithDays);

                const projectsColorMap = new Map(
                    filteredProjects.map((project) => [project.id, hexToRgbA(project.color, 0.75)])
                );
                this.projectsColorMap$.next(projectsColorMap);
            });

        combineLatest([this.timesheet$.asObservable(), this.cacheService.employees$.asObservable()])
            .pipe(
                filter(
                    ([timesheet, employees]) =>
                        Boolean(timesheet) && timesheet.length > 0 && Boolean(employees)
                ),
                takeUntil(this.destroy$)
            )
            .subscribe(([timesheet, employees]) => {
                const timesheetEmployeesId = timesheet.map((mt) => mt.personnelId);
                this.employeesMap = new Map(
                    employees
                        .filter((elem) => timesheetEmployeesId.includes(elem.id))
                        .map((employee) => [employee.id, employee])
                );
            });

        this.enterPressed$
            .pipe(
                filter(Boolean),
                switchMap(() => this.selectedCells$.pipe(take(1))),
                takeUntil(this.destroy$)
            )
            .subscribe((cells) => {
                if (cells.size) {
                    this.onRightClick(cells);
                }
            });

        this.navDirection$
            .pipe(
                filter((e) => e !== null),
                takeUntil(this.destroy$)
            )
            .subscribe((event) => {
                if (!event.isShiftPressed) {
                    this.lastPressedCell = null;
                    if (this.firstRangeCell) {
                        let rowIndex = this.filteredEmployeesId.findIndex(
                            (item) => item === this.firstRangeCell.personnelId
                        );
                        let colIndex = this.timesheetRows[rowIndex].cells.findIndex(
                            (cell) => cell.id === this.firstRangeCell.id
                        );

                        switch (event.direction) {
                            case Direction.Down:
                                rowIndex =
                                    rowIndex < this.timesheetRows.length - 1
                                        ? rowIndex + 1
                                        : this.timesheetRows.length - 1;
                                break;
                            case Direction.Up:
                                rowIndex = rowIndex > 0 ? rowIndex - 1 : 0;
                                break;
                            case Direction.Left:
                                colIndex = colIndex > 0 ? colIndex - 1 : 0;
                                break;
                            case Direction.Right:
                                colIndex =
                                    colIndex < this.timesheetRows[0].cells.length - 1
                                        ? colIndex + 1
                                        : this.timesheetRows[0].cells.length - 1;
                                break;
                            default:
                                break;
                        }

                        const nextCell = this.timesheetRows[rowIndex].cells[colIndex];
                        this.lastPressedCell = nextCell;
                        this.initObserver();
                        const setCell = new Set<TimesheetCell>();
                        setCell.add(nextCell);
                        this.firstRangeCell = nextCell;
                        this.selectedCells$.next(setCell);
                    }
                } else {
                    const lastPressedCell = this.lastPressedCell || this.firstRangeCell;
                    if (lastPressedCell) {
                        let rowIndex = this.filteredEmployeesId.findIndex(
                            (item) => item === lastPressedCell.personnelId
                        );
                        let colIndex = this.timesheetRows[rowIndex].cells.findIndex(
                            (cell) => cell.id === lastPressedCell.id
                        );

                        switch (event.direction) {
                            case Direction.Down:
                                rowIndex =
                                    rowIndex < this.timesheetRows.length - 1
                                        ? rowIndex + 1
                                        : this.timesheetRows.length - 1;
                                break;
                            case Direction.Up:
                                rowIndex = rowIndex > 0 ? rowIndex - 1 : 0;
                                break;
                            case Direction.Left:
                                colIndex = colIndex > 0 ? colIndex - 1 : 0;
                                break;
                            case Direction.Right:
                                colIndex =
                                    colIndex < this.timesheetRows[0].cells.length - 1
                                        ? colIndex + 1
                                        : this.timesheetRows[0].cells.length - 1;
                                break;
                            default:
                                break;
                        }

                        const nextCell = this.timesheetRows[rowIndex].cells[colIndex];
                        this.lastPressedCell = nextCell;
                        this.lastDir = event.direction;
                        this.initObserver();
                        const timesheetCells = [...this.cellsMap.values()];
                        const firstIndex = this.filteredEmployeesId.findIndex(
                            (item) => item === this.firstRangeCell.personnelId
                        );
                        const secondIndex = this.filteredEmployeesId.findIndex(
                            (item) => item === nextCell.personnelId
                        );
                        const selectedPersonIds =
                            firstIndex <= secondIndex
                                ? this.filteredEmployeesId.slice(firstIndex, secondIndex + 1)
                                : this.filteredEmployeesId.slice(secondIndex, firstIndex + 1);

                        const selectedCells = new Set([
                            ...timesheetCells.filter(
                                (item) =>
                                    selectedPersonIds.includes(item.personnelId) &&
                                    ((item.cellDate >= this.firstRangeCell.cellDate &&
                                        item.cellDate <= nextCell.cellDate) ||
                                        (item.cellDate <= this.firstRangeCell.cellDate &&
                                            item.cellDate >= nextCell.cellDate))
                            )
                        ]);

                        this.selectedCells$.next(selectedCells);
                    }
                }
            });

        this.selectedCells$.pipe(takeUntil(this.destroy$)).subscribe((cells) => {
            this.selectedCellsId$.next(new Set(Array.from(cells).map((cell) => cell.id)));
            this.rangeSelected.emit(cells);
        });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.canEditCell$.complete();
        this.filteredIdSet$.complete();
        this.monthDays$.complete();
        this.projects$.complete();
        this.projectsColorMap$.complete();
        this.rowUpdated$.complete();
        this.cellUpdated$.complete();
        this.timesheet$.complete();
        this.selectedCells$.complete();
    }

    initObserver(): void {
        const options = {
            root: this.tableWrapper.nativeElement,
            rootMargin: '0px',
            threshold: 1.0
        };

        const callback = (entries, options) => {
            entries.forEach((entry) => {
                if (entry.intersectionRatio < 1) {
                    entry.target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                        inline: 'nearest'
                    });
                } else {
                    observer.unobserve(entry.target);
                }
            });
        };

        const target = document.querySelector(`[id="${this.lastPressedCell.id || 1}" ]`);
        const observer = new IntersectionObserver(callback, options);
        observer.observe(target);
    }

    selectCellRange(
        event: MouseEvent,
        cell: TimesheetCell,
        selectedCells: Set<TimesheetCell>,
        canEdit: boolean
    ): void {
        if (!canEdit) return;

        this.lastMouseEvent = event;
        if ((this.rangeStarted && !event.ctrlKey) || (event.shiftKey && event.type === 'mouseup')) {
            const timesheetCells = [...this.cellsMap.values()];
            if (selectedCells.size === 0) {
                this.firstRangeCell = cell;
                selectedCells.add(cell);
                this.selectedCells$.next(selectedCells);
            } else {
                const firstIndex = this.filteredEmployeesId.findIndex(
                    (item) => item === this.firstRangeCell.personnelId
                );
                const secondIndex = this.filteredEmployeesId.findIndex(
                    (item) => item === cell.personnelId
                );
                const selectedPersonIds =
                    firstIndex <= secondIndex
                        ? this.filteredEmployeesId.slice(firstIndex, secondIndex + 1)
                        : this.filteredEmployeesId.slice(secondIndex, firstIndex + 1);

                selectedCells = new Set([
                    ...timesheetCells.filter(
                        (item) =>
                            selectedPersonIds.includes(item.personnelId) &&
                            ((item.cellDate >= this.firstRangeCell.cellDate &&
                                item.cellDate <= cell.cellDate) ||
                                (item.cellDate <= this.firstRangeCell.cellDate &&
                                    item.cellDate >= cell.cellDate))
                    )
                ]);

                const rowIndex = this.filteredEmployeesId.findIndex(
                    (item) => item === cell.personnelId
                );
                const colIndex = this.timesheetRows[rowIndex].cells.findIndex(
                    (c) => c.id === cell.id
                );

                this.lastPressedCell = this.timesheetRows[rowIndex].cells[colIndex];

                this.selectedCells$.next(selectedCells);
            }
        }
    }

    selectColumn(
        event: MouseEvent,
        selectedCells: Set<TimesheetCell>,
        date: Date,
        canEdit: boolean
    ): void {
        if (!canEdit) return;
        const columnCells = [...this.cellsMap.values()].filter(
            (cell) =>
                cell.cellDate.getDate() === date.getDate() &&
                cell.cellDate.getMonth() === date.getMonth() &&
                cell.cellDate.getFullYear() === date.getFullYear()
        );
        if (event.ctrlKey) {
            selectedCells = new Set([...selectedCells, ...columnCells]);
            this.selectedCells$.next(selectedCells);
        } else {
            this.selectedCells$.next(new Set([...columnCells]));
        }
    }

    selectRow(
        event: MouseEvent,
        selectedCells: Set<TimesheetCell>,
        employeeId: number,
        canEdit: boolean
    ): void {
        if (!canEdit) return;
        const columnCells = [...this.cellsMap.values()].filter(
            (cell) => cell.personnelId === employeeId
        );
        if (event.ctrlKey) {
            selectedCells = new Set([...selectedCells, ...columnCells]);
            this.selectedCells$.next(selectedCells);
        } else {
            this.selectedCells$.next(new Set([...columnCells]));
        }
    }

    onMouseUp(
        event: MouseEvent,
        selectedCells: Set<TimesheetCell>,
        cell: TimesheetCell,
        canEdit: boolean
    ): void {
        if (!canEdit) return;

        if (event.ctrlKey) {
            if (selectedCells.has(cell)) {
                selectedCells.delete(cell);
            } else {
                selectedCells.add(cell);
            }
            this.selectedCells$.next(selectedCells);
        } else if (event.shiftKey) {
            this.selectCellRange(event, cell, selectedCells, canEdit);
            this.endRangeSelection(event);
        } else {
            if (!selectedCells.has(cell)) {
                this.selectedCells$.next(new Set());
            }
            this.rangeSelected.emit(selectedCells);
            this.endRangeSelection(event);
        }
    }

    onMouseDown(
        event: MouseEvent,
        cell: TimesheetCell,
        selectedCells: Set<TimesheetCell>,
        canEdit: boolean
    ): void {
        if (!canEdit) return;
        if (event.buttons === 1 && !selectedCells.has(cell)) {
            this.startRange(event, cell, selectedCells);
        }
    }

    startRange(event: MouseEvent, cell: TimesheetCell, selectedCells: Set<TimesheetCell>): void {
        if (!event.ctrlKey && !event.shiftKey) {
            this.rangeStarted = true;
            this.timerId = setTimeout(() => this.scrollTable(event), 100);
            this.firstRangeCell = cell;
            this.lastPressedCell = cell;
            selectedCells = new Set<TimesheetCell>();
        }

        if (!this.firstRangeCell) {
            this.firstRangeCell = cell;
        }

        if (!event.ctrlKey) {
            selectedCells.add(cell);
        }
        this.selectedCells$.next(selectedCells);
    }

    endRangeSelection(event: MouseEvent): void {
        if (event && !event.shiftKey) {
            this.rangeStarted = false;
            clearTimeout(this.timerId);
        }
    }

    scrollTable(event: MouseEvent): void {
        const table = this.tableWrapper.nativeElement;
        const scrollBorder = 100;
        const speed = 70;
        let delta = 0;

        if (event.y < scrollBorder + Number(table.getBoundingClientRect().top)) {
            delta =
                -((scrollBorder - (event.y - table.getBoundingClientRect().top)) / scrollBorder) *
                speed;
        } else if (table.getBoundingClientRect().bottom + 10 - event.y < scrollBorder) {
            delta =
                ((scrollBorder - (table.getBoundingClientRect().bottom - event.y)) / scrollBorder) *
                speed;
        }

        this.scrollTo(delta, table);
        this.timerId = setTimeout(() => this.scrollTable(this.lastMouseEvent), 100);
    }

    scrollTo(delta: number, table: HTMLElement): void {
        table.scrollTo({
            top: Number(table.scrollTop) + delta,
            behavior: 'auto'
        });
    }

    onRightClick(
        selectedCells: Set<TimesheetCell>,
        cell: TimesheetCell | null = null,
        canEdit = false
    ): false {
        if (!canEdit) {
            return false;
        }
        if (cell) {
            selectedCells.add(cell);
        }

        this.selectedCells$.next(selectedCells);
        this.rightClick.emit(selectedCells);
        return false;
    }

    onDblClick(selectedCells: Set<TimesheetCell>, canEdit: boolean): void {
        if (!canEdit) return;

        this.dblClick.emit(selectedCells);
    }

    timeOffDescription(timeOff: TimeOffKind): string {
        return TimeOffKind.getDescription(timeOff);
    }

    isWeekend(date: Date): boolean {
        return date.getDay() === 6 || date.getDay() === 0;
    }

    onSelectProjects(projectsId: Set<number>): void {
        this.selectedProjectsId = projectsId;
    }

    onKeyUpPressed(event: KeyboardEvent): void {
        // console.log('onkeyup', event.code, event.target);
    }
}
