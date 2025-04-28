import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltip } from '@angular/material/tooltip';
import { AsyncPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import {
    catchError,
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
import {
    Office,
    PersonnelAccount,
    Project,
    Role,
    TimesheetCell
} from '../../../protocol/db-protocol';
import { SelectedDateService } from '../../../core/services/selected-date.service';
import { HermesTimesheetService } from '../../../protocol/timesheet-protocol.service';
import { OfficeSwitchDialogComponent } from '../../projects/office-switch-dialog/office-switch-dialog.component';
import { OfficeData, RoleData } from '../../../shared/interfaces/dialog-data.interface';
import {
    MonthlyEmployeeTimesheet,
    OmittedEmployees,
    UpdatePersonnelAccountError,
    UpdatePersonnelAccountRequest
} from '../../../protocol/web-protocol';
import {
    CellEditDialogComponent,
    TimesheetCellData
} from '../../../components/table-grid/cell-edit-dialog/cell-edit-dialog.component';
import { Privileges } from '../../../shared/interfaces/privileges.interface';
import { AccountService } from '../../../core/services/account.service';
import { CacheService } from '../../../core/services/cache.service';
import { NotificationService } from '../../../core/services/notification.service';
import { HermesEmployeeService } from '../../../protocol/web-employee-protocol.service';
import { HermesTaskService } from '../../../protocol/task-protocol.service';
import { AbstractTimesheetComponent } from '../../../shared/classes/abstract-timesheet';
import { EmployeeRoleChangeDialogComponent } from '../../employees/employee-role-change-dialog/employee-role-change-dialog.component';
import { HermesAdminService } from '../../../protocol/web-admin-protocol.service';
import {
    HistoryDialogComponent,
    HistoryDialogData
} from '../../../components/table-grid/history-dialog/history-dialog.component';
import { HermesReportService } from '../../../protocol/report-protocol.service';
import { HermesRoleService } from '../../../protocol/role-protocol.service';
import { BadRequestError } from '../../../protocol/data-protocol';
import { simplifyTitle } from '../../../shared/functions/simplify-title';
import { PseudoClipboardService } from '../../../core/services/pseudo-clipboard.service';
import { OverlayService } from '../../../core/services/overlay.service';
import { TableMenuComponent } from '../../../components/table-grid/table-menu/table-menu.component';
import { TableGridComponent } from '../../../components/table-grid/table-grid.component';
import { RoleWarningsComponent } from '../../../components/role-warnings/role-warnings.component';
import { PromptsDialogComponent } from '../../../components/prompts-dialog/prompts-dialog.component';
import { LoadingIndicatorComponent } from '../../../components/loading-indicator/loading-indicator.component';
import { MonthPickerComponent } from '../../../components/month-picker/month-picker.component';
import { ConfirmationService } from '../../../components/confirmation/confirmation.service';
import { TooltipAutoHideDirective } from '../../../shared/directives/tooltip-auto-hide.directive';

@Component({
    selector: 'app-office-timesheet',
    templateUrl: './office-timesheet.component.html',
    styleUrls: ['./office-timesheet.component.scss'],
    standalone: true,
    imports: [
        InlineSVGModule,
        MonthPickerComponent,
        LoadingIndicatorComponent,
        PromptsDialogComponent,
        RoleWarningsComponent,
        TableGridComponent,
        TableMenuComponent,
        MatTooltip,
        AsyncPipe,
        MatButtonModule,
        MatIconModule,
        MatToolbarModule,
        TooltipAutoHideDirective
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class OfficeTimesheetComponent
    extends AbstractTimesheetComponent
    implements OnInit, OnDestroy
{
    allowedRolesSet$ = new BehaviorSubject<Set<number>>(new Set());
    excludedEmployees$ = new BehaviorSubject<Set<number>>(new Set());
    linkToExcelReport$ = new BehaviorSubject<string>('');
    office$ = new BehaviorSubject<Office>(null);
    participants$ = new BehaviorSubject<number>(0);
    privileges$ = new BehaviorSubject<Privileges | null>(null);
    removedEmployeeId$ = new BehaviorSubject<number | null>(null);
    updatedRow$ = new BehaviorSubject<MonthlyEmployeeTimesheet | null>(null);
    override timesheet$ = new BehaviorSubject<MonthlyEmployeeTimesheet[] | null>(null);
    roles$ = new BehaviorSubject<Role[] | null>(null);
    allowedProjects: Project[] = [];
    projectAllocations = new Map<number, number>();

    constructor(
        public override dialog: MatDialog,
        private route: ActivatedRoute,
        private router: Router,
        private accountService: AccountService,
        private adminService: HermesAdminService,
        public override cacheService: CacheService,
        private reportService: HermesReportService,
        public override employeeService: HermesEmployeeService,
        public override notificationService: NotificationService,
        public override overlayService: OverlayService,
        public selectedDateService: SelectedDateService,
        public override taskService: HermesTaskService,
        public override timesheetService: HermesTimesheetService,
        private hermesRoleService: HermesRoleService,
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
        this.hermesRoleService
            .getRoles()
            .pipe(
                takeUntil(this.destroy$),
                map((collection) => collection.items)
            )
            .subscribe((roles) => this.roles$.next(roles));

        combineLatest([
            this.route.paramMap,
            this.cacheService.offices$.asObservable(),
            this.refreshTimesheet$.asObservable()
        ])
            .pipe(
                takeUntil(this.destroy$),
                tap(() => this.loading$.next(true)),
                filter(
                    ([params, offices]) =>
                        params.has('name') && Boolean(offices) && Boolean(offices.length)
                ),
                map(([params, offices]) =>
                    offices.find((office) => simplifyTitle(office.name) === params.get('name'))
                ),
                tap((office) => {
                    this.office$.next(office);
                    this.allowedRolesSet$.next(new Set(office.allowedRoles));
                }),
                switchMap((office) =>
                    combineLatest([
                        of(office),
                        this.accountService.profile$.asObservable(),
                        this.selectedDateService.selectedDate$.asObservable(),
                        this.cacheService.employees$.asObservable(),
                        this.reportService
                            .getOmittedEmployeesForLastVismaReport(office.id)
                            .pipe(catchError(() => of(new OmittedEmployees())))
                    ]).pipe(
                        takeUntil(this.destroy$),
                        filter(
                            ([officeObject, profile, date, employees]) =>
                                officeObject instanceof Office &&
                                profile instanceof PersonnelAccount &&
                                date instanceof Date &&
                                Boolean(employees)
                        ),
                        debounceTime(250),
                        distinctUntilChanged()
                    )
                )
            )
            .subscribe(
                ([office, profile, selectedDate, employees, omitted]: [
                    Office,
                    PersonnelAccount,
                    Date,
                    PersonnelAccount[],
                    OmittedEmployees
                ]) => {
                    const year = selectedDate.getFullYear();
                    const month = selectedDate.getMonth() + 1;
                    const path = `api/timeoff/report/monthly/${year}/${month}/office/${
                        office.id
                    }/excel?omit_ids=${omitted.omitIds.join(',')}`;
                    this.linkToExcelReport$.next(`${this.reportService.baseUrl}/${path}`);

                    this.privileges$.next(this.setPrivileges(profile, office.id));
                    this.refreshTimesheet(office.id, selectedDate);
                }
            );

        combineLatest([this.cacheService.projects$, this.accountService.profile$])
            .pipe(
                takeUntil(this.destroy$),
                filter(([projects, profile]) => Boolean(projects) && Boolean(profile))
            )
            .subscribe(([projects]) => {
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

        combineLatest([
            this.office$.asObservable(),
            this.selectedDateService.selectedDate$.asObservable()
        ])
            .pipe(
                takeUntil(this.destroy$),
                filter(
                    ([office, selectedDate]) =>
                        office instanceof Office && selectedDate instanceof Date
                ),
                map(([office]) => office),
                switchMap((office) =>
                    this.reportService
                        .getOmittedEmployeesForLastVismaReport(office.id)
                        .pipe(catchError(() => of(new OmittedEmployees())))
                )
            )
            .subscribe((omittedEmployees) => {
                this.excludedEmployees$.next(new Set(omittedEmployees?.omitIds ?? []));
            });
    }

    ngOnDestroy(): void {
        this.completeSubjects();
        this.allowedRolesSet$.complete();
        this.excludedEmployees$.complete();
        this.office$.complete();
        this.participants$.complete();
        this.privileges$.complete();
        this.refreshTimesheet$.complete();
        this.removedEmployeeId$.complete();
        this.roles$.complete();
        this.updatedRow$.complete();
    }

    setPrivileges(profile: PersonnelAccount, officeId: number): Privileges {
        const canEditCell =
            profile.isSuperadmin || (profile.isOfficeManager && profile.officeId === officeId);

        return {
            canEditCell,
            canAllocateEmployee: canEditCell,
            canAddToTeam: canEditCell,
            canChangeLeadingOffice: profile.isSuperadmin,
            canChangeProjectSupervisor: profile.isSuperadmin || profile.isOfficeManager
        } as Privileges;
    }

    openCellAllocateDialog(selectedCells: Set<TimesheetCell>): void {
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
            .pipe(takeUntil(this.destroy$), take(1))
            .subscribe((result) => {
                this.sendRequests(result, selectedCells);
            });
    }

    refreshTimesheet(officeId: number, selectedDate: Date): void {
        this.timesheetService
            .getMonthlyTimesheetForOffice(
                selectedDate.getFullYear(),
                selectedDate.getMonth() + 1,
                officeId
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
                this.participants$.next(timesheet.filter((mt) => mt.cells.length > 0).length);
                this.projectAllocations = new Map(
                    timesheet.map((item) => [item.personnelId, item.allocatedToProjectId || null])
                );
                this.loading$.next(false);
            });
    }

    openSwitchOfficeDialog(officeId: number, date: Date): void {
        const dialogRef = this.dialog.open(OfficeSwitchDialogComponent, {
            autoFocus: false,

            data: { officeId, header: 'Switch to...' } satisfies OfficeData
        });

        dialogRef
            .afterClosed()
            .pipe(take(1), takeUntil(this.destroy$))
            .subscribe((result) => {
                if (!result?.name) return;
                this.router.navigate([
                    'offices',
                    simplifyTitle(result.name),
                    date.getFullYear(),
                    date.getMonth() + 1
                ]);
            });
    }

    onRoleChange(
        roles: Role[],
        employeeId: number,
        event: MouseEvent,
        allowedRoles: Set<number>,
        currentRoleId: number | null = null,
        canEdit: boolean
    ): void {
        if (!canEdit) return;
        event.stopPropagation();
        this.dialog
            .open(EmployeeRoleChangeDialogComponent, {
                autoFocus: false,

                data: { roles, header: 'Assign a role', currentRoleId, allowedRoles } as RoleData
            })
            .afterClosed()
            .pipe(
                takeUntil(this.destroy$),
                take(1),
                filter((result) => Boolean(result)),
                switchMap((result: Role) => {
                    const request = new UpdatePersonnelAccountRequest();
                    request.roleId = result.id;

                    return this.adminService
                        .updatePersonnelAccount(request, employeeId)
                        .pipe(takeUntil(this.destroy$), take(1));
                })
            )
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
    }

    showTimesheetHistory(office: Office, date: Date): void {
        this.dialog.open(HistoryDialogComponent, {
            autoFocus: false,

            data: {
                date,
                entity: office
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

    certainProtectTimesheet(
        office: Office,
        employees: PersonnelAccount[],
        timesheet: MonthlyEmployeeTimesheet[]
    ): void {
        const employeesId = timesheet.map((item) => item.personnelId);
        const officeEmployees: PersonnelAccount[] = employees.filter((employee) =>
            employeesId.includes(employee.id)
        );
        const isCorrectOffice = officeEmployees.every((employee) =>
            office.allowedRoles.includes(employee.roleId)
        );

        if (isCorrectOffice) {
            this.protectTimesheet(timesheet);
        } else {
            this.confirmationService
                .fire({
                    data: {
                        title: 'Warning',
                        html: `Some office employees do not have roles assigned to them. The missing details for such employees could result in a broken report. Continue anyway?`,
                        confirmText: `Continue`,
                        cancelText: 'Cancel'
                    }
                })
                .pipe(filter(Boolean), takeUntil(this.destroy$))
                .subscribe(() => this.protectTimesheet(timesheet));
        }
    }
}
