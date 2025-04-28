import {
    KeyValue,
    NgPlural,
    NgPluralCase,
    AsyncPipe,
    DatePipe,
    KeyValuePipe
} from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatInput } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatOption } from '@angular/material/core';
import { MatSelect } from '@angular/material/select';
import { MatFormField, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { takeUntil } from 'rxjs/operators';
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search';
import { BehaviorSubject, combineLatest, Subject } from 'rxjs';
import { OverlayService } from '../../../core/services/overlay.service';
import { hexToRgbA } from '../../../shared/functions/color';
import { Project, TimeOffKind, TimesheetCell } from '../../../protocol/db-protocol';

export enum Occupancy {
    Project = 'project',
    Absence = 'absence',
    Deallocate = 'deallocate',
    Protect = 'protect',
    Unprotect = 'unprotect'
}

export interface CellEditDialogData {
    occupancy: Occupancy;
    value: Project | TimeOffKind | null;
    overwriteWeekend: boolean;
    assignToProject: boolean;
    applyAbsence: boolean;
    comment?: string;
}

export interface TimesheetCellData {
    previousValue: CellEditDialogData;
    preferredProjectId: number | TimeOffKind;
    cells: Array<TimesheetCell>;
    projects: Project[];
}

@Component({
    selector: 'app-cell-edit-dialog',
    templateUrl: 'cell-edit-dialog.component.html',
    styleUrls: ['cell-edit-dialog.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        NgPlural,
        NgPluralCase,
        MatFormField,
        MatSelect,
        MatOption,
        MatCheckbox,
        FormsModule,
        NgxMatSelectSearchModule,
        MatLabel,
        MatInput,
        MatSuffix,
        AsyncPipe,
        DatePipe,
        KeyValuePipe,
        MatDialogModule,
        MatButtonModule,
        MatIconModule
    ]
})
export class CellEditDialogComponent implements OnInit, OnDestroy {
    destroy$ = new Subject<void>();
    employeesName$ = new BehaviorSubject<Set<string>>(null);
    filteredProjects$ = new BehaviorSubject<Project[]>(null);
    filteredTimeOff$ = new BehaviorSubject<Map<number, string>>(null);
    includeArchived$ = new BehaviorSubject<boolean>(false);
    trimmedNeedle$ = new BehaviorSubject<string>('');
    from: Date;
    to: Date;
    occupancy: Occupancy = Occupancy.Project;
    occupancyEnum = Occupancy;
    timeOffMap = new Map<number, string>();
    selectedValue: Project | TimeOffKind | null;
    weekendCount: number;
    allowArchivedProjects = false;
    overwriteWeekend = false;
    assignToProject = false;
    applyAbsence = true;
    comment = '';
    protectedCells: Array<TimesheetCell> = [];
    availableCells: Array<TimesheetCell> = [];
    hexToRgbA = hexToRgbA;

    constructor(
        public dialogRef: MatDialogRef<CellEditDialogComponent>,
        private overlayService: OverlayService,
        @Inject(MAT_DIALOG_DATA) public data: TimesheetCellData
    ) {}

    ngOnInit(): void {
        this.filteredProjects$.next(
            this.filterArchivedProject(this.data.projects, this.allowArchivedProjects)
        );

        if (
            !this.data.previousValue ||
            (this.data.previousValue.occupancy !== Occupancy.Project &&
                this.data.previousValue.occupancy !== Occupancy.Absence)
        ) {
            this.selectedValue = this.data.projects.find(
                (p) => p.id === this.data.preferredProjectId
            );
        } else {
            this.selectedValue = this.data.previousValue.value;
            this.occupancy = this.data.previousValue.occupancy;
        }

        this.employeesName$.next(new Set([...this.data.cells.map((item) => item.personnelName)]));
        this.from = this.data.cells.sort((a, b) => (a.cellDate > b.cellDate ? 1 : -1))[0].cellDate;
        this.to = this.data.cells.sort((a, b) => (a.cellDate < b.cellDate ? 1 : -1))[0].cellDate;

        this.overwriteWeekend = this.data.cells.every(
            (item) => item.cellDate.getDay() === 0 || item.cellDate.getDay() === 6
        );

        this.weekendCount = new Set([
            ...this.data.cells
                .filter((item) => item.cellDate.getDay() === 0 || item.cellDate.getDay() === 6)
                .map((cell) => cell.cellDate.getTime())
        ]).size;

        this.timeOffMap = new Map(
            this.prepareTimeOffKindArray().map((item) => [item, TimeOffKind.getDescription(item)])
        );

        this.filteredTimeOff$.next(this.timeOffMap);

        this.protectedCells = this.data.cells.filter((cell) => cell.isProtected);
        this.availableCells = this.data.cells.filter((cell) => !cell.isProtected);
        if (!this.availableCells.length) {
            this.occupancy = Occupancy.Unprotect;
        }

        this.overlayService.isDialogDisplayed$.next(true);

        combineLatest([this.includeArchived$.asObservable(), this.trimmedNeedle$.asObservable()])
            .pipe(takeUntil(this.destroy$))
            .subscribe(([includeArchived, trimmedNeedle]) => {
                let { projects } = this.data;
                if (!includeArchived) {
                    projects = projects.filter((project) => !project.isArchived);
                }
                if (trimmedNeedle) {
                    projects = projects.filter((p) =>
                        p.title.toLowerCase().includes(trimmedNeedle)
                    );
                }

                this.filteredProjects$.next(projects);
            });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.includeArchived$.complete();
        this.employeesName$.complete();
        this.filteredProjects$.complete();
        this.filteredTimeOff$.complete();
        this.trimmedNeedle$.complete();

        this.overlayService.isDialogDisplayed$.next(false);
    }

    applyTimeOffFilter(needle: string): void {
        if (needle) {
            const filteredMap = new Map<number, string>(
                this.prepareTimeOffKindArray().map((item) => {
                    if (
                        TimeOffKind.getDescription(item)
                            .toLowerCase()
                            .includes(needle.toLowerCase())
                    ) {
                        return [item, TimeOffKind.getDescription(item)];
                    }

                    return [Infinity, null];
                })
            );
            filteredMap.delete(Infinity);
            this.filteredTimeOff$.next(filteredMap);
        } else {
            this.filteredTimeOff$.next(this.timeOffMap);
        }
    }

    closeDialog(event: Occupancy | null): void {
        const result = event
            ? ({
                  occupancy: this.occupancy,
                  value: this.selectedValue,
                  overwriteWeekend: this.overwriteWeekend,
                  assignToProject: this.assignToProject,
                  applyAbsence: this.applyAbsence,
                  comment: this.comment
              } as CellEditDialogData)
            : null;

        this.dialogRef.close(result);
    }

    canApply(): boolean {
        const isParamless =
            this.occupancy === Occupancy.Protect ||
            this.occupancy === Occupancy.Unprotect ||
            this.occupancy === Occupancy.Deallocate;

        const isProject =
            this.occupancy === Occupancy.Project && this.selectedValue instanceof Project;

        const isAbsence =
            this.occupancy === Occupancy.Absence && typeof this.selectedValue === 'number';

        return isParamless || isProject || isAbsence;
    }

    prepareTimeOffKindArray(): number[] {
        return Object.keys(TimeOffKind)
            .filter((kind) => typeof TimeOffKind[kind] === 'number')
            .map((k) => TimeOffKind[k] as number);
    }

    isProject(value: Project | TimeOffKind | null): boolean {
        return value instanceof Project;
    }

    orderAsc(a: KeyValue<number, string>, b: KeyValue<number, string>): number {
        return a.value > b.value ? 1 : -1;
    }

    filterArchivedProject(projects: Project[], includeArchived: boolean): Project[] {
        return projects.filter((project) => (includeArchived ? true : !project.isArchived));
    }

    onCheckArchived(value: boolean): void {
        this.includeArchived$.next(value);
    }

    onChangeNeedle(value: string): void {
        this.trimmedNeedle$.next(value.toLowerCase().trim());
    }

    clearInput(): void {
        this.comment = '';
    }
}
