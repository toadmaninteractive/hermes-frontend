import { ChangeDetectionStrategy, Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { animate, style, transition, trigger } from '@angular/animations';
import { MatOption } from '@angular/material/core';
import { FormsModule } from '@angular/forms';
import { MatSelect } from '@angular/material/select';
import { MatInput } from '@angular/material/input';
import { MatFormField } from '@angular/material/form-field';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AsyncPipe, SlicePipe, DatePipe } from '@angular/common';
import { catchError, filter, map, takeUntil } from 'rxjs/operators';
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search';
import { BehaviorSubject, combineLatest, of, Subject } from 'rxjs';
import { OmittedEmployees } from '../../../protocol/web-protocol';
import { HermesReportService } from '../../../protocol/report-protocol.service';
import { SelectedDateService } from '../../../core/services/selected-date.service';
import { CacheService } from '../../../core/services/cache.service';
import { PersonnelAccount } from '../../../protocol/db-protocol';
import { ReportCreateDialogData } from '../../../shared/interfaces/dialog-data.interface';
import { fadeAnimation } from '../../../shared/interfaces/animations';

@Component({
    selector: 'app-report-create-dialog',
    templateUrl: 'report-create-dialog.component.html',
    styleUrls: ['report-create-dialog.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        CdkScrollable,
        MatFormField,
        MatInput,
        MatSelect,
        FormsModule,
        MatOption,
        NgxMatSelectSearchModule,
        AsyncPipe,
        SlicePipe,
        DatePipe,
        MatDialogModule,
        MatButtonModule,
        MatIconModule
    ],
    animations: [fadeAnimation]
})
export class ReportCreateDialogComponent implements OnInit, OnDestroy {
    omittedEmployees: number[] = [];
    today = new Date();
    destroy$ = new Subject<void>();
    employees$ = new BehaviorSubject<PersonnelAccount[]>([]);
    filteredEmployees$ = new BehaviorSubject<PersonnelAccount[]>([]);
    incorrectEmployees$ = new BehaviorSubject<PersonnelAccount[]>([]);
    showFullList = false;

    constructor(
        public dialogRef: MatDialogRef<ReportCreateDialogComponent>,
        public cacheService: CacheService,
        private reportService: HermesReportService,
        public selectedDateService: SelectedDateService,
        @Inject(MAT_DIALOG_DATA) public data: ReportCreateDialogData
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
                filter(([employees, omittedEmployees]) => Boolean(employees)),
                map(([employees, omittedEmployees]) => [
                    employees
                        .filter((item) => item.officeId === this.data.officeId)
                        .sort((a, b) => (a.name > b.name ? 1 : -1)),
                    omittedEmployees.omitIds
                ])
            )
            .subscribe(([employees, omittedEmployees]: [PersonnelAccount[], number[]]) => {
                this.employees$.next(employees);
                this.filteredEmployees$.next(employees);
                this.omittedEmployees = omittedEmployees ?? [];
                this.incorrectEmployees$.next(
                    employees.filter((e) => !this.data.officeRolesId.includes(e.roleId))
                );
            });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.employees$.complete();
        this.filteredEmployees$.complete();
        this.incorrectEmployees$.complete();
    }

    filterEmployees(needle: string, employees: PersonnelAccount[]): void {
        const filteredEmployees = employees.filter((emp) =>
            emp.name.toLowerCase().includes(needle.toLowerCase())
        );
        this.filteredEmployees$.next(filteredEmployees);
    }

    toggleShowMode(): void {
        this.showFullList = !this.showFullList;
    }
}
