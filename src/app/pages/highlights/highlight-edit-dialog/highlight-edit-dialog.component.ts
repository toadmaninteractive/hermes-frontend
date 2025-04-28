import { ChangeDetectionStrategy, Component, Inject, OnDestroy, OnInit } from '@angular/core';
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
import {
    debounceTime,
    distinctUntilChanged,
    filter,
    map,
    switchMap,
    take,
    takeUntil,
    tap
} from 'rxjs/operators';
import { BehaviorSubject, combineLatest, of, Subject } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import {
    BadRequestError,
    ForbiddenError,
    InternalServerError,
    NotFoundError
} from '../../../protocol/data-protocol';
import { Highlight } from '../../../protocol/db-protocol';
import {
    CreateHighlightRequest,
    HighlightError,
    UpdateHighlightRequest,
    UpdateTeamRequest
} from '../../../protocol/web-protocol';
import { HermesHighlightService } from '../../../protocol/highlight-protocol.service';

enum Fields {
    Title = 'title',
    Code = 'code'
}

enum Command {
    Create,
    Update
}

@Component({
    selector: 'app-highlight-edit-dialog',
    templateUrl: './highlight-edit-dialog.component.html',
    styleUrls: ['./highlight-edit-dialog.component.scss'],
    standalone: true,
    imports: [
        CdkScrollable,
        FormsModule,
        ReactiveFormsModule,
        MatFormField,
        MatLabel,
        MatInput,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        AsyncPipe
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class HighlightEditDialogComponent implements OnInit, OnDestroy {
    destroy$ = new Subject<void>();
    updateEvent$ = new Subject();
    loading$ = new BehaviorSubject<boolean>(false);
    patch$ = new BehaviorSubject<UpdateHighlightRequest>(new UpdateHighlightRequest());
    pristineHighlight$ = new BehaviorSubject<Highlight>(null);
    changed$ = new BehaviorSubject<boolean>(false);
    fields = Fields;
    highlightId = null;
    highlightForm: UntypedFormGroup;

    constructor(
        public dialogRef: MatDialogRef<HighlightEditDialogComponent>,
        private fb: UntypedFormBuilder,
        private highlightService: HermesHighlightService,
        private notificationService: NotificationService,
        @Inject(MAT_DIALOG_DATA) public data: Highlight
    ) {
        of(data)
            .pipe(
                takeUntil(this.destroy$),
                map((highlight) => highlight || new Highlight()),
                tap((highlight) => this.pristineHighlight$.next(highlight)),
                // eslint-disable-next-line no-return-assign
                tap((highlight) => (this.highlightId = highlight?.id ?? null)),
                map((highlight) => this.createForm(highlight)),
                // eslint-disable-next-line no-return-assign
                tap((form) => (this.highlightForm = form)),
                tap(() => this.interceptTitleChange()),
                switchMap((highlightForm: UntypedFormGroup) =>
                    combineLatest([
                        this.pristineHighlight$
                            .asObservable()
                            .pipe(filter((highlight) => highlight instanceof Highlight)),
                        highlightForm.valueChanges.pipe(debounceTime(150))
                    ])
                ),
                map(([highlight, formData]) =>
                    this.getPatch(
                        highlight,
                        formData,
                        data === null ? Command.Create : Command.Update
                    )
                ),
                tap((patch) => {
                    this.changed$.next(
                        Object.values(patch).filter((f) => f !== undefined).length > 0
                    );
                })
            )
            .subscribe((patch: UpdateHighlightRequest | CreateHighlightRequest) =>
                this.patch$.next(patch)
            );
    }

    ngOnInit(): void {
        this.updateButtonHandler();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.loading$.complete();
        this.patch$.complete();
        this.pristineHighlight$.complete();
        this.changed$.complete();
        this.updateEvent$.complete();
    }

    createForm(highlight: Highlight): UntypedFormGroup {
        return this.fb.group({
            [Fields.Title]: highlight.title,
            [Fields.Code]: highlight.code
        });
    }

    interceptTitleChange(): void {
        this.highlightForm
            .get(Fields.Title)
            .valueChanges.pipe(distinctUntilChanged(), debounceTime(250), takeUntil(this.destroy$))
            .subscribe((changes: string) =>
                this.highlightForm
                    .get(Fields.Code)
                    .setValue(changes.toLowerCase().replace(' ', '.'))
            );
    }

    updateButtonHandler(): void {
        this.updateEvent$
            .pipe(
                switchMap(() =>
                    combineLatest([of(this.highlightId), this.patch$.asObservable()]).pipe(take(1))
                ),
                takeUntil(this.destroy$)
            )
            .subscribe(([highlightId, patch]) => {
                if (patch instanceof UpdateTeamRequest) {
                    this.editOfficeRequest(highlightId, patch);
                } else {
                    this.createOfficeRequest(patch);
                }
            });
    }

    editOfficeRequest(highlightId: number, patch: UpdateHighlightRequest): void {
        this.highlightService
            .updateHighlight(patch, highlightId)
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (highlight) => {
                    this.notificationService.success(`Highlight ${highlight.title} is updated`);
                    this.dialogRef.close(highlight);
                },
                (error) => this.handleBadRequestError(error)
            );
    }

    createOfficeRequest(patch: CreateHighlightRequest): void {
        this.highlightService
            .createHighlight(patch)
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (highilight) => {
                    this.notificationService.success(`Highlight ${highilight.title} is created`);
                    this.dialogRef.close(highilight);
                },
                (error) => this.handleBadRequestError(error)
            );
    }

    handleBadRequestError(
        error:
            | BadRequestError<HighlightError>
            | ForbiddenError
            | NotFoundError
            | InternalServerError
    ): void {
        let errorMessage: string = null;
        let letsClose = true;

        if (error instanceof BadRequestError) {
            switch (error.error) {
                case HighlightError.InvalidCode:
                    errorMessage = 'Invalid code';
                    break;
                case HighlightError.InvalidTitle:
                    errorMessage = 'Invalid title';
                    letsClose = false;
                    break;
                case HighlightError.TitleAlreadyExists:
                    errorMessage = 'Title already exists';
                    letsClose = false;
                    break;
                default:
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

    private getPatch(
        highlight: Highlight,
        // eslint-disable-next-line @typescript-eslint/ban-types
        formData: { Fields: any } | {},
        command: Command
    ): UpdateHighlightRequest | CreateHighlightRequest {
        return Object.entries(formData).reduce(
            (patch, [key, value]) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,no-param-reassign
                patch[key] = highlight[key] !== value ? value : undefined;
                return patch;
            },
            command === Command.Update ? new UpdateHighlightRequest() : new CreateHighlightRequest()
        );
    }
}
