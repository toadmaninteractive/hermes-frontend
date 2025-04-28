import {
    AfterViewInit,
    ChangeDetectionStrategy,
    Component,
    Inject,
    OnDestroy,
    OnInit,
    ViewChild
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButton, MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import {
    NgPlural,
    NgPluralCase,
    NgTemplateOutlet,
    AsyncPipe,
    SlicePipe,
    DatePipe
} from '@angular/common';
import { filter, takeUntil } from 'rxjs/operators';
import { BehaviorSubject, Subject } from 'rxjs';
import { PersonnelAccount, TimesheetCell } from '../../../protocol/db-protocol';
import { ExtendedCell } from '../../../shared/interfaces/extended-cell.interface';
import { CacheService } from '../../../core/services/cache.service';
import { hexToRgbA } from '../../../shared/functions/color';
import { isWeekend, timeOffDescription } from '../../../shared/classes/cell.helpers';
import { OverlayService } from '../../../core/services/overlay.service';

export interface ConfirmResultData {
    overwriteWeekend: boolean;
    applyAbsence: boolean;
}

export interface ConfirmInputData {
    sourceCells: ExtendedCell[];
    selectedCells: ExtendedCell[];
    targetCells: ExtendedCell[];
}

@Component({
    selector: 'app-confirm-dialog',
    templateUrl: 'confirm-dialog.component.html',
    styleUrls: ['confirm-dialog.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        NgPlural,
        NgPluralCase,
        NgTemplateOutlet,
        MatCheckbox,
        FormsModule,
        AsyncPipe,
        SlicePipe,
        DatePipe,
        MatDialogModule,
        MatButtonModule,
        MatIconModule
    ]
})
export class ConfirmDialogComponent implements OnInit, OnDestroy, AfterViewInit {
    @ViewChild('applyButton', { static: false }) applyButton: MatButton;

    destroy$ = new Subject<void>();
    employeesName$ = new BehaviorSubject<Set<string>>(null);
    updateEmployees$ = new BehaviorSubject<Set<string>>(null);
    monthDays$ = new BehaviorSubject<Date[]>([]);
    projectColors$ = new BehaviorSubject<Map<number, string>>(new Map());

    from: Date;
    to: Date;
    weekendCount: number;
    absenceCount: number;
    overwriteWeekend = false;
    applyAbsence = true;
    comment = '';
    cells: TimesheetCell[];
    employeesMap = new Map<number, PersonnelAccount>();
    employeesArray = new Array<PersonnelAccount>();

    sourceRowShift = 0;
    sourceColShift = 0;

    selectedRowShift = 0;
    selectedColShift = 0;

    rowIndexArray: number[] = [];
    colIndexArray: number[] = [];

    isWeekend = isWeekend;
    timeOffDescription = timeOffDescription;

    constructor(
        public dialogRef: MatDialogRef<ConfirmDialogComponent>,
        private cacheService: CacheService,
        private overlayService: OverlayService,
        @Inject(MAT_DIALOG_DATA) public data: ConfirmInputData
    ) {}

    ngOnInit(): void {
        this.overlayService.isDialogDisplayed$.next(true);
        this.cells = this.data.selectedCells.map((c) => c.cell);
        this.employeesName$.next(new Set([...this.cells.map((item) => item.personnelName)]));
        this.updateEmployees$.next(
            new Set([...this.data.selectedCells.map((item) => item.cell.personnelName)])
        );
        this.from = this.cells.sort((a, b) => (a.cellDate > b.cellDate ? 1 : -1))[0].cellDate;
        this.to = this.cells.sort((a, b) => (a.cellDate < b.cellDate ? 1 : -1))[0].cellDate;

        this.overwriteWeekend = this.cells.every(
            (item) => item.cellDate.getDay() === 0 || item.cellDate.getDay() === 6
        );

        this.weekendCount = new Set([
            ...this.cells
                .filter((item) => item.cellDate.getDay() === 0 || item.cellDate.getDay() === 6)
                .map((cell) => cell.cellDate.getTime())
        ]).size;

        this.absenceCount = new Set([...this.cells.filter((item) => item.timeOff)]).size;

        this.monthDays$.next(
            Array.from(new Set(this.data.selectedCells.map((ex) => ex.cell.cellDateIso)))
                .map((date) => new Date(date))
                .sort((a, b) => (a > b ? 1 : -1))
        );

        this.cacheService.employees$
            .asObservable()
            .pipe(
                takeUntil(this.destroy$),
                filter((employees) => Boolean(employees))
            )
            .subscribe((employees) => {
                const needleEmloyees = Array.from(
                    new Set(this.data.selectedCells.map((ex) => ex.cell.personnelId))
                );
                this.employeesMap = new Map(
                    needleEmloyees.map((id) => [id, employees.find((e) => e.id === id)])
                );
                this.employeesArray = needleEmloyees.map((id) =>
                    employees.find((e) => e.id === id)
                );
            });

        this.cacheService.projects$
            .asObservable()
            .pipe(
                filter((projects) => projects instanceof Array),
                takeUntil(this.destroy$)
            )

            .subscribe((projects) => {
                const projectsColorMap = new Map(
                    projects.map((project) => [project.id, hexToRgbA(project.color, 0.75)])
                );
                this.projectColors$.next(projectsColorMap);
            });

        this.sourceRowShift =
            this.data.sourceCells[0].rowIndex - this.data.selectedCells[0].rowIndex;
        this.sourceColShift =
            this.data.sourceCells[0].colIndex - this.data.selectedCells[0].colIndex;

        this.selectedRowShift = this.data.selectedCells[0].rowIndex;
        this.selectedColShift = this.data.selectedCells[0].colIndex;

        this.rowIndexArray = Array.from(
            new Set(
                this.data.selectedCells.map((sc) => sc.rowIndex).sort((a, b) => (a > b ? 1 : -1))
            )
        );
        this.colIndexArray = Array.from(
            new Set(
                this.data.selectedCells.map((sc) => sc.colIndex).sort((a, b) => (a > b ? 1 : -1))
            )
        );
    }

    ngAfterViewInit(): void {
        setTimeout(() => this.applyButton.focus());
    }

    ngOnDestroy(): void {
        this.overlayService.isDialogDisplayed$.next(false);
        this.destroy$.next();
        this.destroy$.complete();
        this.employeesName$.complete();
        this.monthDays$.complete();
        this.projectColors$.complete();
    }

    closeDialog(value: boolean | null): void {
        const result = value
            ? ({
                  overwriteWeekend: this.overwriteWeekend,
                  applyAbsence: this.applyAbsence
              } as ConfirmResultData)
            : null;

        this.dialogRef.close(result);
    }

    getSourceCell(rowIndex: number, colIndex: number): TimesheetCell | undefined {
        if (this.data.sourceCells.length === 1) {
            return this.data.targetCells.find(
                (ex) =>
                    ex.rowIndex === this.rowIndexArray[rowIndex] &&
                    ex.colIndex === this.colIndexArray[colIndex]
            )?.cell
                ? this.data.sourceCells[0].cell
                : undefined;
        }

        return (
            this.data.sourceCells.find((ex) => ex.rowIndex === rowIndex && ex.colIndex === colIndex)
                ?.cell || undefined
        );
    }

    getTargetCell(rowIndex: number, colIndex: number): TimesheetCell {
        return (
            this.data.selectedCells.find(
                (ex) =>
                    ex.rowIndex === this.rowIndexArray[rowIndex] &&
                    ex.colIndex === this.colIndexArray[colIndex]
            )?.cell ?? new TimesheetCell()
        );
    }
}
