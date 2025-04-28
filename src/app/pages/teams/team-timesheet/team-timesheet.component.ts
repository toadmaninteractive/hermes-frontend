import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltip } from '@angular/material/tooltip';
import { AsyncPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
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
import { AccountService } from '../../../core/services/account.service';
import { CacheService } from '../../../core/services/cache.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SelectedDateService } from '../../../core/services/selected-date.service';
import { AbstractTimesheetComponent } from '../../../shared/classes/abstract-timesheet';
import { Privileges } from '../../../shared/interfaces/privileges.interface';
import { DialogResult } from '../../../shared/interfaces/dialog-result.interface';
import { RoleData, TeamData } from '../../../shared/interfaces/dialog-data.interface';
import {
    CellEditDialogComponent,
    TimesheetCellData
} from '../../../components/table-grid/cell-edit-dialog/cell-edit-dialog.component';
import { SelectEmployeeDialogComponent } from '../../../components/table-grid/select-employee-dialog/select-employee-dialog.component';
import { EmployeeRoleChangeDialogComponent } from '../../employees/employee-role-change-dialog/employee-role-change-dialog.component';
import { TeamSwitchDialogComponent } from '../team-switch-dialog/team-switch-dialog.component';
import { Empty } from '../../../protocol/common-protocol';
import {
    PersonnelAccount,
    Project,
    Role,
    Team,
    TimesheetCell
} from '../../../protocol/db-protocol';
import { HermesAdminService } from '../../../protocol/web-admin-protocol.service';
import { HermesEmployeeService } from '../../../protocol/web-employee-protocol.service';
import { HermesTaskService } from '../../../protocol/task-protocol.service';
import { HermesTeamService } from '../../../protocol/team-protocol.service';
import { HermesTimesheetService } from '../../../protocol/timesheet-protocol.service';
import {
    MonthlyEmployeeTimesheet,
    TeamMemberError,
    UpdatePersonnelAccountError,
    UpdatePersonnelAccountRequest
} from '../../../protocol/web-protocol';
import {
    HistoryDialogComponent,
    HistoryDialogData
} from '../../../components/table-grid/history-dialog/history-dialog.component';
import { BadRequestError, GenericResponse } from '../../../protocol/data-protocol';
import { simplifyTitle } from '../../../shared/functions/simplify-title';
import { PseudoClipboardService } from '../../../core/services/pseudo-clipboard.service';
import { OverlayService } from '../../../core/services/overlay.service';
import { HermesRoleService } from '../../../protocol/role-protocol.service';
import { TableMenuComponent } from '../../../components/table-grid/table-menu/table-menu.component';
import { TableGridComponent } from '../../../components/table-grid/table-grid.component';
import { PromptsDialogComponent } from '../../../components/prompts-dialog/prompts-dialog.component';
import { LoadingIndicatorComponent } from '../../../components/loading-indicator/loading-indicator.component';
import { MonthPickerComponent } from '../../../components/month-picker/month-picker.component';
import { ConfirmationService } from '../../../components/confirmation/confirmation.service';
import { TooltipAutoHideDirective } from '../../../shared/directives/tooltip-auto-hide.directive';

@Component({
    selector: 'app-team-timesheet',
    templateUrl: './team-timesheet.component.html',
    styleUrls: ['./team-timesheet.component.scss'],
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
        MatButtonModule,
        MatIconModule,
        MatToolbarModule,
        TooltipAutoHideDirective
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamTimesheetComponent
    extends AbstractTimesheetComponent
    implements OnInit, OnDestroy
{
    allowedRolesSet$ = new BehaviorSubject<Set<number>>(new Set());
    participants$ = new BehaviorSubject<number>(0);
    privileges$ = new BehaviorSubject<Privileges | null>(null);
    removedEmployeeId$ = new BehaviorSubject<number | null>(null);
    updatedRow$ = new BehaviorSubject<MonthlyEmployeeTimesheet | null>(null);
    override timesheet$ = new BehaviorSubject<MonthlyEmployeeTimesheet[] | null>(null);
    team$ = new BehaviorSubject<Team | null>(null);
    teamManagersIds$ = new BehaviorSubject<Set<number>>(new Set());
    allowedProjects: Project[] = [];
    projectAllocations = new Map<number, number>();
    teamMembers: PersonnelAccount[] = [];

    constructor(
        public override dialog: MatDialog,
        private route: ActivatedRoute,
        private accountService: AccountService,
        private adminService: HermesAdminService,
        public override cacheService: CacheService,
        public override notificationService: NotificationService,
        public override overlayService: OverlayService,
        public selectedDateService: SelectedDateService,
        public override employeeService: HermesEmployeeService,
        public override taskService: HermesTaskService,
        public override timesheetService: HermesTimesheetService,
        private teamService: HermesTeamService,
        private roleService: HermesRoleService,
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
        this.roleService
            .getRoles()
            .pipe(
                takeUntil(this.destroy$),
                map((collection) => collection.items)
            )
            .subscribe((roles) =>
                this.allowedRolesSet$.next(new Set(roles.map((role) => role.id)))
            );

        combineLatest([
            this.route.paramMap,
            this.cacheService.teams$.asObservable(),
            this.refreshTimesheet$.asObservable()
        ])
            .pipe(
                takeUntil(this.destroy$),
                tap(() => this.loading$.next(true)),
                filter(
                    ([params, teams, refresh]) =>
                        params.get('name') && Boolean(teams) && Boolean(teams.length)
                ),
                map(([params, teams]) =>
                    teams.find((team) => simplifyTitle(team.title) === params.get('name'))
                ),
                tap((team) => this.team$.next(team)),

                switchMap((team) =>
                    combineLatest([
                        of(team),
                        this.accountService.profile$.asObservable(),
                        this.selectedDateService.selectedDate$.asObservable(),
                        this.cacheService.employees$.asObservable(),
                        this.teamService
                            .getTeamManagers(team.id)
                            .pipe(map((collection) => collection.items))
                    ]).pipe(
                        filter(
                            ([teamObject, profile, date, employees]) =>
                                teamObject instanceof Team &&
                                profile instanceof PersonnelAccount &&
                                date instanceof Date &&
                                Boolean(employees)
                        ),
                        takeUntil(this.destroy$),
                        take(1),
                        debounceTime(250),
                        distinctUntilChanged()
                    )
                )
            )
            .subscribe(
                ([team, profile, selectedDate, employees, teamManagers]: [
                    Team,
                    PersonnelAccount,
                    Date,
                    PersonnelAccount[],
                    PersonnelAccount[]
                ]) => {
                    this.participants$.next(team.members.length);
                    this.privileges$.next(this.setPrivileges(profile, team, teamManagers));
                    this.teamManagersIds$.next(new Set(teamManagers.map((manager) => manager.id)));
                    this.teamMembers = employees.filter((employee) =>
                        team.members.includes(employee.username)
                    );
                    this.refreshTimesheet(team.id, selectedDate);
                }
            );

        this.cacheService.projects$
            .pipe(takeUntil(this.destroy$))
            .subscribe((projects) => (this.allowedProjects = projects));
    }

    ngOnDestroy(): void {
        this.completeSubjects();
        this.allowedRolesSet$.complete();
        this.participants$.complete();
        this.privileges$.complete();
        this.refreshTimesheet$.complete();
        this.removedEmployeeId$.complete();
        this.team$.complete();
        this.teamManagersIds$.complete();
        this.updatedRow$.complete();
    }

    setPrivileges(
        profile: PersonnelAccount,
        team: Team,
        teamManagers: PersonnelAccount[]
    ): Privileges {
        const canEditCellPrivilege =
            profile.isSuperadmin ||
            profile.id === team?.createdBy ||
            teamManagers.findIndex((manager) => manager.id === profile.id) !== -1;

        return {
            canEditCell: canEditCellPrivilege,
            canAllocateEmployee: canEditCellPrivilege,
            canAddToTeam: canEditCellPrivilege
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
            .pipe(take(1))
            .subscribe((result) => {
                this.sendRequests(result, selectedCells);
            });
    }

    refreshTimesheet(teamId: number, selectedDate: Date): void {
        this.timesheetService
            .getMonthlyTimesheetForTeam(
                selectedDate.getFullYear(),
                selectedDate.getMonth() + 1,
                teamId
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
                this.projectAllocations = new Map(
                    timesheet.map((item) => [item.personnelId, item.allocatedToProjectId || null])
                );
                this.loading$.next(false);
            });
    }

    openSwitchTeamDialog(teams: Team[]): void {
        this.team$
            .pipe(
                take(1),
                switchMap((currentTeam) =>
                    this.dialog
                        .open(TeamSwitchDialogComponent, {
                            autoFocus: false,

                            data: { teams, currentTeam } satisfies TeamData
                        })
                        .afterClosed()
                ),
                takeUntil(this.destroy$)
            )
            .subscribe((result: DialogResult) => {
                if (result?.error) {
                    this.handleBadRequestError(result.error);
                }
            });
    }

    addEmployeeToTeam(teamId: number): void {
        const dialogRef = this.dialog.open(SelectEmployeeDialogComponent, {
            autoFocus: false,

            data: { header: 'Add to team', existingEmployees: this.teamMembers, multiple: true }
        });

        dialogRef.afterClosed().subscribe((selectedEmployees: Array<number>) => {
            const request = new Empty();
            combineLatest(
                selectedEmployees.map((employeeId) =>
                    this.teamService.addTeamMember(request, teamId, employeeId)
                )
            )
                .pipe(take(1), takeUntil(this.destroy$))
                .subscribe((res) => {
                    if (res.every((r) => r instanceof GenericResponse)) {
                        this.notificationService.success(`${res.length} employees added to team`);
                    }

                    this.cacheService.reloadTeams();
                });
        });
    }

    removeTeamMember(
        teamId: number,
        memberId: number,
        participants: number,
        employeeName: string,
        canEdit: boolean
    ): void {
        if (!canEdit) return;

        this.confirmationService
            .fire({
                data: {
                    title: 'Confirmation',
                    html: `Remove ${employeeName} from this team?`,
                    confirmText: 'Remove'
                }
            })
            .pipe(
                take(1),
                takeUntil(this.destroy$),
                switchMap((response) => {
                    if (response) {
                        return this.teamService
                            .removeTeamMember(teamId, memberId)
                            .pipe(takeUntil(this.destroy$), take(1));
                    }
                    return of(null);
                })
            )
            .subscribe(
                (res) => {
                    if (res) {
                        this.cacheService.reloadTeams();
                        this.notificationService.info('Team member was removed');
                        this.removedEmployeeId$.next(memberId);
                        // FIXME: placed because child doesn't get new value if it the same as previous
                        setTimeout(() => this.removedEmployeeId$.next(null), 100);
                        this.participants$.next(participants - 1);
                        this.teamMembers.splice(
                            this.teamMembers.findIndex((tm) => tm.id === memberId),
                            1
                        );
                    }
                },
                (error) => {
                    if (error instanceof BadRequestError) {
                        const errorMessage = TeamMemberError.getDescription(error.error);
                        this.notificationService.error(errorMessage ?? error);
                    } else {
                        this.notificationService.error(error);
                    }
                }
            );
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
        this.dialog
            .open(EmployeeRoleChangeDialogComponent, {
                autoFocus: false,

                data: { roles, header: 'Assign a role', currentRoleId, allowedRoles } as RoleData
            })
            .afterClosed()
            .pipe(filter((result) => Boolean(result)))

            .subscribe((result: Role) => {
                const request = new UpdatePersonnelAccountRequest();
                request.roleId = result.id;

                this.adminService
                    .updatePersonnelAccount(request, employeeId)
                    .pipe(take(1))
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

    showTimesheetHistory(team: Team, date: Date): void {
        this.dialog.open(HistoryDialogComponent, {
            autoFocus: false,

            data: {
                date,
                entity: team
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
