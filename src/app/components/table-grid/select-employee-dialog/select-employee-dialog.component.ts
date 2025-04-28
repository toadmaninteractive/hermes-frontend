import { ChangeDetectionStrategy, Component, Inject, OnDestroy, OnInit, Self } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSelectionListChange, MatSelectionList, MatListOption } from '@angular/material/list';
import { MatInput } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AsyncPipe } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import {
    debounceTime,
    distinctUntilChanged,
    map,
    switchMap,
    take,
    takeUntil
} from 'rxjs/operators';
import { BehaviorSubject, combineLatest, Subject } from 'rxjs';
import { OverlayService } from '../../../core/services/overlay.service';
import { AccountService } from '../../../core/services/account.service';
import { CacheService } from '../../../core/services/cache.service';
import { PersonnelAccount } from '../../../protocol/db-protocol';
import { FilterService } from '../../../core/services/filter.service';

export interface EmployeeData {
    header: string;
    existingEmployees: PersonnelAccount[];
    projectId: number;
    multiple: boolean;
}

@Component({
    selector: 'app-select-employee-dialog',
    templateUrl: 'select-employee-dialog.component.html',
    styleUrls: ['select-employee-dialog.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatInput,
        MatSelectionList,
        MatListOption,
        AsyncPipe,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        ReactiveFormsModule,
        MatFormFieldModule
    ],
    providers: [FilterService]
})
export class SelectEmployeeDialogComponent implements OnInit, OnDestroy {
    destroy$ = new Subject<void>();
    filteredEmployees$ = new BehaviorSubject<PersonnelAccount[]>(null);
    availableEmployees$ = new BehaviorSubject<PersonnelAccount[]>(null);
    existingEmployees = new Set<number>();
    selected$ = new BehaviorSubject<Set<number>>(new Set());

    filterControl = this.filterService.filterControl;
    needle$ = this.filterService.needle$;

    constructor(
        public dialogRef: MatDialogRef<SelectEmployeeDialogComponent>,
        public cacheService: CacheService,
        public accountService: AccountService,
        private overlayService: OverlayService,
        @Inject(MAT_DIALOG_DATA) public data: EmployeeData,
        @Self()
        private filterService: FilterService
    ) {}

    ngOnInit(): void {
        this.existingEmployees = new Set(this.data.existingEmployees.map((e) => e.id));

        this.needle$
            .pipe(
                switchMap(({ needle }) =>
                    this.availableEmployees$.pipe(
                        take(1),
                        map((employees) =>
                            employees.filter((emp) => emp.name.toLowerCase().includes(needle))
                        )
                    )
                ),

                takeUntil(this.destroy$)
            )
            .subscribe((filteredEmployees) => {
                this.filteredEmployees$.next(filteredEmployees);
            });

        combineLatest([
            this.cacheService.employees$.asObservable(),
            this.accountService.profile$.asObservable()
        ])
            .pipe(
                takeUntil(this.destroy$),
                distinctUntilChanged(),
                debounceTime(250),
                map(([employees, account]) => {
                    const availableEmployees = employees.filter(
                        (e) =>
                            e.officeId &&
                            !e.isBlocked &&
                            !e.isDeleted &&
                            !this.existingEmployees.has(e.id)
                    );
                    return [
                        ...availableEmployees
                            .filter((employee) => employee.officeId === account.officeId)
                            .sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1)),
                        ...availableEmployees
                            .filter((employee) => employee.officeId !== account.officeId)
                            .sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1))
                    ];
                })
            )
            .subscribe((employees) => {
                this.availableEmployees$.next(employees);
                this.filteredEmployees$.next(employees);
            });

        this.overlayService.isDialogDisplayed$.next(true);
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.availableEmployees$.complete();
        this.filteredEmployees$.complete();
        this.overlayService.isDialogDisplayed$.next(false);
    }

    selectEmployee(employee: PersonnelAccount): void {
        this.dialogRef.close(employee);
    }

    onSelect(selectedList: MatSelectionListChange, selectedSet: Set<number>): void {
        const elem = selectedList.options.map((option) => option.value as number).pop();
        if (selectedSet.has(elem)) {
            selectedSet.delete(elem);
        } else {
            selectedSet.add(elem);
        }

        this.selected$.next(selectedSet);
    }

    closeDialog(value: Set<number> | null): void {
        this.dialogRef.close(value ? Array.from(value) : null);
    }
}
