import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { provideDateFnsAdapter } from '@angular/material-date-fns-adapter';
import { MatDatepicker, MatDatepickerInput } from '@angular/material/datepicker';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatInput } from '@angular/material/input';
import { MatCheckbox } from '@angular/material/checkbox';
import { AsyncPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDividerModule } from '@angular/material/divider';
import { MatDateFormats } from '@angular/material/core';
import { filter, map, switchMap, take, takeUntil, tap } from 'rxjs/operators';
import { BehaviorSubject, combineLatest, of, Subject } from 'rxjs';
import { AccountService } from '../../../core/services/account.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
    AllocateData,
    OfficeData,
    RoleData
} from '../../../shared/interfaces/dialog-data.interface';
import { HistoryEmployeeDialogComponent } from '../employee-history/employee-history.component';
import { EmployeeProjectChangeDialogComponent } from '../employee-project-change-dialog/employee-project-change-dialog.component';
import { EmployeeRoleChangeDialogComponent } from '../employee-role-change-dialog/employee-role-change-dialog.component';
import { OfficeSwitchDialogComponent } from '../../projects/office-switch-dialog/office-switch-dialog.component';
import { PersonnelAccount, Project, Role } from '../../../protocol/db-protocol';
import { HermesEmployeeService } from '../../../protocol/web-employee-protocol.service';
import { HermesAdminService } from '../../../protocol/web-admin-protocol.service';
import { HermesProjectService } from '../../../protocol/project-protocol.service';
import { HermesRoleService } from '../../../protocol/role-protocol.service';
import {
    BadRequestError,
    Collection,
    ForbiddenError,
    InternalServerError,
    NotFoundError
} from '../../../protocol/data-protocol';
import {
    EmployeeAlloc,
    UpdatePersonnelAccountError,
    UpdatePersonnelAccountRequest
} from '../../../protocol/web-protocol';
import { CacheService } from '../../../core/services/cache.service';
import { SelectedDateService } from '../../../core/services/selected-date.service';
import { ProjectWithDays } from '../../../shared/interfaces/days-spent-on-project.interface';
import { WindowRefService } from '../../../core/services/window-ref.service';
import { ProjectLegendComponent } from '../../../components/project-legend/project-legend.component';
import { ProjectCalendarComponent } from '../../../components/project-calendar/project-calendar.component';
import { CountryFlagComponent } from '../../../components/country-flag/country-flag.component';

export const MY_FORMATS: MatDateFormats = {
    parse: {
        dateInput: 'LL'
    },
    display: {
        dateInput: 'MMM, dd yyyy',
        monthYearLabel: 'MMM yyyy',
        dateA11yLabel: 'LL',
        monthYearA11yLabel: 'MMM yyyy'
    }
};

@Component({
    selector: 'app-employee-timesheet',
    templateUrl: './employee-timesheet.component.html',
    styleUrls: ['./employee-timesheet.component.scss'],
    providers: [provideDateFnsAdapter(MY_FORMATS)],
    standalone: true,
    imports: [
        RouterLink,
        MatCheckbox,
        MatDatepicker,
        MatInput,
        FormsModule,
        MatDatepickerInput,
        ReactiveFormsModule,
        ProjectCalendarComponent,
        ProjectLegendComponent,
        AsyncPipe,
        MatButtonModule,
        MatIconModule,
        CountryFlagComponent,
        MatToolbarModule,
        MatDividerModule
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeTimesheetComponent implements OnDestroy, OnInit {
    @ViewChild('pickerFireAt', { static: false }) pickerFireAt: MatDatepicker<any>;
    destroy$ = new Subject<void>();
    refresh$ = new BehaviorSubject<boolean>(false);
    employee$ = new BehaviorSubject<PersonnelAccount>(null);
    projects$ = new BehaviorSubject<Project[]>(null);
    directLink$ = new BehaviorSubject<string>('');
    filteredProjects$ = new BehaviorSubject<Set<number>>(new Set());
    canChangeOffice = false;
    canChangeProject = false;
    canChangeRole = false;
    canChangeOfficeManager = false;
    employeeId: number = null;
    officeId: number = null;
    projects: Project[] = [];
    allocatedProjectId: number;
    projectsForMonth: Project[] = [];
    projectsWithDays: ProjectWithDays[] = [];
    hireAtControl = new FormControl<Date>(null);
    fireAtControl = new FormControl<Date>(null);
    isShowResetFiredAt = false;
    isShowResetHiredAt = false;
    minDatePicker = new Date(2008, 0, 1);

    constructor(
        private route: ActivatedRoute,
        private dialog: MatDialog,
        public accountService: AccountService,
        private clipboard: Clipboard,
        private notificationService: NotificationService,
        private hermesEmployeeService: HermesEmployeeService,
        private hermesAdminService: HermesAdminService,
        private hermesProjectService: HermesProjectService,
        private hermesRoleService: HermesRoleService,
        public selectedDateService: SelectedDateService,
        private cacheService: CacheService,
        private windowService: WindowRefService
    ) {}

    ngOnInit(): void {
        combineLatest([this.route.params, this.refresh$.asObservable()])
            .pipe(
                takeUntil(this.destroy$),
                switchMap(([params]) =>
                    this.hermesEmployeeService
                        .getEmployeeByUsername(params.username)
                        .pipe(takeUntil(this.destroy$), take(1))
                ),
                tap((employee) => {
                    this.employeeId = employee.id;
                    this.officeId = employee.officeId;
                    this.hireAtControl.setValue(employee.hiredAt, { emitEvent: false });
                    this.fireAtControl.setValue(employee.firedAt, { emitEvent: false });
                    this.isShowResetHiredAt = Boolean(employee.hiredAt);
                    this.isShowResetFiredAt = Boolean(employee.firedAt);
                    this.allocatedProjectId = employee.allocatedToProjectId;
                    this.directLink$.next(this.generateLink());
                })
            )
            .subscribe((employee) => this.employee$.next(employee));

        combineLatest([this.accountService.profile$.asObservable(), this.employee$.asObservable()])
            .pipe(
                takeUntil(this.destroy$),
                filter(
                    ([profile, employee]) =>
                        profile instanceof PersonnelAccount && employee instanceof PersonnelAccount
                )
            )
            .subscribe(([profile, employee]) => {
                this.canChangeOfficeManager = profile.isSuperadmin;
                this.canChangeOffice = profile.isSuperadmin;
                this.canChangeProject =
                    profile.isSuperadmin ||
                    (profile.isOfficeManager && profile.officeId === employee.officeId);

                this.canChangeRole =
                    profile.isSuperadmin ||
                    (profile.isOfficeManager && profile.officeId === employee.officeId);
            });

        this.hermesProjectService
            .getProjects()
            .pipe(
                takeUntil(this.destroy$),
                map((collection) => collection.items)
            )
            .subscribe((projects) => {
                this.projects = projects;
                this.projects$.next(projects);
            });

        this.hireAtControl.valueChanges
            .pipe(
                takeUntil(this.destroy$),
                switchMap((value) =>
                    combineLatest([of(value), this.employee$.asObservable()]).pipe(take(1))
                ),
                filter(([value, employee]) => this.checkHiredAtDate(value, employee)),
                map(([value]) => value),
                map((value) => value ?? null),
                switchMap((newDate) => {
                    const request = new UpdatePersonnelAccountRequest();
                    if (newDate instanceof Date) {
                        newDate.setHours(12, 0, 0);
                    }
                    request.hiredAt = newDate;
                    return this.hermesAdminService
                        .updatePersonnelAccount(request, this.employeeId)
                        .pipe(take(1));
                })
            )
            .subscribe(
                (emp) => {
                    this.cacheService.reloadEmployees();
                    this.notificationService.success('Hiring date has been changed');
                    this.refresh$.next(true);
                },
                (error) => {
                    if (error instanceof BadRequestError) {
                        const errorMessage = UpdatePersonnelAccountError.getDescription(
                            error.error
                        );
                        this.notificationService.error(errorMessage ?? error);
                    } else {
                        this.notificationService.error(error);
                    }
                }
            );

        this.fireAtControl.valueChanges
            .pipe(
                takeUntil(this.destroy$),
                switchMap((value) =>
                    combineLatest([of(value), this.employee$.asObservable()]).pipe(take(1))
                ),
                filter(([value, employee]) => this.checkFiredAtDate(value, employee)),
                map(([value]) => value),
                map((value) => value ?? null),
                switchMap((newDate) => {
                    const request = new UpdatePersonnelAccountRequest();
                    newDate instanceof Date ? newDate.setHours(12, 0, 0) : null;
                    request.firedAt = newDate;
                    return this.hermesAdminService
                        .updatePersonnelAccount(request, this.employeeId)
                        .pipe(take(1));
                })
            )
            .subscribe(
                () => {
                    this.cacheService.reloadEmployees();
                    this.notificationService.success('Firing date has been changed');
                    this.refresh$.next(true);
                },
                (error) => this.handleBadRequestError(error)
            );
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.directLink$.complete();
        this.filteredProjects$.complete();
        this.refresh$.complete();
        this.employee$.complete();
        this.projects$.complete();
    }

    onOpenHistoryDialog(personalId: number): void {
        this.dialog.open(HistoryEmployeeDialogComponent, {
            autoFocus: false,

            data: personalId
        });
    }

    onChangeOffice(): void {
        if (!this.canChangeOffice) {
            return;
        }

        const dialogRef = this.dialog.open(OfficeSwitchDialogComponent, {
            autoFocus: false,

            data: {
                officeId: this.officeId,
                header: `${this.officeId ? 'Rea' : 'A'}ssign to office`
            } satisfies OfficeData
        });

        combineLatest([
            this.employee$.pipe(
                filter((p) => Boolean(p)),
                take(1)
            ),
            dialogRef.afterClosed().pipe(filter((result) => Boolean(result)))
        ])
            .pipe(takeUntil(this.destroy$))
            .subscribe(([employee, result]) => {
                const request = new UpdatePersonnelAccountRequest();
                request.officeId = Number(result.id);

                this.hermesAdminService
                    .updatePersonnelAccount(request, employee.id)
                    .pipe(takeUntil(this.destroy$))
                    .subscribe(
                        () => {
                            this.cacheService.reloadEmployees();
                            this.notificationService.success('Office changed');
                            this.refresh$.next(true);
                        },
                        (error) => this.handleBadRequestError(error)
                    );
            });
    }

    onResetOffice(employeeId: number): void {
        const request = new UpdatePersonnelAccountRequest();
        request.officeId = null;

        this.hermesAdminService
            .updatePersonnelAccount(request, employeeId)
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                () => {
                    this.cacheService.reloadEmployees();
                    this.notificationService.success('Office reset');
                    this.refresh$.next(true);
                },
                (error) => this.handleBadRequestError(error)
            );
    }

    onChangeProject(): void {
        if (!this.canChangeProject) {
            return;
        }

        this.dialog
            .open<
                EmployeeProjectChangeDialogComponent,
                AllocateData,
                Project | 'deallocate' | undefined
            >(EmployeeProjectChangeDialogComponent, {
                autoFocus: false,

                data: {
                    projects: this.projects,
                    title: 'title',
                    projectAllocatedId: this.allocatedProjectId,
                    header: `${this.allocatedProjectId ? 'Re' : 'A'}ssign to project`
                } satisfies AllocateData
            })
            .afterClosed()
            .pipe(filter((result) => Boolean(result)))
            .subscribe((result) => {
                if (result === 'deallocate') {
                    this.hermesEmployeeService
                        .deallocateEmployee(this.employeeId)
                        .pipe(takeUntil(this.destroy$))
                        .subscribe(
                            () => {
                                this.notificationService.success('Deallocated from project');
                                this.refresh$.next(true);
                            },
                            () =>
                                this.notificationService.error('Failed to deallocate from project')
                        );
                } else if (result) {
                    const request = new EmployeeAlloc();
                    request.projectId = Number(result.id);

                    this.hermesEmployeeService
                        .allocateEmployee(request, this.employeeId)
                        .pipe(takeUntil(this.destroy$))
                        .subscribe(
                            () => {
                                this.notificationService.success('Successfully allocated');
                                this.refresh$.next(true);
                            },
                            (error) => this.notificationService.error('Allocation failed')
                        );
                }
            });
    }

    onChangeProjectsForMonth(projectWithDays: ProjectWithDays[]): void {
        this.projectsWithDays = projectWithDays;
    }

    onChangeRole(officeId: number, employeeRole: string): void {
        if (!this.canChangeRole) {
            return;
        }

        combineLatest([
            this.hermesRoleService.getRoles(),
            this.cacheService.offices$.asObservable()
        ])
            .pipe(
                takeUntil(this.destroy$),
                filter(([roles, offices]) => roles instanceof Collection && Boolean(offices)),
                map(([roles, offices]) => {
                    const employeeOffice = offices.find((office) => office.id === officeId);
                    return [
                        roles.items,
                        roles.items.filter((role) => employeeOffice?.allowedRoles.includes(role.id))
                    ];
                }),
                switchMap(([roles, allowedRoles]) =>
                    this.dialog
                        .open(EmployeeRoleChangeDialogComponent, {
                            data: {
                                roles,
                                currentRole: employeeRole,
                                header: 'Assign a role',
                                allowedRoles: new Set(allowedRoles.map((role) => role.id))
                            } as RoleData,
                            autoFocus: false
                        })
                        .afterClosed()
                        .pipe(filter((result) => Boolean(result)))
                )
            )
            .subscribe((result: Role) => {
                const request = new UpdatePersonnelAccountRequest();
                request.roleId = result.id;

                this.hermesAdminService
                    .updatePersonnelAccount(request, this.employeeId)
                    .pipe(takeUntil(this.destroy$))
                    .subscribe(
                        () => {
                            this.cacheService.reloadEmployees();
                            this.notificationService.success('Role changed');
                            this.refresh$.next(true);
                        },
                        (error) => this.handleBadRequestError(error)
                    );
            });
    }

    onSelectedProject(projects: Set<number>): void {
        this.filteredProjects$.next(new Set(projects));
    }

    onToggleOfficeManager(employeeId: number, isOfficeManager: boolean): void {
        const request = new UpdatePersonnelAccountRequest();
        request.isOfficeManager = isOfficeManager;

        this.hermesAdminService
            .updatePersonnelAccount(request, employeeId)
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                () => {
                    this.cacheService.reloadEmployees();
                    const message = isOfficeManager
                        ? 'Promoted to office manager'
                        : 'Revoked from office manager';
                    this.notificationService.success(message);
                    this.refresh$.next(true);
                },
                (error) => this.handleBadRequestError(error)
            );
    }

    checkFiredAtDate(value: Date, employee: PersonnelAccount): boolean {
        try {
            if (!value) {
                return true;
            }
            if (this.hireAtControl && this.hireAtControl.value > value) {
                setTimeout(() =>
                    this.fireAtControl.setValue(employee.firedAt, { emitEvent: false })
                );
                throw new Error('Fired at date should be more than hired at');
            }
            return true;
        } catch (e) {
            this.notificationService.error(e.message);
            return false;
        }
    }

    checkHiredAtDate(value: Date, employee: PersonnelAccount): boolean {
        try {
            if (!value) {
                return true;
            }
            if (this.fireAtControl.value && this.fireAtControl.value < value) {
                setTimeout(() =>
                    this.hireAtControl.setValue(employee.hiredAt, { emitEvent: false })
                );
                throw new Error('Hired at date should be less than fired at');
            }
            return true;
        } catch (e) {
            this.notificationService.error(e.message);
            return false;
        }
    }

    handleBadRequestError(
        error:
            | BadRequestError<UpdatePersonnelAccountError>
            | ForbiddenError
            | NotFoundError
            | InternalServerError
    ): void {
        let errorMessage: string = null;

        if (error instanceof BadRequestError) {
            switch (error.error) {
                case UpdatePersonnelAccountError.OfficeNotExists:
                    errorMessage = 'Office not exists';
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
    }

    generateLink(): string {
        // Remove year and month from link
        return this.windowService.getHref().split('/').slice(0, -2).join('/');
    }

    onCopyLink(link: string): void {
        if (this.clipboard.copy(link)) {
            this.notificationService.success('Link copied!');
        }
    }
}
