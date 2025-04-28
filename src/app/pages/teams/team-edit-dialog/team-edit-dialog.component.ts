import { Component, OnInit, OnDestroy, Inject, ChangeDetectionStrategy } from '@angular/core';
import {
    UntypedFormGroup,
    UntypedFormBuilder,
    FormsModule,
    ReactiveFormsModule
} from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatInput } from '@angular/material/input';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AsyncPipe } from '@angular/common';
import { takeUntil, map, tap, switchMap, filter, debounceTime, take } from 'rxjs/operators';
import { BehaviorSubject, Subject, combineLatest, of } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import {
    BadRequestError,
    ForbiddenError,
    NotFoundError,
    InternalServerError
} from '../../../protocol/data-protocol';
import { HermesTeamService } from '../../../protocol/team-protocol.service';
import { Team } from '../../../protocol/db-protocol';
import { UpdateTeamRequest, CreateTeamRequest, TeamError } from '../../../protocol/web-protocol';

enum Fields {
    Title = 'title'
}

enum Command {
    Create,
    Update
}

@Component({
    selector: 'app-team-edit-dialog',
    templateUrl: './team-edit-dialog.component.html',
    styleUrls: ['./team-edit-dialog.component.scss'],
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
export class TeamEditDialogComponent implements OnInit, OnDestroy {
    destroy$ = new Subject<void>();
    updateEvent$ = new Subject();
    loading$ = new BehaviorSubject<boolean>(false);
    patch$ = new BehaviorSubject<UpdateTeamRequest>(new UpdateTeamRequest());
    pristineTeam$ = new BehaviorSubject<Team>(null);
    changed$ = new BehaviorSubject<boolean>(false);
    fields = Fields;
    teamId = null;
    teamForm: UntypedFormGroup;

    constructor(
        public dialogRef: MatDialogRef<TeamEditDialogComponent>,
        private fb: UntypedFormBuilder,
        private hermesTeamService: HermesTeamService,
        private notificationService: NotificationService,
        @Inject(MAT_DIALOG_DATA) public data: Team
    ) {
        of(data)
            .pipe(
                takeUntil(this.destroy$),
                map((team) => team || new Team()),
                tap((team) => this.pristineTeam$.next(team)),
                tap((team) => (this.teamId = team?.id ?? null)),
                map((team) => this.createForm(team)),
                tap((form) => (this.teamForm = form)),
                switchMap((teamForm: UntypedFormGroup) =>
                    combineLatest([
                        this.pristineTeam$
                            .asObservable()
                            .pipe(filter((team) => team instanceof Team)),
                        teamForm.valueChanges.pipe(debounceTime(150))
                    ])
                ),
                map(([team, formData]) =>
                    this.getPatch(team, formData, data === null ? Command.Create : Command.Update)
                ),
                tap((patch) => {
                    this.changed$.next(
                        Object.values(patch).filter((f) => f !== undefined).length > 0
                    );
                })
            )
            .subscribe((patch: UpdateTeamRequest | CreateTeamRequest) => this.patch$.next(patch));
    }

    ngOnInit(): void {
        this.updateButtonHandler();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.loading$.complete();
        this.patch$.complete();
        this.pristineTeam$.complete();
        this.changed$.complete();
        this.updateEvent$.complete();
    }

    createForm(team: Team): UntypedFormGroup {
        return this.fb.group({
            [Fields.Title]: team.title
        });
    }

    private getPatch(
        team: Team,
        formData: { Fields: any } | {},
        command: Command
    ): UpdateTeamRequest | CreateTeamRequest {
        return Object.entries(formData).reduce(
            (patch, [key, value]) => {
                patch[key] = team[key] !== value ? value : undefined;
                return patch;
            },
            command === Command.Update ? new UpdateTeamRequest() : new CreateTeamRequest()
        );
    }

    updateButtonHandler(): void {
        this.updateEvent$
            .pipe(
                takeUntil(this.destroy$),
                switchMap(() =>
                    combineLatest([of(this.teamId), this.patch$.asObservable()]).pipe(take(1))
                )
            )
            .subscribe(([teamId, patch]) => {
                if (patch instanceof UpdateTeamRequest) {
                    this.editOfficeRequest(teamId, patch);
                } else {
                    this.createOfficeRequest(patch);
                }
            });
    }

    editOfficeRequest(teamId: number, patch: UpdateTeamRequest): void {
        this.hermesTeamService
            .updateTeam(patch, teamId)
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (team) => {
                    this.notificationService.success(`Team ${team.title} is updated`);
                    this.dialogRef.close(team);
                },
                (error) => this.handleBadRequestError(error)
            );
    }

    createOfficeRequest(patch: CreateTeamRequest): void {
        this.hermesTeamService
            .createTeam(patch)
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (team) => {
                    this.notificationService.success(`Team ${team.title} is created`);
                    this.dialogRef.close(team);
                },
                (error) => this.handleBadRequestError(error)
            );
    }

    handleBadRequestError(
        error: BadRequestError<TeamError> | ForbiddenError | NotFoundError | InternalServerError
    ): void {
        let errorMessage: string = null;
        let letsClose = true;

        if (error instanceof BadRequestError) {
            switch (error.error) {
                case TeamError.CreatedByNotExists:
                    errorMessage = 'Created by not exists';
                    break;
                case TeamError.InvalidCreatedBy:
                    errorMessage = 'Invalid created by';
                    break;
                case TeamError.InvalidTitle:
                    errorMessage = 'Invalid title';
                    letsClose = false;
                    break;
                case TeamError.TitleAlreadyExists:
                    errorMessage = 'Title already exists';
                    letsClose = false;
                    break;
            }
        } else if (error instanceof ForbiddenError) {
            errorMessage = 'Forbidden';
        } else if (error instanceof NotFoundError) {
            errorMessage = 'employee not found';
        } else if (error instanceof InternalServerError) {
            errorMessage = 'internal server error';
        }

        this.notificationService.error(errorMessage);

        if (letsClose) {
            this.dialogRef.close();
        }
    }
}
