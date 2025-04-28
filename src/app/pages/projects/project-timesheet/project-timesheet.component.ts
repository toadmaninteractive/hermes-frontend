import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltip } from '@angular/material/tooltip';
import { AsyncPipe, UpperCasePipe, SlicePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import {
    debounceTime,
    delay,
    distinctUntilChanged,
    filter,
    map,
    switchMap,
    take,
    takeUntil,
    tap
} from 'rxjs/operators';
import { BehaviorSubject, combineLatest, from, of } from 'rxjs';
import { InlineSVGModule } from 'ng-inline-svg-2';
import { ProjectSwitchDialogComponent } from 'src/app/components/project-switch-dialog/project-switch-dialog.component';
import { AccountService } from '../../../core/services/account.service';
import { CacheService } from '../../../core/services/cache.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SelectedDateService } from '../../../core/services/selected-date.service';
import { AbstractTimesheetComponent } from '../../../shared/classes/abstract-timesheet';
import { Privileges } from '../../../shared/interfaces/privileges.interface';
import {
    OfficeData,
    ProjectsData,
    RoleData
} from '../../../shared/interfaces/dialog-data.interface';
import { SelectEmployeeDialogComponent } from '../../../components/table-grid/select-employee-dialog/select-employee-dialog.component';
import { OfficeSwitchDialogComponent } from '../office-switch-dialog/office-switch-dialog.component';
import { HermesEmployeeService } from '../../../protocol/web-employee-protocol.service';
import { HermesProjectService } from '../../../protocol/project-protocol.service';
import {
    CellEditDialogComponent,
    TimesheetCellData
} from '../../../components/table-grid/cell-edit-dialog/cell-edit-dialog.component';
import { EmployeeRoleChangeDialogComponent } from '../../employees/employee-role-change-dialog/employee-role-change-dialog.component';
import {
    Highlight,
    Office,
    PersonnelAccount,
    Project,
    Role,
    TimesheetCell
} from '../../../protocol/db-protocol';
import { HermesAdminService } from '../../../protocol/web-admin-protocol.service';
import { HermesTaskService } from '../../../protocol/task-protocol.service';
import { HermesTimesheetService } from '../../../protocol/timesheet-protocol.service';
import {
    EmployeeAlloc,
    MonthlyEmployeeTimesheet,
    ProjectError,
    UpdatePersonnelAccountError,
    UpdatePersonnelAccountRequest,
    UpdateProjectRequest
} from '../../../protocol/web-protocol';
import {
    HistoryDialogComponent,
    HistoryDialogData
} from '../../../components/table-grid/history-dialog/history-dialog.component';
import {
    EmployeeHighlightDialogComponent,
    HighlightDialogData
} from '../../../components/table-grid/employee-highlight-dialog/employee-highlight-dialog.component';
import { HermesHighlightService } from '../../../protocol/highlight-protocol.service';
import { Empty } from '../../../protocol/common-protocol';
import { BadRequestError } from '../../../protocol/data-protocol';
import { simplifyTitle } from '../../../shared/functions/simplify-title';
import { PseudoClipboardService } from '../../../core/services/pseudo-clipboard.service';
import { OverlayService } from '../../../core/services/overlay.service';
import {
    AllocateResult,
    AllocateStepperComponent
} from '../../../components/table-grid/allocate-stepper/allocate-stepper.component';
import { TableMenuComponent } from '../../../components/table-grid/table-menu/table-menu.component';
import { TableGridComponent } from '../../../components/table-grid/table-grid.component';
import { PromptsDialogComponent } from '../../../components/prompts-dialog/prompts-dialog.component';
import { LoadingIndicatorComponent } from '../../../components/loading-indicator/loading-indicator.component';
import { MonthPickerComponent } from '../../../components/month-picker/month-picker.component';
import { CountryFlagComponent } from '../../../components/country-flag/country-flag.component';
import { ConfirmationService } from '../../../components/confirmation/confirmation.service';
import { TooltipAutoHideDirective } from '../../../shared/directives/tooltip-auto-hide.directive';

@Component({
    selector: 'app-project-timesheet',
    templateUrl: './project-timesheet.component.html',
    styleUrls: ['./project-timesheet.component.scss'],
    standalone: true,
    imports: [
        InlineSVGModule,
        MonthPickerComponent,
        LoadingIndicatorComponent,
        PromptsDialogComponent,
        TableGridComponent,
        TableMenuComponent,
        MatTooltip,
        AsyncPipe,
        UpperCasePipe,
        SlicePipe,
        CountryFlagComponent,
        MatIconModule,
        MatButtonModule,
        MatToolbarModule,
        TooltipAutoHideDirective
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectTimesheetComponent
    extends AbstractTimesheetComponent
    implements OnInit, OnDestroy
{
    allowedRolesSet$ = new BehaviorSubject<Set<number>>(new Set());
    participants$ = new BehaviorSubject<number>(0);
    privileges$ = new BehaviorSubject<Privileges | null>(null);
    project$ = new BehaviorSubject<Project>(null);
    office$ = new BehaviorSubject<Office>(null);
    removedEmployeeId$ = new BehaviorSubject<number | null>(null);
    updatedRow$ = new BehaviorSubject<MonthlyEmployeeTimesheet | null>(null);
    linkMap$ = new BehaviorSubject<Map<number, boolean>>(new Map());
    highlightsMap$ = new BehaviorSubject<Map<number, string>>(new Map());
    highlights$ = new BehaviorSubject<Highlight[]>([]);

    allocatedEmployees: PersonnelAccount[] = [];
    allowedProjects: Project[] = [];
    projectAllocations = new Map<number, number>();

    constructor(
        public override dialog: MatDialog,
        private route: ActivatedRoute,
        private accountService: AccountService,
        private adminService: HermesAdminService,
        public override cacheService: CacheService,
        private highlightService: HermesHighlightService,
        private projectService: HermesProjectService,
        public override notificationService: NotificationService,
        public override overlayService: OverlayService,
        public selectedDateService: SelectedDateService,
        public override employeeService: HermesEmployeeService,
        public override taskService: HermesTaskService,
        public override timesheetService: HermesTimesheetService,
        public override pseudoClipboardService: PseudoClipboardService,
        protected override confirmationService: ConfirmationService
    ) {
        super(
            employeeService,
            notificationService,
            overlayService,
            taskService,
            timesheetService,
            pseudoClipboardService,
            dialog,
            cacheService,
            confirmationService
        );
    }

    ngOnInit(): void {
        combineLatest([
            this.route.paramMap,
            this.cacheService.projects$.asObservable(),
            this.refreshTimesheet$.asObservable()
        ])
            .pipe(
                takeUntil(this.destroy$),
                filter(
                    ([paramMap, projects, refresh]) =>
                        paramMap.has('name') && projects && Boolean(projects.length)
                ),
                tap(() => this.loading$.next(true)),
                filter(([, projects]) => Boolean(projects)),
                map(([params, projects]) =>
                    projects.find((project) => simplifyTitle(project.title) === params.get('name'))
                ),
                tap((project) => this.project$.next(project)),
                switchMap((project: Project) =>
                    combineLatest([
                        of(project),
                        this.accountService.profile$.asObservable(),
                        this.selectedDateService.selectedDate$.asObservable(),
                        this.employeeService
                            .getEmployeesByProject(project.id)
                            .pipe(map((collection) => collection.items)),
                        this.cacheService.offices$.asObservable(),
                        this.cacheService.projects$,
                        this.cacheService.employees$.asObservable()
                    ]).pipe(
                        filter(
                            ([
                                projectObject,
                                profile,
                                date,
                                allocatedEmployees,
                                offices,
                                projects
                            ]) =>
                                projectObject instanceof Project &&
                                profile instanceof PersonnelAccount &&
                                date instanceof Date &&
                                Boolean(allocatedEmployees) &&
                                Boolean(offices) &&
                                Boolean(projects)
                        ),
                        takeUntil(this.destroy$),
                        take(1),
                        debounceTime(250),
                        distinctUntilChanged()
                    )
                )
            )
            .subscribe(
                ([project, profile, selectedDate, allocatedEmployees, offices, projects]: [
                    Project,
                    PersonnelAccount,
                    Date,
                    PersonnelAccount[],
                    Office[],
                    Project[],
                    PersonnelAccount[]
                ]) => {
                    this.office$.next(
                        offices.find((office) => office.id === project.leadingOfficeId)
                    );

                    this.allocatedEmployees = allocatedEmployees;

                    this.privileges$.next(this.setPrivileges(profile, project.id, projects));
                    this.refreshTimesheet(project.id, selectedDate);
                }
            );

        combineLatest([this.cacheService.projects$, this.accountService.profile$])
            .pipe(
                takeUntil(this.destroy$),
                filter(([projects, profile]) => Boolean(projects) && Boolean(profile))
            )
            .subscribe(([projects, profile]) => {
                this.allowedProjects = projects;

                // TODO: temporarily disabled due to project manager confusion
                /*
                if (profile.isSuperadmin) {
                    this.allowedProjects = projects;
                } else if (profile.isOfficeManager) {
                    this.allowedProjects = projects.filter((item) => item.leadingOfficeId === profile.officeId);
                } else {
                    this.allowedProjects = projects.filter((item) => item.supervisorId === profile.id);
                }
                */
            });

        this.project$
            .asObservable()
            .pipe(
                switchMap((project) =>
                    combineLatest(of(project), this.cacheService.offices$.asObservable()).pipe(
                        take(1),
                        takeUntil(this.destroy$)
                    )
                ),
                map(
                    ([project, offices]) =>
                        offices?.find((o) => o.id === project.leadingOfficeId).allowedRoles
                )
            )
            .subscribe((roles) => this.allowedRolesSet$.next(new Set(roles)));

        this.highlightService
            .getHighlights()
            .pipe(
                takeUntil(this.destroy$),
                take(1),
                map((collection) => collection.items)
            )
            .subscribe((res) => this.highlights$.next(res));
    }

    ngOnDestroy(): void {
        this.completeSubjects();
        this.allowedRolesSet$.complete();
        this.linkMap$.complete();
        this.participants$.complete();
        this.privileges$.complete();
        this.project$.complete();
        this.office$.complete();
        this.removedEmployeeId$.complete();
        this.updatedRow$.complete();
    }

    setPrivileges(profile: PersonnelAccount, projectId: number, projects: Project[]): Privileges {
        const canEditCellPrivilege =
            profile.isSuperadmin ||
            profile.id === projects.find((item) => item.id === projectId)?.supervisorId ||
            (profile.isOfficeManager &&
                profile.officeId ===
                    projects.find((item) => item.id === projectId)?.leadingOfficeId);

        return {
            canEditCell: canEditCellPrivilege,
            canAllocateEmployee: canEditCellPrivilege,
            canAddToTeam: canEditCellPrivilege,
            canChangeLeadingOffice: profile.isSuperadmin,
            canChangeProjectSupervisor: profile.isSuperadmin || profile.isOfficeManager
        } as Privileges;
    }

    openSwitchProjectDialog(projects: Project[], date: Date): void {
        this.project$.pipe(take(1), takeUntil(this.destroy$)).subscribe((currentProject) =>
            this.dialog.open(ProjectSwitchDialogComponent, {
                autoFocus: false,

                data: {
                    projects,
                    currentProject,
                    url: `/projects/{}/${date.getFullYear()}/${date.getMonth() + 1}`
                } satisfies ProjectsData
            })
        );
    }

    openSwitchOfficeDialog(
        canChangeLeadingOffice: boolean,
        projectId: number,
        officeId: number,
        offices: Office[]
    ): void {
        if (!canChangeLeadingOffice) {
            return;
        }

        const dialogRef = this.dialog.open(OfficeSwitchDialogComponent, {
            autoFocus: false,

            data: { officeId, header: 'Set leading office' } satisfies OfficeData
        });

        dialogRef
            .afterClosed()
            .pipe(
                filter((office) => office instanceof Office),
                take(1),
                takeUntil(this.destroy$)
            )
            .subscribe((result) => {
                const request = new UpdateProjectRequest();
                request.leadingOfficeId = Number(result.id);

                this.projectService
                    .updateProject(request, projectId)
                    .pipe(takeUntil(this.destroy$), take(1))
                    .subscribe(
                        (response) => {
                            this.notificationService.success('Leading office changed');
                            this.project$.next(response);
                            this.office$.next(
                                offices.find((office) => office.id === response.leadingOfficeId)
                            );
                        },
                        (error) => {
                            if (error instanceof BadRequestError) {
                                const errorMessage = ProjectError.getDescription(error.error);
                                this.notificationService.error(errorMessage ?? error);
                            } else {
                                this.notificationService.error(error);
                            }
                        }
                    );
            });
    }

    openChangeSupervisorDialog(canChangeProjectSupervisor: boolean, projectId: number): void {
        if (!canChangeProjectSupervisor) {
            return;
        }

        const dialogRef = this.dialog.open(SelectEmployeeDialogComponent, {
            autoFocus: false,

            data: {
                header: 'Set project supervisor',
                existingEmployees: [],
                projectId,
                multiple: false
            }
        });

        dialogRef
            .afterClosed()
            .pipe(
                filter((employee) => Boolean(employee)),
                map((result: Array<number>) => result.pop()),
                take(1),
                takeUntil(this.destroy$)
            )
            .subscribe((result) => {
                const request = new UpdateProjectRequest();
                request.supervisorId = result;

                this.projectService
                    .updateProject(request, projectId)
                    .pipe(take(1), takeUntil(this.destroy$))
                    .subscribe(
                        (response) => {
                            this.notificationService.success('Supervisor has been changed');
                            this.project$.next(response);
                        },
                        (error) => {
                            if (error instanceof BadRequestError) {
                                const errorMessage = ProjectError.getDescription(error.error);
                                this.notificationService.error(errorMessage ?? error);
                            } else {
                                this.notificationService.error(error);
                            }
                        }
                    );
            });
    }

    openCellAllocateDialog(selectedCells: Set<TimesheetCell>): void {
        if (!selectedCells.size) {
            return;
        }
        this.dialog
            .open(CellEditDialogComponent, {
                autoFocus: false,

                data: {
                    previousValue: this.previousValue,
                    preferredProjectId: this.getPreferredProject(
                        selectedCells,
                        [...new Set(Array.from(selectedCells).map((cell) => cell.personnelId))],
                        this.projectAllocations
                    ),
                    cells: Array.from(selectedCells),
                    projects: this.allowedProjects
                } as TimesheetCellData
            })
            .afterClosed()
            .pipe(take(1))
            .subscribe((result) => {
                this.sendRequests(result, selectedCells);
            });
    }

    refreshTimesheet(projectId: number, selectedDate: Date): void {
        this.timesheetService
            .getMonthlyTimesheetForProject(
                selectedDate.getFullYear(),
                selectedDate.getMonth() + 1,
                projectId
            )
            .pipe(
                takeUntil(this.destroy$),
                take(1),
                tap(() => this.loading$.next(true)),
                map((collection) => collection.items),
                delay(1000)
            )
            .subscribe((timesheet) => {
                this.timesheet$.next(timesheet);

                const linkedMap = new Map(
                    timesheet.map((item) => [
                        item.personnelId,
                        Boolean(
                            (<Array<any>>item.linkedToProjects).find(
                                (elem) => elem.project_id === projectId
                            )
                        )
                    ])
                );
                this.linkMap$.next(linkedMap);
                this.participants$.next(
                    timesheet.filter((item) => Boolean(item.cells.length)).length
                );

                const highlights = timesheet
                    .filter((item) => item.highlights[projectId])
                    .map((item) => [
                        item.personnelId,
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-return
                        item.highlights[projectId].map((elem) => elem.title).join(', ')
                    ]) as [number, string][];

                this.highlightsMap$.next(new Map<number, string>(highlights));
                this.projectAllocations = new Map(
                    timesheet.map((item) => [item.personnelId, item.allocatedToProjectId || null])
                );
                this.loading$.next(false);
            });
    }

    addEmployeeToProject(
        projectId: number,
        selectedDate: Date,
        participants: number,
        employees: PersonnelAccount[],
        linkMap: Map<number, boolean>
    ): void {
        const listForSelection = employees.filter((employee) => {
            const linkedProjects = employee.linkedToProjects as Record<string, any>[];

            return linkedProjects.filter((item) => item.project_id === projectId).length;
        });

        const dialogRef = this.dialog.open(AllocateStepperComponent, {
            autoFocus: false,

            data: {
                header: 'Add to project',
                existingEmployees: [...new Set([...this.allocatedEmployees, ...listForSelection])],
                multiple: true
            }
        });

        dialogRef
            .afterClosed()
            .pipe(take(1), takeUntil(this.destroy$))
            .subscribe((allocateResult: AllocateResult | null) => {
                if (!allocateResult) {
                    return;
                }

                const allocateRequest = new EmployeeAlloc();
                allocateRequest.projectId = projectId;
                const allocateObservables = allocateResult.allocated.map((empId) =>
                    this.employeeService
                        .allocateEmployee(allocateRequest, empId)
                        .pipe(take(1), takeUntil(this.destroy$))
                );

                const linkedObservables = allocateResult.linked.map((empId) =>
                    this.employeeService
                        .linkEmployeeToProject(new Empty(), empId, projectId)
                        .pipe(take(1), takeUntil(this.destroy$))
                );
                allocateResult.linked.map((empId) => linkMap.set(empId, true));
                this.linkMap$.next(linkMap);

                combineLatest(allocateObservables.concat(linkedObservables))
                    .pipe(take(1), takeUntil(this.destroy$))
                    .subscribe(() => {
                        this.refreshTimesheet$.next(true);
                        this.cacheService.reloadEmployees();
                    });
            });
    }

    unlinkEmployeeFromProject(
        projectId: number,
        selectedDate: Date,
        participants: number,
        employee: PersonnelAccount,
        event: PointerEvent | MouseEvent,
        canEdit: boolean
    ): void {
        if (!canEdit) return;

        this.confirmationService
            .fire({
                data: {
                    title: 'Confirmation',
                    html: `Unlink ${employee.name} from this project?`,
                    confirmText: `Unlink`
                }
            })
            .pipe(
                takeUntil(this.destroy$),
                switchMap((response) => {
                    if (response) {
                        return this.employeeService
                            .unlinkEmployeeFromProject(employee.id, projectId)
                            .pipe(takeUntil(this.destroy$));
                    }
                    return of(null);
                }),
                map((updatedEmployee: PersonnelAccount | null) => {
                    if (updatedEmployee) {
                        this.notificationService.success(
                            `${updatedEmployee.name} has been successfully unlinked`
                        );
                        return updatedEmployee;
                    }
                    return null;
                })
            )
            .subscribe((updatedEmployee) => {
                if (updatedEmployee) {
                    this.participants$.next(participants - 1);
                    const employeeIndex = this.allocatedEmployees.findIndex(
                        (account) => account.id === updatedEmployee.id
                    );
                    this.allocatedEmployees.splice(employeeIndex, 1);
                    this.removedEmployeeId$.next(updatedEmployee.id);
                    setTimeout(() => this.removedEmployeeId$.next(null), 100);
                }
            });
        event.stopPropagation();
    }

    onRoleChange(
        roles: Role[],
        employeeId: number,
        event: MouseEvent,
        currentRoleId: number | null = null,
        allowedRoles: Set<number>,
        canEdit: boolean
    ): void {
        if (!canEdit) return;
        event.stopPropagation();
        this.dialog
            .open(EmployeeRoleChangeDialogComponent, {
                data: { roles, header: 'Assign a role', currentRoleId, allowedRoles } as RoleData
            })
            .afterClosed()
            .pipe(
                filter((result) => Boolean(result)),
                take(1)
            )
            .subscribe((result: Role) => {
                const request = new UpdatePersonnelAccountRequest();
                request.roleId = result.id;

                this.adminService
                    .updatePersonnelAccount(request, employeeId)
                    .pipe(take(1), takeUntil(this.destroy$))
                    .subscribe(
                        (employee) => {
                            this.notificationService.success('Role changed');
                            this.updatedEmployees$.next(employee);
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
            });
    }

    onHighlightEmployee(
        employee: PersonnelAccount,
        projectId: number,
        event: MouseEvent,
        highlights: Highlight[],
        highlightMap: Map<number, string>,
        canEdit: boolean
    ): void {
        if (!canEdit) return;

        event.stopPropagation();
        const empCopy = PersonnelAccount.fromJson(employee.toJson());
        this.dialog
            .open(EmployeeHighlightDialogComponent, {
                disableClose: true,
                data: { employee: empCopy, projectId } as HighlightDialogData
            })
            .afterClosed()
            .pipe(
                take(1),
                filter((result) => Boolean(result))
            )
            .subscribe((result: Highlight[]) => {
                const highlightToAdd = employee.highlights[projectId]
                    ? result.filter(
                          (nh) =>
                              !(employee.highlights[projectId] as Array<Highlight>).find(
                                  (h) => h.code === nh.code
                              )
                      )
                    : result;

                const highlightsToRemove = employee.highlights[projectId]
                    ? (employee.highlights[projectId] as Array<Highlight>)
                          .filter((h) => !result.find((rh) => h.code === rh.code))
                          .map((rh) => highlights.find((h) => h.code === rh.code).id)
                    : [];

                combineLatest(
                    highlightToAdd
                        .map((h) =>
                            this.employeeService.addEmployeeHighlight(
                                new Empty(),
                                employee.id,
                                projectId,
                                h.id
                            )
                        )
                        .concat(
                            highlightsToRemove.map((id) =>
                                this.employeeService.removeEmployeeHighlight(
                                    employee.id,
                                    projectId,
                                    id
                                )
                            )
                        )
                )
                    .pipe(
                        takeUntil(this.destroy$),
                        take(1),
                        filter((res) => res.length > 0),
                        tap(() => this.notificationService.info('Employee highlights updated')),
                        switchMap((res) =>
                            this.employeeService
                                .getEmployee(res[0].id)
                                .pipe(take(1), takeUntil(this.destroy$))
                        )
                    )
                    .subscribe((user) => {
                        this.updatedEmployees$.next(user);
                        if (
                            user.highlights &&
                            user.highlights[projectId] &&
                            user.highlights[projectId].length
                        ) {
                            highlightMap.set(
                                user.id,
                                user.highlights[projectId].map((elem) => elem.title).join(', ')
                            );
                        } else {
                            highlightMap.delete(user.id);
                        }
                        this.highlightsMap$.next(highlightMap);
                    });
            });
    }

    showTimesheetHistory(project: Project, date: Date): void {
        this.dialog.open(HistoryDialogComponent, {
            autoFocus: false,

            data: {
                date,
                entity: project
            } as HistoryDialogData
        });
    }

    showCellHistory(selectedCells: Set<TimesheetCell>): void {
        this.dialog.open(HistoryDialogComponent, {
            autoFocus: false,

            data: {
                date: new Date(),
                entity: [...selectedCells]
            } as HistoryDialogData
        });
    }
}
