import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    OnDestroy,
    OnInit,
    Output
} from '@angular/core';
import { MatSelectionListChange, MatSelectionList, MatListOption } from '@angular/material/list';
import { MatIcon } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatInput } from '@angular/material/input';
import { MatFormField, MatSuffix } from '@angular/material/form-field';
import { AsyncPipe } from '@angular/common';
import { BehaviorSubject, map, Subject, switchMap, take, takeUntil } from 'rxjs';
import { OverlayService } from '../../../../core/services/overlay.service';
import { AccountService } from '../../../../core/services/account.service';
import { CacheService } from '../../../../core/services/cache.service';
import { PersonnelAccount } from '../../../../protocol/db-protocol';
import { AllocateEmployeeData } from '../../../../shared/interfaces/dialog-data.interface';
import { FilterService } from '../../../../core/services/filter.service';

@Component({
    selector: 'app-allocate',
    templateUrl: 'allocate-employee.component.html',
    styleUrls: ['allocate-employee.component.scss'],
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
export class AllocateEmployeeComponent implements OnInit, OnDestroy {
    @Output() readonly allocatedEmployees = new EventEmitter<Set<number> | null>();
    destroy$ = new Subject<void>();
    filteredEmployees$ = new BehaviorSubject<PersonnelAccount[]>([]);
    availableEmployees$ = new BehaviorSubject<PersonnelAccount[]>([]);
    selected$ = new BehaviorSubject<Set<number>>(new Set());

    filterControl = this.filterService.filterControl;
    private needle$ = this.filterService.needle$;

    constructor(
        public cacheService: CacheService,
        public accountService: AccountService,
        private overlayService: OverlayService,
        private filterService: FilterService
    ) {}

    @Input() set data(value: AllocateEmployeeData) {
        if (value.employees) {
            this.availableEmployees$.next(value.employees);
            this.filteredEmployees$.next(value.employees);
            const emplIds = value.employees.map((e) => e.id);
            const updatedSet = new Set(
                Array.from(this.selected$.getValue()).filter((s) => emplIds.find((e) => e === s))
            );
            this.selected$.next(updatedSet);
            this.allocatedEmployees.emit(updatedSet);
        }
    }

    ngOnInit(): void {
        this.overlayService.isDialogDisplayed$.next(true);

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
        this.allocatedEmployees.emit(selectedSet);
    }
}
