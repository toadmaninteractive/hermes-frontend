import { ChangeDetectionStrategy, Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatOption } from '@angular/material/core';
import { FormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { AsyncPipe, DatePipe } from '@angular/common';
import { filter, map, take, takeUntil, tap } from 'rxjs/operators';
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search';
import { BehaviorSubject, combineLatest, Subject } from 'rxjs';
import { HermesTimesheetService } from '../../../protocol/timesheet-protocol.service';
import { HermesReportService } from '../../../protocol/report-protocol.service';
import { SelectedDateService } from '../../../core/services/selected-date.service';
import { CacheService } from '../../../core/services/cache.service';
import { PersonnelAccount } from '../../../protocol/db-protocol';
import { RoleReportDialogData } from '../../../shared/interfaces/dialog-data.interface';

enum SelectMode {
    Include,
    Omit
}

@Component({
    selector: 'app-report-create-dialog',
    templateUrl: 'role-report-dialog.component.html',
    styleUrls: ['role-report-dialog.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        CdkScrollable,
        FormsModule,
        NgxMatSelectSearchModule,
        AsyncPipe,
        MatOption,
        DatePipe,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatSelectModule,
        MatButtonToggleModule
    ]
})
export class RoleReportDialogComponent implements OnInit, OnDestroy {
    omittedEmployees: number[] = [];
    includedEmployees: number[] = [];
    employeesWithEmptyCells: number[] = [];
    destroy$ = new Subject<void>();
    employees$ = new BehaviorSubject<PersonnelAccount[]>([]);
    filteredEmployees$ = new BehaviorSubject<PersonnelAccount[]>([]);
    isCsv = true;
    selectMode = SelectMode;

    mode: SelectMode = SelectMode.Omit;
    excludeEmpty = false;

    constructor(
        public dialogRef: MatDialogRef<RoleReportDialogComponent>,
        public cacheService: CacheService,
        public reportService: HermesReportService,
        public timesheetService: HermesTimesheetService,
        public selectedDateService: SelectedDateService,
        @Inject(MAT_DIALOG_DATA) public data: RoleReportDialogData
    ) {}

    ngOnInit(): void {
        combineLatest([
            this.cacheService.employees$.asObservable(),
            this.reportService.getVismaReportsForOffice(
                this.data.date.getFullYear(),
                this.data.date.getMonth() + 1,
                this.data.officeId
            )
        ])
            .pipe(
                takeUntil(this.destroy$),
                filter(([employees, report]) => Boolean(employees)),
                tap(([employees, report]) => {
                    const lastReport = report.items.sort((a, b) => (a.id > b.id ? -1 : 1))[0];
                    this.omittedEmployees = lastReport?.omitIds ?? [];
                }),
                map(([employees, report]) =>
                    employees
                        .filter((item) => item.officeId === this.data.officeId)
                        .sort((a, b) => (a.name > b.name ? 1 : -1))
                )
            )
            .subscribe((employees: PersonnelAccount[]) => {
                this.employees$.next(employees);
                this.filteredEmployees$.next(employees);
            });

        this.timesheetService
            .getMonthlyTimesheetForOffice(
                this.data.date.getFullYear(),
                this.data.date.getMonth() + 1,
                this.data.officeId
            )
            .pipe(
                takeUntil(this.destroy$),
                take(1),
                map((collection) => collection.items)
            )
            .subscribe((timesheet) => {
                this.employeesWithEmptyCells = timesheet
                    .map((mt) =>
                        mt.cells.every((cell) => !cell.projectId && !cell.timeOff)
                            ? mt.personnelId
                            : 0
                    )
                    .filter((id) => Boolean(id));
            });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.employees$.complete();
        this.filteredEmployees$.complete();
    }

    filterEmployees(needle: string, employees: PersonnelAccount[]): void {
        const filteredEmployees = employees.filter((emp) =>
            emp.name.toLowerCase().includes(needle.toLowerCase())
        );
        this.filteredEmployees$.next(filteredEmployees);
    }

    switchFiletype(event: MatButtonToggleChange): void {
        this.isCsv = event.value;
    }

    switchSelectMode(event: MatButtonToggleChange) {
        this.mode = event.value;
    }

    switchExcludeEmpty(event: MatButtonToggleChange) {
        this.excludeEmpty = event.value;
    }

    getLink(date: Date): string {
        let url =
            this.reportService.baseUrl +
            '/api/visma/report/monthly/by-role/' +
            date.getFullYear() +
            '/' +
            (date.getMonth() + 1) +
            /office/ +
            this.data.officeId +
            '?a=';
        if (this.omittedEmployees.length || this.excludeEmpty) {
            const omittedSet = new Set([...this.omittedEmployees, ...this.employeesWithEmptyCells]);
            if (omittedSet.size) {
                url += '&omit_ids=';
                url += Array.from(omittedSet).join(',');
            }
        }

        if (this.includedEmployees.length) {
            url += `&include_ids=${this.includedEmployees.join(',')}&included_only=true`;
        }

        url += `&csv=${this.isCsv}`;
        return url;
    }
}
