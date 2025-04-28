import { ChangeDetectionStrategy, Component, Inject, OnDestroy, OnInit } from '@angular/core';
import {
    UntypedFormBuilder,
    UntypedFormControl,
    UntypedFormGroup,
    Validators,
    FormsModule,
    ReactiveFormsModule
} from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatOption } from '@angular/material/core';
import { MatSelect } from '@angular/material/select';
import { MatInput } from '@angular/material/input';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AsyncPipe } from '@angular/common';
import {
    debounceTime,
    filter,
    map,
    startWith,
    switchMap,
    take,
    takeUntil,
    tap
} from 'rxjs/operators';
import { BehaviorSubject, combineLatest, Observable, of, Subject } from 'rxjs';
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search';
import { NotificationService } from '../../../core/services/notification.service';
import { HermesAdminService } from '../../../protocol/web-admin-protocol.service';
import { HermesDirectoryService } from '../../../protocol/web-directory-protocol.service';
import { HermesOfficeService } from '../../../protocol/web-office-protocol.service';
import {
    BadRequestError,
    ForbiddenError,
    InternalServerError,
    NotFoundError,
    OrderDirection
} from '../../../protocol/data-protocol';
import { Country, Office, PersonnelGroup } from '../../../protocol/db-protocol';
import {
    CreateOfficeRequest,
    OfficeManagementError,
    PersonnelGroupOrderBy,
    UpdateOfficeRequest
} from '../../../protocol/web-protocol';

enum Fields {
    Name = 'name',
    City = 'city',
    CountryId = 'countryId',
    Address = 'address',
    PostalCode = 'postalCode',
    GroupId = 'groupId',
    VismaCountry = 'vismaCountry',
    VismaCompanyId = 'vismaCompanyId'
}

enum Command {
    Create,
    Update
}

@Component({
    templateUrl: 'office-edit-dialog.component.html',
    styleUrls: ['office-edit-dialog.component.scss'],
    standalone: true,
    imports: [
        CdkScrollable,
        FormsModule,
        ReactiveFormsModule,
        MatFormField,
        MatLabel,
        MatInput,
        MatSelect,
        MatOption,
        NgxMatSelectSearchModule,
        AsyncPipe,
        MatDialogModule,
        MatButtonModule,
        MatIconModule
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class OfficeEditDialogComponent implements OnInit, OnDestroy {
    destroy$ = new Subject<void>();
    loading$: BehaviorSubject<boolean>;
    countries$ = new Observable<Country[]>(null);
    changed$ = new BehaviorSubject<boolean>(false);
    patch$ = new BehaviorSubject<UpdateOfficeRequest>(new UpdateOfficeRequest());
    personnelGroups$ = new Observable<PersonnelGroup[]>();
    updateEvent$ = new Subject();
    pristineOffice$ = new BehaviorSubject<Office>(null);
    countryFilterControl = new UntypedFormControl();
    groupFilterControl = new UntypedFormControl();
    officeForm: UntypedFormGroup;
    fields = Fields;
    errorMessage?: string = null;

    constructor(
        public dialogRef: MatDialogRef<OfficeEditDialogComponent>,
        private fb: UntypedFormBuilder,
        private hermesOfficeService: HermesOfficeService,
        private hermesDirectoryService: HermesDirectoryService,
        private hermesAdminService: HermesAdminService,
        private notificationService: NotificationService,
        @Inject(MAT_DIALOG_DATA) public data: Office | null
    ) {
        of(data)
            .pipe(
                takeUntil(this.destroy$),
                map((officeData) => officeData || new Office()),
                tap((officeData) => this.pristineOffice$.next(officeData)),
                map((officeData) => this.createForm(officeData)),
                // eslint-disable-next-line no-return-assign
                tap((form) => (this.officeForm = form)),
                switchMap((officeForm: UntypedFormGroup) =>
                    combineLatest([
                        this.pristineOffice$
                            .asObservable()
                            .pipe(filter((office) => office instanceof Office)),
                        officeForm.valueChanges.pipe(
                            debounceTime(150),
                            map((office) => this.formatControls(office))
                        )
                    ])
                ),
                map(([office, formData]) =>
                    this.getPatch(office, formData, data === null ? Command.Create : Command.Update)
                ),
                tap((patch) => {
                    this.changed$.next(
                        Object.values(patch).filter((f) => f !== undefined).length > 0
                    );
                })
            )
            .subscribe((patch: UpdateOfficeRequest | CreateOfficeRequest) =>
                this.patch$.next(patch)
            );
    }

    ngOnInit(): void {
        this.loading$ = new BehaviorSubject<boolean>(false);
        this.updateButtonHandler();
        this.countries$ = this.suggestCountries(this.countryFilterControl);
        this.personnelGroups$ = this.suggestPersonnelGroups(this.groupFilterControl);
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.loading$.complete();
        this.changed$.complete();
        this.pristineOffice$.complete();
        this.patch$.complete();
        this.updateEvent$.complete();
    }

    createForm(office: Office): UntypedFormGroup {
        return this.fb.group({
            [Fields.Name]: [office[Fields.Name], Validators.required],
            [Fields.Address]: [office[Fields.Address]],
            [Fields.CountryId]: [office?.countryId ?? null, Validators.required],
            [Fields.City]: [office[Fields.City]],
            [Fields.PostalCode]: [office[Fields.PostalCode]],
            [Fields.GroupId]: [office?.groupId ?? null],
            [Fields.VismaCountry]: [office?.vismaCountry ?? null],
            [Fields.VismaCompanyId]: [office?.vismaCompanyId ?? null]
        });
    }

    updateButtonHandler(): void {
        this.updateEvent$
            .pipe(
                takeUntil(this.destroy$),
                switchMap(() => combineLatest([this.pristineOffice$, this.patch$]).pipe(take(1)))
            )
            .subscribe(([office, patch]: [Office, UpdateOfficeRequest | CreateOfficeRequest]) => {
                if (patch instanceof UpdateOfficeRequest) {
                    this.editOfficeRequest(office.id, patch);
                } else {
                    this.createOfficeRequest(patch);
                }
            });
    }

    formatControls(formOffice: UntypedFormGroup): UntypedFormGroup {
        return Object.entries(formOffice).reduce((result, [key, value]) => {
            result[key] = value === '' ? null : value;
            return result;
        }, {}) as UntypedFormGroup;
    }

    editOfficeRequest(officeId: number, patch: UpdateOfficeRequest): void {
        this.hermesOfficeService
            .updateOffice(patch, officeId)
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (office) => {
                    this.notificationService.success(`Office ${office.name} updated`);
                    this.dialogRef.close(office);
                },
                (error) => this.handleBadRequestError(error)
            );
    }

    createOfficeRequest(patch: CreateOfficeRequest): void {
        this.hermesOfficeService
            .createOffice(patch)
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (office) => {
                    this.notificationService.success(`Office ${office.name} added`);
                    this.dialogRef.close(office);
                },
                (error) => this.handleBadRequestError(error)
            );
    }

    handleBadRequestError(
        error:
            | BadRequestError<OfficeManagementError>
            | ForbiddenError
            | NotFoundError
            | InternalServerError
    ): void {
        let errorMessage: string | null = null;
        let letsClose = true;

        if (error instanceof BadRequestError) {
            const e: BadRequestError<OfficeManagementError> = error;
            switch (e.error) {
                case OfficeManagementError.CountryNotExists:
                    errorMessage = 'Country not exists';
                    letsClose = false;
                    break;
                case OfficeManagementError.GroupNotExists:
                    errorMessage = 'Group not exists';
                    letsClose = false;
                    break;
                case OfficeManagementError.InvalidAddress:
                    errorMessage = 'Invalid address';
                    letsClose = false;
                    break;
                case OfficeManagementError.InvalidCity:
                    errorMessage = 'Invalid city';
                    letsClose = false;
                    break;
                case OfficeManagementError.InvalidCountryId:
                    errorMessage = 'Invalid country id';
                    letsClose = false;
                    break;
                case OfficeManagementError.InvalidGroupId:
                    errorMessage = 'Invalid group id';
                    letsClose = false;
                    break;
                case OfficeManagementError.InvalidName:
                    errorMessage = 'Invalid name';
                    letsClose = false;
                    break;
                case OfficeManagementError.InvalidPostalCode:
                    errorMessage = 'Invalid postal code';
                    letsClose = false;
                    break;
                case OfficeManagementError.NameAlreadyExists:
                    errorMessage = 'Name already exists';
                    letsClose = false;
                    break;
                default:
                    errorMessage = `Error: ${error.error}`;
                    break;
            }
        } else if (error instanceof ForbiddenError) {
            errorMessage = 'Forbidden';
            letsClose = true;
        } else if (error instanceof NotFoundError) {
            errorMessage = 'employee not found';
            letsClose = true;
        } else if (error instanceof InternalServerError) {
            errorMessage = 'internal server error';
            letsClose = true;
        } else {
            errorMessage = `Error: ${error}`;
        }

        this.notificationService.error(errorMessage);

        if (letsClose) {
            this.dialogRef.close();
        }
    }

    private suggestCountries(control: UntypedFormControl): Observable<Country[]> {
        return combineLatest([
            control.valueChanges.pipe(
                takeUntil(this.destroy$),
                startWith(''),
                map((needle) => (needle || '').trim().toLowerCase())
            ),
            this.hermesDirectoryService.getCountries().pipe(
                takeUntil(this.destroy$),
                map((obj) => obj.items)
            )
        ]).pipe(
            takeUntil(this.destroy$),
            map(([needle, countries]) =>
                countries.filter((country) => country.name.toLowerCase().includes(needle))
            )
        );
    }

    private suggestPersonnelGroups(control: UntypedFormControl): Observable<PersonnelGroup[]> {
        return combineLatest([
            control.valueChanges.pipe(
                takeUntil(this.destroy$),
                startWith(''),
                map((needle) => (needle || '').trim().toLowerCase())
            ),
            // TODO: rework using API call getAllPersonnelGroups
            this.hermesAdminService
                .getPersonnelGroups(
                    null,
                    PersonnelGroupOrderBy.Name,
                    OrderDirection.Asc,
                    0,
                    1000 /* HACK */
                )
                .pipe(map((response) => response.items))
        ]).pipe(
            takeUntil(this.destroy$),
            map(([needle, groups]) =>
                groups.filter((group) => group.name.toLowerCase().includes(needle))
            )
        );
    }

    private getPatch(
        office: Office,
        formData: { Fields: any } | {},
        command: Command
    ): UpdateOfficeRequest | CreateOfficeRequest {
        return Object.entries(formData).reduce(
            (patch, [key, value]) => {
                patch[key] = office[key] !== value ? value : undefined;
                if (key === 'VismaCountry' && value) {
                    patch[key] = office[key] !== value ? value.trim() : undefined;
                }
                if (key === 'VismaCompanyId' && value) {
                    patch[key] = office[key] !== value ? value.trim() : undefined;
                }
                return patch;
            },
            command === Command.Update ? new UpdateOfficeRequest() : new CreateOfficeRequest()
        );
    }
}
