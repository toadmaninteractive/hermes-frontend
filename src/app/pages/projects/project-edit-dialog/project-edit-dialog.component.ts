import { ChangeDetectionStrategy, Component, Inject, OnDestroy, OnInit } from '@angular/core';
import {
    AbstractControl,
    UntypedFormBuilder,
    UntypedFormControl,
    UntypedFormGroup,
    ValidationErrors,
    ValidatorFn,
    Validators,
    FormsModule,
    ReactiveFormsModule
} from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import {
    MatDatepickerInput,
    MatDatepickerToggle,
    MatDatepicker
} from '@angular/material/datepicker';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatOption } from '@angular/material/core';
import { MatSelect } from '@angular/material/select';
import { MatInput } from '@angular/material/input';
import { MatFormField, MatLabel, MatHint, MatSuffix, MatError } from '@angular/material/form-field';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { MatIconModule } from '@angular/material/icon';
import { MatButton, MatButtonModule } from '@angular/material/button';
import { NgClass, AsyncPipe, KeyValuePipe } from '@angular/common';
import { provideDateFnsAdapter } from '@angular/material-date-fns-adapter';
import {
    debounceTime,
    distinctUntilChanged,
    filter,
    map,
    startWith,
    switchMap,
    take,
    takeUntil,
    tap
} from 'rxjs/operators';
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search';
import { NgxColorsModule } from 'ngx-colors';
import { BehaviorSubject, combineLatest, Observable, of, Subject } from 'rxjs';
import {
    CreateProjectRequest,
    PersonnelAccountOrderBy,
    ProjectError,
    UpdateProjectRequest
} from '../../../protocol/web-protocol';
import {
    BadRequestError,
    ForbiddenError,
    InternalServerError,
    NotFoundError,
    OrderDirection
} from '../../../protocol/data-protocol';
import { Office, PersonnelAccount, Project, TaskKind } from '../../../protocol/db-protocol';
import { HermesOfficeService } from '../../../protocol/web-office-protocol.service';
import { HermesEmployeeService } from '../../../protocol/web-employee-protocol.service';
import { HermesProjectService } from '../../../protocol/project-protocol.service';
import { NotificationService } from '../../../core/services/notification.service';

enum Fields {
    Title = 'title',
    SupervisorId = 'supervisorId',
    Key = 'key',
    LeadingOfficeId = 'leadingOfficeId',
    Color = 'color',
    FinanceCode = 'financeCode',
    Invoiceable = 'invoiceable',
    TaskCode = 'taskCode',
    StartedAt = 'startedAt',
    FinishedAt = 'finishedAt',
    IsArchived = 'isArchived'
}

enum Command {
    Create,
    Update
}

@Component({
    templateUrl: 'project-edit-dialog.component.html',
    styleUrls: ['project-edit-dialog.component.scss'],
    standalone: true,
    providers: [provideDateFnsAdapter()],
    imports: [
        CdkScrollable,
        FormsModule,
        ReactiveFormsModule,
        NgClass,
        MatFormField,
        MatLabel,
        MatInput,
        MatHint,
        MatSelect,
        MatOption,
        NgxMatSelectSearchModule,
        MatCheckbox,
        MatDatepickerInput,
        MatDatepickerToggle,
        MatSuffix,
        MatDatepicker,
        MatError,
        NgxColorsModule,
        MatButton,
        AsyncPipe,
        KeyValuePipe,
        MatDialogModule,
        MatButtonModule,
        MatIconModule
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectEditDialogComponent implements OnInit, OnDestroy {
    destroy$ = new Subject<void>();
    changed$ = new BehaviorSubject<boolean>(false);
    loading$: BehaviorSubject<boolean>;
    offices$ = new Observable<Office[]>();
    pristineProject$ = new BehaviorSubject<Project>(null);
    patch$ = new BehaviorSubject<UpdateProjectRequest>(new UpdateProjectRequest());
    taskKindList$ = new BehaviorSubject<Map<number, string>>(null);
    supervisors$ = new Observable<PersonnelAccount[]>(null);
    updateEvent$ = new Subject<void>();
    fields = Fields;
    projectForm: UntypedFormGroup = new UntypedFormGroup({});
    project: Project;
    colorInputControl = new UntypedFormControl({ disabled: true });
    supervisorFilterControl = new UntypedFormControl();
    officeFilterControl = new UntypedFormControl();
    errorMessage?: string = null;
    taskKind = TaskKind;
    minDatePicker = new Date(2008, 0, 1);
    colorPalette = [
        '#34bfa3',
        '#716aca',
        '#f4516c',
        '#EECC02',
        '#00c5dc',
        '#3B4298',
        '#BD1F75',
        '#F1941E',
        '#9A66E1',
        '#22A3A6',
        '#1474E5',
        '#EC5B63',
        '#8CDE4B',
        '#CB7212',
        '#4DAEFA',
        '#39994A',
        '#E1B7E1',
        '#D83A43',
        '#75B53E'
    ];

    constructor(
        public dialogRef: MatDialogRef<ProjectEditDialogComponent>,
        private hermesProjectService: HermesProjectService,
        private hermesEmployeeService: HermesEmployeeService,
        private hermesOfficeService: HermesOfficeService,
        private notificationService: NotificationService,
        private fb: UntypedFormBuilder,
        @Inject(MAT_DIALOG_DATA) public data: Project | null
    ) {}

    public set colorValue(value: string) {
        this.projectForm.get(Fields.Color).setValue(value);
    }

    ngOnInit(): void {
        this.loading$ = new BehaviorSubject<boolean>(false);
        this.monitorFormChanged(this.data);
        this.supervisors$ = this.suggestSupervisors(this.supervisorFilterControl);
        this.offices$ = this.suggestOffices(this.officeFilterControl);
        this.updateButtonHandler();
        this.taskKindList$.next(
            new Map(
                this.prepareTaskKindArray().map((item) => [item, TaskKind.getDescription(item)])
            )
        );

        this.projectForm
            .get(Fields.Color)
            .valueChanges.pipe(takeUntil(this.destroy$))
            .subscribe((color) => this.colorInputControl.setValue(color));

        this.colorInputControl.disable();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.patch$.complete();
        this.pristineProject$.complete();
        this.changed$.complete();
        this.loading$.complete();
        this.taskKindList$.complete();
        this.updateEvent$.complete();
    }

    createForm(project: Project): UntypedFormGroup {
        return this.fb.group({
            [Fields.Title]: [project[Fields.Title], Validators.required],
            [Fields.Key]: [project[Fields.Key], Validators.required],
            [Fields.SupervisorId]: [project?.supervisorId ?? null],
            [Fields.LeadingOfficeId]: [project?.leadingOfficeId ?? null, Validators.required],
            [Fields.Color]: [project?.color ?? null, Validators.required],
            [Fields.FinanceCode]: [project?.financeCode ?? null, Validators.required],
            [Fields.Invoiceable]: [project?.invoiceable ?? false],
            [Fields.IsArchived]: [project?.isArchived ?? false],
            [Fields.TaskCode]: [project?.taskCode ?? TaskKind.Project],
            [Fields.StartedAt]: [project?.startedAt ?? null, this.startDateValidator],
            [Fields.FinishedAt]: [project?.finishedAt ?? null, this.finishDateValidator]
        });
    }

    startDateValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
        if (!control.value || !this.projectForm.get(Fields.FinishedAt)?.value) {
            return null;
        }
        return this.projectForm.get(Fields.FinishedAt)?.value < control?.value
            ? { forbiddenStartedDate: { value: control.value } }
            : null;
    };

    finishDateValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
        if (!control.value) {
            return null;
        }
        return this.projectForm.get(Fields.StartedAt)?.value > control?.value
            ? { forbiddenFinishDate: { value: control.value } }
            : null;
    };

    onSave(): void {
        this.updateEvent$.next();
    }

    updateButtonHandler(): void {
        this.updateEvent$
            .pipe(
                takeUntil(this.destroy$),
                switchMap(() => combineLatest([this.pristineProject$, this.patch$]).pipe(take(1)))
            )
            .subscribe(([project, patch]) => {
                if (patch instanceof UpdateProjectRequest) {
                    this.editProjectRequest(project.id, patch);
                } else {
                    this.createProjectRequest(patch);
                }
            });
    }

    formatControls(formProject: UntypedFormGroup): UntypedFormGroup {
        return Object.entries(formProject).reduce((result, [key, value]) => {
            result[key] = value === '' ? null : value;
            return result;
        }, {}) as UntypedFormGroup;
    }

    prepareTaskKindArray(): number[] {
        return Object.keys(TaskKind)
            .filter((kind) => typeof TaskKind[kind] === 'number')
            .map((k) => TaskKind[k] as TaskKind);
    }

    editProjectRequest(projectId: number, patch: UpdateProjectRequest): void {
        this.hermesProjectService
            .updateProject(patch, projectId)
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (project) => {
                    this.notificationService.success(`Project ${project.title} updated`);
                    this.dialogRef.close(project);
                },
                (error) => {
                    this.handleBadRequestError(error);
                }
            );
    }

    createProjectRequest(patch: CreateProjectRequest): void {
        this.hermesProjectService
            .createProject(patch)
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (project) => {
                    this.notificationService.success(`Project ${project.title} added`);
                    this.dialogRef.close(project);
                },
                (error) => {
                    this.handleBadRequestError(error);
                }
            );
    }

    handleBadRequestError(
        error: BadRequestError<ProjectError> | ForbiddenError | NotFoundError | InternalServerError
    ): void {
        let errorMessage: string = null;
        let letsClose = true;

        if (error instanceof BadRequestError) {
            switch (error.error) {
                case ProjectError.InvalidColor:
                    errorMessage = 'Invalid color';
                    letsClose = false;
                    break;
                case ProjectError.InvalidFinanceCode:
                    errorMessage = 'Invalid finance code';
                    letsClose = false;
                    break;
                case ProjectError.InvalidInvoiceable:
                    errorMessage = 'Invalid invoiceable';
                    letsClose = false;
                    break;
                case ProjectError.InvalidKey:
                    errorMessage = 'Invalid key';
                    letsClose = false;
                    break;
                case ProjectError.InvalidLeadingOfficeId:
                    errorMessage = 'Invalid leading office id';
                    letsClose = false;
                    break;
                case ProjectError.InvalidSupervisorId:
                    errorMessage = 'Invalid supervisor id';
                    letsClose = false;
                    break;
                case ProjectError.InvalidTaskCode:
                    errorMessage = 'Invalid task code';
                    letsClose = false;
                    break;
                case ProjectError.KeyAlreadyExists:
                    errorMessage = 'Key already exists';
                    letsClose = false;
                    break;
                case ProjectError.LeadingOfficeNotExists:
                    errorMessage = 'Leading office not exists';
                    letsClose = false;
                    break;
                case ProjectError.SupervisorNotExists:
                    errorMessage = 'Supervisor not exists';
                    letsClose = false;
                    break;
                case ProjectError.TitleAlreadyExists:
                    errorMessage = 'Title already exists';
                    letsClose = false;
                    break;
                default:
                    errorMessage = `Server responded with code error ${error.error}. Please contact support`;
                    letsClose = false;
            }
        } else if (error instanceof ForbiddenError) {
            errorMessage = 'Forbidden';
            letsClose = true;
        } else if (error instanceof InternalServerError) {
            errorMessage = 'internal server error';
        }

        this.notificationService.error(errorMessage);

        if (letsClose) {
            this.dialogRef.close();
        }
    }

    validateForm(): boolean {
        return Object.values(Fields).every((field) => this.projectForm.get(field).errors === null);
    }

    private monitorFormChanged(data: Project | null) {
        of(data)
            .pipe(
                takeUntil(this.destroy$),
                map((projectData) => projectData || new Project()),
                tap((projectData) => this.pristineProject$.next(projectData)),
                tap((projectData) => this.colorInputControl.setValue(projectData.color)),
                map((projectData) => this.createForm(projectData)),
                tap((form) => {
                    this.projectForm = form;
                }),
                switchMap((projectForm: UntypedFormGroup) =>
                    combineLatest([
                        this.pristineProject$
                            .asObservable()
                            .pipe(filter((project) => project instanceof Project)),
                        projectForm.valueChanges.pipe(
                            debounceTime(150),
                            map((project) => this.formatControls(project))
                        )
                    ])
                ),
                map(([project, formData]) =>
                    this.getPatch(
                        project,
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
            .subscribe((patch: UpdateProjectRequest | CreateProjectRequest) => {
                this.projectForm
                    .get(this.fields.StartedAt)
                    .updateValueAndValidity({ emitEvent: false });
                this.projectForm
                    .get(this.fields.FinishedAt)
                    .updateValueAndValidity({ emitEvent: false });
                this.patch$.next(patch);
            });
    }

    private suggestOffices(control: UntypedFormControl): Observable<Office[]> {
        return combineLatest([
            control.valueChanges.pipe(
                takeUntil(this.destroy$),
                startWith(''),
                map((needle: string) => (needle || '').trim().toLowerCase())
            ),
            this.hermesOfficeService.getOffices().pipe(
                takeUntil(this.destroy$),
                map((obj) => obj.items)
            )
        ]).pipe(
            takeUntil(this.destroy$),
            map(([needle, offices]) =>
                offices.filter((office) => office.name.toLowerCase().includes(needle))
            )
        );
    }

    private suggestSupervisors(control: UntypedFormControl): Observable<PersonnelAccount[]> {
        const offset = 0;
        const limit = 1000;

        return control.valueChanges.pipe(
            takeUntil(this.destroy$),
            filter((s) => s !== ''), // HACK because everytime empty string rewrite all picked values
            startWith(''),
            map((needle: string) => (needle || '').trim().toLowerCase()),
            distinctUntilChanged(),
            switchMap((needle) =>
                this.hermesEmployeeService
                    .getEmployees(
                        needle,
                        PersonnelAccountOrderBy.Name,
                        OrderDirection.Asc,
                        offset,
                        limit
                    )
                    .pipe(takeUntil(this.destroy$))
            ),
            map((collection) =>
                collection.items.filter((e) => e.officeId && !e.isBlocked && !e.isDeleted)
            )
        );
    }

    private getPatch(
        project: Project,
        formData: { Fields: any } | {},
        command: Command
    ): UpdateProjectRequest | CreateProjectRequest {
        return Object.entries(formData).reduce(
            (patch, [key, value]) => {
                patch[key] = project[key] !== value ? value : undefined;
                return patch;
            },
            command === Command.Update ? new UpdateProjectRequest() : new CreateProjectRequest()
        );
    }
}
