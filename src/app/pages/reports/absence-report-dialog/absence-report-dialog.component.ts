import { ChangeDetectionStrategy, Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatOption } from '@angular/material/core';
import { FormsModule } from '@angular/forms';
import { MatSelect } from '@angular/material/select';
import { MatFormField } from '@angular/material/form-field';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AsyncPipe, DatePipe } from '@angular/common';
import { catchError, filter, map, takeUntil, tap } from 'rxjs/operators';
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search';
import { BehaviorSubject, combineLatest, of, Subject } from 'rxjs';
import { OmittedEmployees } from '../../../protocol/web-protocol';
import { HermesReportService } from '../../../protocol/report-protocol.service';
import { SelectedDateService } from '../../../core/services/selected-date.service';
import { CacheService } from '../../../core/services/cache.service';
import { PersonnelAccount } from '../../../protocol/db-protocol';
import { RoleReportDialogData } from '../../../shared/interfaces/dialog-data.interface';

@Component({
    selector: 'app-report-create-dialog',
    templateUrl: 'absence-report-dialog.component.html',
    styleUrls: ['absence-report-dialog.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        CdkScrollable,
        MatFormField,
        MatSelect,
        FormsModule,
        MatOption,
        NgxMatSelectSearchModule,
        AsyncPipe,
        DatePipe,
        MatDialogModule,
        MatIconModule,
        MatButtonModule
    ]
})
export class AbsenceReportDialogComponent implements OnInit, OnDestroy {
    omittedEmployees: number[] = [];
    destroy$ = new Subject<void>();
    employees$ = new BehaviorSubject<PersonnelAccount[]>([]);
    filteredEmployees$ = new BehaviorSubject<PersonnelAccount[]>([]);

    constructor(
        public dialogRef: MatDialogRef<AbsenceReportDialogComponent>,
        public cacheService: CacheService,
        public reportService: HermesReportService,
        public selectedDateService: SelectedDateService,
        @Inject(MAT_DIALOG_DATA) public data: RoleReportDialogData
    ) {}

    ngOnInit(): void {
        combineLatest([
            this.cacheService.employees$.asObservable(),
            this.reportService
                .getOmittedEmployeesForLastVismaReport(this.data.officeId)
                .pipe(catchError(() => of(new OmittedEmployees())))
        ])
            .pipe(
                takeUntil(this.destroy$),
                filter(([employees, omitted]) => Boolean(employees)),
                tap(([employees, omitted]) => (this.omittedEmployees = omitted?.omitIds ?? [])),
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
}
