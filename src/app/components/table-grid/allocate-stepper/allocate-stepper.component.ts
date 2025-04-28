import {
    AfterViewInit,
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    Inject,
    OnDestroy,
    ViewChild
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatStepperModule } from '@angular/material/stepper';
import { AsyncPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DomPortal, PortalModule } from '@angular/cdk/portal';
import { StepperSelectionEvent } from '@angular/cdk/stepper';
import { take, takeUntil } from 'rxjs/operators';
import { BehaviorSubject, Subject } from 'rxjs';
import { EmployeeData } from '../select-employee-dialog/select-employee-dialog.component';
import { CacheService } from '../../../core/services/cache.service';
import { AllocateEmployeeData } from '../../../shared/interfaces/dialog-data.interface';
import { AllocateEmployeeComponent } from './allocate-employee/allocate-employee.component';
import { SelectEmployeeComponent } from './select-employee/select-employee.component';

export interface AllocateResult {
    linked: Array<number>;
    allocated: Array<number>;
}

@Component({
    selector: 'app-allocate-stepper',
    templateUrl: 'allocate-stepper.component.html',
    styleUrls: ['allocate-stepper.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        SelectEmployeeComponent,
        AllocateEmployeeComponent,
        AsyncPipe,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatStepperModule,
        PortalModule
    ]
})
export class AllocateStepperComponent implements OnDestroy, AfterViewInit {
    @ViewChild('actionsSelectContent') step1Actions: ElementRef<HTMLDivElement>;
    @ViewChild('actionsAllocateContent') step2Actions: ElementRef<HTMLDivElement>;

    destroy$ = new Subject<void>();
    allocated$ = new BehaviorSubject<Set<number>>(new Set());
    selected$ = new BehaviorSubject<Set<number>>(new Set());
    secondStepData$ = new BehaviorSubject<AllocateEmployeeData>({} as AllocateEmployeeData);
    actionsPortal: DomPortal<HTMLDivElement>;
    constructor(
        public dialogRef: MatDialogRef<AllocateStepperComponent>,
        @Inject(MAT_DIALOG_DATA) public data: EmployeeData,
        private cacheService: CacheService
    ) {}

    updatePortal(step?: StepperSelectionEvent) {
        switch (step?.selectedIndex) {
            default:
            case 0:
                this.actionsPortal = new DomPortal(this.step1Actions);
                break;
            case 1:
                this.actionsPortal = new DomPortal(this.step2Actions);
                break;
        }
    }

    ngAfterViewInit() {
        this.updatePortal();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.allocated$.complete();
        this.selected$.complete();
        this.secondStepData$.complete();
    }

    onSelectEmployees(selectedEmployees: Set<number>): void {
        this.cacheService.employees$.pipe(take(1), takeUntil(this.destroy$)).subscribe((emp) => {
            const employeesToLink = emp
                .filter((e) => selectedEmployees.has(e.id))
                .sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1));
            this.selected$.next(new Set(employeesToLink.map((e) => e.id)));
            this.secondStepData$.next({ employees: employeesToLink });
        });
    }

    onAllocateEmployees(allocated: Set<number>): void {
        this.allocated$.next(allocated);
    }

    onDialogComplete(selected: Set<number>, allocated: Set<number>): void {
        const linked = Array.from(selected).filter((id) => !allocated.has(id));
        this.dialogRef.close({
            linked: Array.from(linked),
            allocated: Array.from(allocated)
        } satisfies AllocateResult);
    }
}
