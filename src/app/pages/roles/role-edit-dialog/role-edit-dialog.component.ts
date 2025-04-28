import { Component, Inject, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import {
    UntypedFormBuilder,
    UntypedFormGroup,
    FormsModule,
    ReactiveFormsModule
} from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatInput } from '@angular/material/input';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AsyncPipe } from '@angular/common';
import { filter, map, switchMap, take, takeUntil, tap } from 'rxjs/operators';
import { BehaviorSubject, combineLatest, of, Subject } from 'rxjs';
import { Role } from '../../../protocol/db-protocol';
import { NotificationService } from '../../../core/services/notification.service';
import {
    BadRequestError,
    ForbiddenError,
    InternalServerError,
    NotFoundError
} from '../../../protocol/data-protocol';
import { HermesRoleService } from '../../../protocol/role-protocol.service';
import { CreateRoleRequest, RoleError, UpdateRoleRequest } from '../../../protocol/web-protocol';

enum Fields {
    Code = 'code',
    Title = 'title'
}

enum Command {
    Create,
    Update
}

@Component({
    templateUrl: './role-edit-dialog.component.html',
    styleUrls: ['./role-edit-dialog.component.scss'],
    standalone: true,
    imports: [
        CdkScrollable,
        FormsModule,
        ReactiveFormsModule,
        MatFormField,
        MatLabel,
        MatInput,
        AsyncPipe,
        MatDialogModule,
        MatButtonModule,
        MatIconModule
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoleEditDialogComponent implements OnInit, OnDestroy {
    destroy$ = new Subject<void>();
    save$ = new Subject();
    loading$ = new BehaviorSubject<boolean>(false);
    patch$ = new BehaviorSubject<UpdateRoleRequest>(new UpdateRoleRequest());
    pristineRole$ = new BehaviorSubject<Role>(null);
    changed$ = new BehaviorSubject<boolean>(false);
    valid$ = new BehaviorSubject<boolean>(false);
    field = Fields;
    roleId = null;
    roleForm: UntypedFormGroup;

    constructor(
        public dialogRef: MatDialogRef<RoleEditDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: Role,
        private fb: UntypedFormBuilder,
        private hermesRoleService: HermesRoleService,
        private notificationService: NotificationService
    ) {
        of(data)
            .pipe(
                takeUntil(this.destroy$),
                map((role) => role || this.initializeRole()),
                tap((role) => this.pristineRole$.next(role)),
                tap((role) => (this.roleId = role?.id ?? null)),
                map((role) => this.createForm(role)),
                tap((form) => (this.roleForm = form)),
                switchMap((formGroup: UntypedFormGroup) =>
                    combineLatest([
                        this.pristineRole$
                            .asObservable()
                            .pipe(filter((role) => role instanceof Role)),
                        formGroup.valueChanges.pipe()
                    ])
                ),
                tap(([role, form]) => this.valid$.next(this.isRoleValid(form))),
                map(([role, formData]) =>
                    this.getPatch(role, formData, data === null ? Command.Create : Command.Update)
                ),
                tap((patch) => {
                    this.changed$.next(
                        Object.values(patch).filter((f) => f !== undefined).length > 0
                    );
                })
            )
            .subscribe((patch: UpdateRoleRequest | CreateRoleRequest) => this.patch$.next(patch));
    }

    ngOnInit(): void {
        this.handleCreateOrUpdate();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.loading$.complete();
        this.patch$.complete();
        this.pristineRole$.complete();
        this.changed$.complete();
        this.save$.complete();
        this.valid$.complete();
    }

    private initializeRole(): Role {
        const role = new Role();
        role.title = '';
        role.code = '';
        return role;
    }

    private isRoleValid(role: Record<string, string>): boolean {
        return role.title?.trim().length > 0 && role.code?.trim().length > 0;
    }

    private createForm(role: Role): UntypedFormGroup {
        return this.fb.group({
            [Fields.Code]: [role[Fields.Code]],
            [Fields.Title]: [role[Fields.Title]]
        });
    }

    private handleCreateOrUpdate(): void {
        this.save$
            .asObservable()
            .pipe(
                takeUntil(this.destroy$),
                switchMap((_) => combineLatest([of(this.roleId), this.patch$]).pipe(take(1)))
            )
            .subscribe(([officeId, patch]) => {
                if (patch instanceof UpdateRoleRequest) {
                    this.updateRole(officeId, patch);
                } else {
                    this.createRole(patch);
                }
            });
    }

    private getPatch(
        role: Role,
        formData: Record<string, string>,
        command: Command
    ): UpdateRoleRequest | CreateRoleRequest {
        return Object.entries(formData).reduce(
            (patch, [key, value]) => {
                patch[key] = role[key] !== value ? value : undefined;
                return patch;
            },
            // FIXME: violates single responsibility principle
            command === Command.Update ? new UpdateRoleRequest() : new CreateRoleRequest()
        );
    }

    private createRole(body: CreateRoleRequest): void {
        this.hermesRoleService
            .createRole(body)
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (role) => {
                    this.notificationService.success(`Role ${role.title} added`);
                    this.dialogRef.close(role);
                },
                (error) => this.onRequestError(error)
            );
    }

    private updateRole(roleId: number, patch: UpdateRoleRequest): void {
        this.hermesRoleService
            .updateRole(patch, roleId)
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (role) => {
                    this.notificationService.success(`Role ${role.title} updated`);
                    this.dialogRef.close(role);
                },
                (error) => this.onRequestError(error)
            );
    }

    private onRequestError(
        response: BadRequestError<RoleError> | ForbiddenError | NotFoundError | InternalServerError
    ): void {
        let errorMessage: string = null;
        let shouldClose = true;

        if (response instanceof BadRequestError) {
            shouldClose = false;

            switch (response.error) {
                case RoleError.CodeAlreadyExists:
                    errorMessage = 'Code already exists';
                    break;
                case RoleError.InvalidCode:
                    errorMessage = 'Invalid code';
                    break;
                case RoleError.InvalidTitle:
                    errorMessage = 'Invalid title';
                    break;
                case RoleError.TitleAlreadyExists:
                    errorMessage = 'Title already exists';
                    break;
                default:
                    errorMessage = 'Unexpected error';
            }
        } else if (response instanceof ForbiddenError) {
            errorMessage = 'Forbidden';
        } else if (response instanceof NotFoundError) {
            errorMessage = 'Employee not found';
        } else if (response instanceof InternalServerError) {
            errorMessage = 'Internal server error';
        }

        this.notificationService.error(errorMessage);

        if (shouldClose) {
            this.dialogRef.close();
        }
    }
}
