import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    OnDestroy,
    OnInit,
    Output,
    Self
} from '@angular/core';
import { MatSelectionListChange, MatSelectionList, MatListOption } from '@angular/material/list';
import { MatIcon } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatInput } from '@angular/material/input';
import { MatFormField, MatSuffix } from '@angular/material/form-field';
import { AsyncPipe } from '@angular/common';
import {
    debounceTime,
    distinctUntilChanged,
    map,
    switchMap,
    take,
    takeUntil,
    tap
} from 'rxjs/operators';
import { BehaviorSubject, combineLatest, Subject } from 'rxjs';
import { OverlayService } from '../../../../core/services/overlay.service';
import { AccountService } from '../../../../core/services/account.service';
import { CacheService } from '../../../../core/services/cache.service';
import { PersonnelAccount } from '../../../../protocol/db-protocol';
import { FilterService } from '../../../../core/services/filter.service';

export interface EmployeeData {
    header: string;
    existingEmployees: PersonnelAccount[];
    projectId: number;
    multiple: boolean;
}

@Component({
    selector: 'app-select-employee',
    templateUrl: 'select-employee.component.html',
    styleUrls: ['select-employee.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatFormField,
        MatInput,
        FormsModule,
        MatIconButton,
        MatSuffix,
        MatIcon,
        MatSelectionList,
        MatListOption,
        AsyncPipe,
        ReactiveFormsModule
    ],
    providers: [FilterService]
})
export class SelectEmployeeComponent implements OnInit, OnDestroy {
    @Input() data: EmployeeData;
    @Output() readonly selectedEmployees = new EventEmitter<Set<number>>();
    destroy$ = new Subject<void>();
    filteredEmployees$ = new BehaviorSubject<PersonnelAccount[]>(null);
    availableEmployees$ = new BehaviorSubject<PersonnelAccount[]>(null);
    existingEmployees = new Set<number>();
    selected$ = new BehaviorSubject<Set<number>>(new Set());

    filterControl = this.filterService.filterControl;
    needle$ = this.filterService.needle$;

    constructor(
        public cacheService: CacheService,
        public accountService: AccountService,
        private overlayService: OverlayService,
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

    onSelect(selectedList: MatSelectionListChange, selectedSet: Set<number>): void {
        const elem = selectedList.options.map((option) => option.value as number).pop();
        if (selectedSet.has(elem)) {
            selectedSet.delete(elem);
        } else {
            selectedSet.add(elem);
        }

        this.selected$.next(selectedSet);
        this.selectedEmployees.emit(selectedSet);
    }
}
