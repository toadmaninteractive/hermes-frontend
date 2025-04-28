import { ChangeDetectionStrategy, Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatCheckbox } from '@angular/material/checkbox';
import { UntypedFormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatInput } from '@angular/material/input';
import { MatFormField } from '@angular/material/form-field';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AsyncPipe } from '@angular/common';
import { MatListModule, MatSelectionListChange } from '@angular/material/list';
import { map, startWith, takeUntil } from 'rxjs/operators';
import { BehaviorSubject, combineLatest, Observable, of, Subject } from 'rxjs';
import { Role } from '../../../protocol/db-protocol';
import { HermesRoleService } from '../../../protocol/role-protocol.service';
import { Empty } from '../../../protocol/common-protocol';
import { NotificationService } from '../../../core/services/notification.service';
import { BadRequestError } from '../../../protocol/data-protocol';
import { RoleForOfficeError } from '../../../protocol/web-protocol';
import { OfficeRolesDialogData } from '../../../shared/interfaces/dialog-data.interface';

@Component({
    selector: 'app-office-roles-dialog',
    templateUrl: './office-roles-dialog.component.html',
    styleUrls: ['./office-roles-dialog.component.scss'],
    standalone: true,
    imports: [
        CdkScrollable,
        MatFormField,
        MatInput,
        FormsModule,
        ReactiveFormsModule,
        MatCheckbox,
        AsyncPipe,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatListModule
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class OfficeRolesDialogComponent implements OnInit, OnDestroy {
    destroy$ = new Subject<void>();
    changed$ = new BehaviorSubject<boolean>(false);
    officeRoles$ = new Observable<Role[]>();
    roleFilterControl = new UntypedFormControl();
    selectedRoles$ = new BehaviorSubject<Set<number>>(new Set());

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: OfficeRolesDialogData | null,
        public dialogRef: MatDialogRef<OfficeRolesDialogComponent>,
        private hermesRoleService: HermesRoleService,
        private notificationService: NotificationService
    ) {}

    ngOnInit(): void {
        this.selectedRoles$.next(new Set(this.data.office.allowedRoles));
        this.officeRoles$ = this.suggestOfficeRoles(this.roleFilterControl);
    }

    ngOnDestroy(): void {
        this.changed$.complete();
        this.destroy$.next();
        this.destroy$.complete();
        this.selectedRoles$.complete();
    }

    closeDialog(): void {
        this.dialogRef.close();
    }

    private suggestOfficeRoles(control: UntypedFormControl): Observable<Role[]> {
        return combineLatest([
            control.valueChanges.pipe(
                takeUntil(this.destroy$),
                startWith(''),
                map((needle) => (needle || '').trim().toLowerCase())
            ),
            of(this.data)
        ]).pipe(
            takeUntil(this.destroy$),
            map(([needle, roles]) =>
                roles.payload.filter(
                    (role) =>
                        role.title.toLowerCase().includes(needle) || role.code.includes(needle)
                )
            ),
            map((roles) =>
                roles.sort((a, b) => (a.title.toLowerCase() > b.title.toLowerCase() ? 1 : -1))
            )
        );
    }

    onChangeRole(event: MatSelectionListChange, selectedRoles: Set<number>): void {
        const state = event.options.at(0);
        const role: Role = state.value;

        if (state.selected) {
            this.hermesRoleService
                .enableRoleForOffice(new Empty(), role.id, this.data.office.id)
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                    next: (result) => {
                        this.notificationService.success(
                            `${role.title} enabled for ${this.data?.office?.name ?? 'office'}`
                        );
                    },
                    error: (error) => {
                        if (error instanceof BadRequestError) {
                            const errorMessage = RoleForOfficeError.getDescription(error.error);
                            this.notificationService.error(errorMessage ?? error);
                        } else {
                            this.notificationService.error(error);
                        }
                    }
                });
            selectedRoles.add(role.id);
        } else {
            this.hermesRoleService
                .disableRoleForOffice(new Empty(), role.id, this.data.office.id)
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                    next: (result) => {
                        this.notificationService.success(
                            `${role.title} disabled for ${this.data?.office?.name ?? 'office'}`
                        );
                    },
                    error: (error) => {
                        if (error instanceof BadRequestError) {
                            const errorMessage = RoleForOfficeError.getDescription(error.error);
                            this.notificationService.error(errorMessage ?? error);
                        } else {
                            this.notificationService.error(error);
                        }
                    }
                });
            selectedRoles.delete(role.id);
        }
        this.selectedRoles$.next(selectedRoles);
    }
}
