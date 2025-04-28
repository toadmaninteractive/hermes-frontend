import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import {
    MatTable,
    MatColumnDef,
    MatHeaderCellDef,
    MatHeaderCell,
    MatCellDef,
    MatCell,
    MatFooterCellDef,
    MatFooterCell,
    MatHeaderRowDef,
    MatHeaderRow,
    MatRowDef,
    MatRow,
    MatFooterRowDef,
    MatFooterRow
} from '@angular/material/table';
import { MatButton, MatButtonModule } from '@angular/material/button';
import {
    NgClass,
    AsyncPipe,
    UpperCasePipe,
    SlicePipe,
    TitleCasePipe,
    DatePipe
} from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { provideDateFnsAdapter } from '@angular/material-date-fns-adapter';
import { MatToolbarModule } from '@angular/material/toolbar';
import {
    catchError,
    debounceTime,
    distinctUntilChanged,
    filter,
    map,
    switchMap,
    take,
    takeUntil,
    tap
} from 'rxjs/operators';
import { saveAs } from 'file-saver';
import { BehaviorSubject, combineLatest, of, Subject } from 'rxjs';
import { InlineSVGModule } from 'ng-inline-svg-2';
import { ProjectSwitchDialogComponent } from 'src/app/components/project-switch-dialog/project-switch-dialog.component';
import { MonthlyEmployeeTimesheet } from '../../protocol/web-protocol';
import { HermesTimesheetService } from '../../protocol/timesheet-protocol.service';
import { HermesRoleService } from '../../protocol/role-protocol.service';
import { HermesEmployeeService } from '../../protocol/web-employee-protocol.service';
import { PersonnelAccount, Project } from '../../protocol/db-protocol';
import { HermesProjectService } from '../../protocol/project-protocol.service';
import { NotificationService } from '../../core/services/notification.service';
import { DateRange } from '../../components/month-range-picker/month-range-picker.structures';
import { ProjectEditDialogComponent } from '../projects/project-edit-dialog/project-edit-dialog.component';
import { SelectedDateService } from '../../core/services/selected-date.service';
import { simplifyTitle } from '../../shared/functions/simplify-title';
import { Privileges } from '../../shared/interfaces/privileges.interface';
import { CacheService } from '../../core/services/cache.service';
import { AccountService } from '../../core/services/account.service';
import { NumericPipe } from '../../shared/pipes/numeric.pipe';
import { LoadingIndicatorComponent } from '../../components/loading-indicator/loading-indicator.component';
import { MonthRangePickerComponent } from '../../components/month-range-picker/month-range-picker.component';
import { ProjectsData } from '../../shared/interfaces/dialog-data.interface';

type OfficeName = string;

const LINE_BREAK = '\r\n';

enum TableColumn {
    Role = 'role',
    Number = 'number',
    WorkDays = 'workDays',
    PlannedDays = 'plannedDays',
    Hours = 'hours',
    PlannedHours = 'plannedHours'
}

interface RolesInfo {
    roleTitle: string;
    days: number;
    plannedDays: number;
    amount: number;
    officeName?: string;
}

interface ProjectDurationLabel {
    amount: number | null;
    label: string;
}

@Component({
    selector: 'app-summary',
    templateUrl: './summary.component.html',
    styleUrls: ['./summary.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    providers: [provideDateFnsAdapter()],
    imports: [
        InlineSVGModule,
        MatButton,
        MonthRangePickerComponent,
        LoadingIndicatorComponent,
        MatTable,
        MatColumnDef,
        MatHeaderCellDef,
        MatHeaderCell,
        MatCellDef,
        MatCell,
        MatFooterCellDef,
        MatFooterCell,
        MatHeaderRowDef,
        MatHeaderRow,
        MatRowDef,
        MatRow,
        NgClass,
        MatFooterRowDef,
        MatFooterRow,
        AsyncPipe,
        UpperCasePipe,
        SlicePipe,
        TitleCasePipe,
        DatePipe,
        NumericPipe,
        MatButtonModule,
        MatIconModule,
        MatToolbarModule
    ]
})
export class SummaryComponent implements OnInit, OnDestroy {
    destroy$ = new Subject<void>();
    ready$ = new Subject();
    dataForCSV$ = new BehaviorSubject<RolesInfo[]>([]);
    dateRange$ = new BehaviorSubject<{ start: Date; end: Date }>({
        start: new Date(),
        end: new Date()
    });
    employees$ = new BehaviorSubject<PersonnelAccount[] | null>(null);
    loading$ = new BehaviorSubject<boolean>(false);
    project$ = new BehaviorSubject<Project | null>(null);
    projects$ = new BehaviorSubject<Project[]>([]);
    refresh$ = new BehaviorSubject<boolean>(true);
    rows$ = new BehaviorSubject<string[]>([]);
    tableData$ = new BehaviorSubject<RolesInfo[]>([]);
    privileges$ = new BehaviorSubject<Privileges | null>(null);

    tableColumn = TableColumn;

    csvSeparator = ',';
    displayedDateRange: DateRange = {
        start: new Date(),
        end: new Date()
    };
    displayedColumns = [
        TableColumn.Role,
        TableColumn.Number,
        TableColumn.WorkDays,
        TableColumn.Hours,
        TableColumn.PlannedDays,
        TableColumn.PlannedHours
    ];

    projectId: number | null = null;
    projectTitle: string | null = null;

    projectStartDate: Date | null = null;
    projectEndDate: Date | null = null;
    roleIdToTitle = new Map<number, string>();
    roleToEmplsMap = new Map<number, PersonnelAccount[]>();

    subrowMap: Map<string, boolean> = new Map();

    constructor(
        private activatedRoute: ActivatedRoute,
        private dialog: MatDialog,
        private employeeService: HermesEmployeeService,
        private notificationService: NotificationService,
        private projectService: HermesProjectService,
        private roleService: HermesRoleService,
        public timesheetService: HermesTimesheetService,
        public accountService: AccountService,
        public selectedDateService: SelectedDateService,
        public cacheService: CacheService
    ) {}

    ngOnInit(): void {
        combineLatest([this.activatedRoute.paramMap, this.refresh$.asObservable()])
            .pipe(
                takeUntil(this.destroy$),
                filter(([params, _]) => params.has('name')),
                map(([params, _]) => params.get('name')),
                tap((projectName) => (this.projectTitle = projectName)),
                // tap((projectId) => (this.projectId = projectId)),
                tap(() => this.loading$.next(true)),
                switchMap((_) =>
                    this.projectService.getProjects().pipe(
                        takeUntil(this.destroy$),
                        map((col) => col.items)
                    )
                ),
                tap((projects: Project[]) => this.projects$.next(projects)),
                map((projects: Project[]) =>
                    projects.find((project) => simplifyTitle(project.title) === this.projectTitle)
                ),
                tap(
                    (project: Project | undefined) => (this.projectId = project ? project.id : null)
                ),
                tap((project: Project | undefined) => this.project$.next(project ?? null)),
                tap((project: Project | undefined) => {
                    if (project.startedAt) {
                        this.projectStartDate = new Date(
                            project.startedAt.getFullYear(),
                            project.startedAt.getMonth(),
                            1
                        );
                        this.projectEndDate = project.finishedAt
                            ? new Date(
                                  project.finishedAt.getFullYear(),
                                  project.finishedAt.getMonth(),
                                  1
                              )
                            : new Date();
                        this.displayedDateRange = {
                            start: this.projectStartDate,
                            end: this.projectEndDate
                        };
                        this.dateRange$.next({
                            start: this.projectStartDate,
                            end: this.projectEndDate
                        });
                    } else {
                        this.notificationService.error('Project duration is not set');
                    }
                }),
                map((project: Project) => project.id),
                switchMap((projectId: number) =>
                    this.employeeService.getEmployeesByProject(
                        projectId,
                        this.projectStartDate,
                        this.projectEndDate
                    )
                ),
                map((col) => col.items),
                tap((employees) => this.employees$.next(employees.length !== 0 ? employees : null)),
                filter((val) => Boolean(val)),
                switchMap((empls) => {
                    const roleIds = new Set(empls.map((empl) => empl.roleId));
                    return this.roleService.getRoles().pipe(
                        takeUntil(this.destroy$),
                        map((col) => col.items),
                        map((roles) => roles.filter((role) => roleIds.has(role.id))),
                        map(
                            (rolesOnProject) =>
                                new Map(rolesOnProject.map((role) => [role.id, role.title]))
                        ),
                        tap((roleMap) => (this.roleIdToTitle = roleMap)),
                        map((_) =>
                            empls.reduce((result, empl) => {
                                const newValue = result.has(empl.roleId)
                                    ? [...result.get(empl.roleId), empl]
                                    : [empl];
                                result.set(empl.roleId, newValue);
                                return result;
                            }, new Map<number, PersonnelAccount[]>())
                        )
                    );
                }),
                tap((roleToEmplsMap) => (this.roleToEmplsMap = roleToEmplsMap))
            )
            .subscribe(() => this.ready$.next(true));

        combineLatest([
            this.activatedRoute.paramMap,
            this.cacheService.projects$.asObservable(),
            this.refresh$.asObservable()
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
                        this.cacheService.projects$.asObservable()
                    ]).pipe(
                        filter((x): x is [Project, PersonnelAccount, Project[]] => {
                            const [projectObject, profile, projects] = x;
                            return (
                                projectObject instanceof Project &&
                                profile instanceof PersonnelAccount &&
                                Boolean(projects)
                            );
                        }),
                        takeUntil(this.destroy$),
                        take(1),
                        debounceTime(250),
                        distinctUntilChanged()
                    )
                )
            )
            .subscribe(([project, profile, projects]) => {
                this.privileges$.next(this.setPrivileges(profile, project.id, projects));
            });

        combineLatest([
            this.ready$.asObservable(),
            this.dateRange$
                .asObservable()
                .pipe(filter(({ start, end }) => Boolean(start) && Boolean(end)))
        ])
            .pipe(
                tap(() => this.loading$.next(true)),
                takeUntil(this.destroy$),
                map(([_, dateRange]: [boolean, { start: Date; end: Date }]) => dateRange),
                switchMap((dateRange) =>
                    combineLatest(
                        this.makeDateList(dateRange).map((date) =>
                            this.timesheetService
                                .getMonthlyTimesheetForProject(
                                    date.getFullYear(),
                                    date.getMonth() + 1,
                                    this.projectId
                                )
                                .pipe(
                                    catchError((_) => of(null)),
                                    map((col) =>
                                        this.projectEndDate < date || this.projectStartDate > date
                                            ? null
                                            : col
                                    ),
                                    map((col) => (col ? col.items : null)),
                                    take(1)
                                )
                        )
                    ).pipe(take(1))
                ),
                map((timesheetsList: (MonthlyEmployeeTimesheet[] | null)[]) => {
                    const daysEmpls: Map<number, { days: number; projectedDays: number }> =
                        new Map(); // Grouped by employees
                    let lastTs = [];

                    return timesheetsList.reduce((result, tsList) => {
                        const isProjected = !tsList;
                        (tsList || lastTs).forEach((ts: MonthlyEmployeeTimesheet) => {
                            const newValue = {
                                days: 0,
                                projectedDays: 0
                            };

                            const countDays = ts.cells.filter(
                                (cell) => cell.projectId === this.projectId
                            ).length;

                            if (result.has(ts.personnelId)) {
                                newValue.days = result.get(ts.personnelId).days + countDays;
                                newValue.projectedDays = isProjected
                                    ? result.get(ts.personnelId).projectedDays + countDays
                                    : result.get(ts.personnelId).projectedDays;
                            } else {
                                isProjected
                                    ? (newValue.projectedDays = countDays)
                                    : (newValue.days = countDays);
                            }
                            result.set(ts.personnelId, newValue);
                        });
                        if (tsList) {
                            lastTs = tsList;
                        }
                        return result;
                    }, daysEmpls);
                }),
                map((daysEmpls) => {
                    const tableData = [];
                    this.roleToEmplsMap.forEach((empls, roleId) => {
                        empls.reduce((result, empl) => {
                            if (daysEmpls.has(empl.id)) {
                                const targetRole = result.find(
                                    (el) =>
                                        el.officeName === empl.officeName &&
                                        el.roleTitle === this.roleIdToTitle.get(roleId)
                                );
                                if (targetRole) {
                                    targetRole.days += daysEmpls.get(empl.id).days;
                                    targetRole.plannedDays += daysEmpls.get(empl.id).projectedDays;
                                    targetRole.amount += 1;
                                } else {
                                    result.push({
                                        roleTitle: this.roleIdToTitle.get(roleId),
                                        days: daysEmpls.get(empl.id).days,
                                        plannedDays: daysEmpls.get(empl.id).projectedDays,
                                        amount: 1,
                                        officeName: empl.officeName
                                    });
                                }
                            }
                            return result;
                        }, tableData);
                    });
                    return tableData;
                })
            )
            .subscribe((tableData) => {
                const dataForTable: RolesInfo[] = tableData.reduce((result, item) => {
                    const targetItem = result.find((el) => el.roleTitle === item.roleTitle);
                    if (targetItem) {
                        targetItem.days += item.days;
                        targetItem.plannedDays += item.plannedDays;
                        targetItem.amount += item.amount;
                    } else {
                        result.push({
                            roleTitle: item.roleTitle,
                            days: item.days,
                            plannedDays: item.plannedDays,
                            amount: item.amount
                        });
                    }
                    return result;
                }, [] as RolesInfo[]);

                this.dataForCSV$.next(tableData);

                const uniqueRoleTitles = new Set(
                    dataForTable.map((item) =>
                        item.roleTitle ? item.roleTitle.split(' ')[0] : 'Undefined role'
                    )
                );
                const rowList = Array.from(uniqueRoleTitles);
                this.rows$.next(rowList);
                this.subrowMap = new Map(rowList.map((row) => [row, false]));
                this.tableData$.next(dataForTable);
                this.loading$.next(false);
            });
    }

    ngOnDestroy(): void {
        this.destroy$.next(null);
        this.destroy$.complete();
        this.dateRange$.complete();
        this.dataForCSV$.complete();
        this.employees$.complete();
        this.loading$.complete();
        this.ready$.next(true);
        this.ready$.complete();
        this.refresh$.complete();
        this.tableData$.complete();
        this.privileges$.complete();
        this.project$.complete();
        this.projects$.complete();
        this.rows$.complete();
    }

    projectDurationLabel(dateFrom: Date, dateTo: Date): ProjectDurationLabel {
        const diffInMonths = Math.abs(
            dateTo.getMonth() -
                dateFrom.getMonth() +
                12 * (dateTo.getFullYear() - dateFrom.getFullYear())
        );
        if (diffInMonths) {
            return { amount: diffInMonths, label: diffInMonths === 1 ? 'month' : 'months' };
        }
        const diffInDays = Math.abs(dateTo.getDate() - dateFrom.getDate());
        if (diffInDays) {
            return { amount: diffInDays, label: diffInDays === 1 ? 'day' : 'days' };
        }

        return { amount: null, label: 'Less than 1 day' };
    }

    getNoSetFinishDataMsg(startAt: Date | null): string {
        if (!startAt) return '–';
        const today = new Date();

        const months = Math.abs(
            today.getMonth() -
                startAt.getMonth() +
                12 * (today.getFullYear() - startAt.getFullYear())
        );

        if (months) {
            return today < startAt
                ? `It will start in ${months} ${months === 1 ? 'month' : 'months'} `
                : `It's been for a ${months} ${
                      months === 1 ? 'month' : 'months'
                  }, still in development.`;
        }

        const days = Math.abs(today.getDate() - startAt.getDate());
        if (days) {
            return today < startAt
                ? `It will start in ${days} ${days === 1 ? 'day' : 'days'} `
                : `It's been for a ${days} ${days === 1 ? 'day' : 'days'}, still in development.`;
        }

        return today < startAt
            ? 'It will start in less than 1 day'
            : "It's been less than 1 day, still in development.";
    }

    onChangeDate(dateRange: DateRange) {
        this.dateRange$.next({ start: dateRange.start, end: dateRange.end });
    }

    // ? dangerous
    makeDateList({ start, end }): Date[] {
        const pointer = new Date(start.getFullYear(), start.getMonth(), 1);
        const rightBorder = new Date(end.getFullYear(), end.getMonth(), 1);
        const result = [];
        while (pointer <= rightBorder) {
            result.push(new Date(pointer));
            pointer.setMonth(pointer.getMonth() + 1);
        }
        return result as Date[];
    }

    getSubrows(roleTitle: string, tableData: RolesInfo[]): RolesInfo[] {
        if (!roleTitle) {
            return [];
        }
        return tableData.filter((row) =>
            row.roleTitle
                ? roleTitle.split(' ')[0] === row.roleTitle.split(' ')[0]
                : roleTitle.split(' ')[0] === 'Undefined'
        );
    }

    fieldSum(field: string, roleTitle: string, tableData: RolesInfo[]): number {
        return this.getSubrows(roleTitle, tableData).reduce<number>(
            (sum, row) => sum + Number(row[field]),
            0
        );
    }

    fieldTotalSum(field: string, tableData: RolesInfo[]): number {
        return tableData.reduce<number>((sum, row) => sum + Number(row[field]), 0);
    }

    openSwitchProjectDialog(projects: Project[]): void {
        this.project$.pipe(take(1), takeUntil(this.destroy$)).subscribe((currentProject) => {
            this.dialog.open(ProjectSwitchDialogComponent, {
                autoFocus: false,

                data: { projects, currentProject, url: `/summary/{}` } satisfies ProjectsData
            });
        });
    }

    showProjectEditDialog(project: Project): void {
        const dialogRef = this.dialog.open(ProjectEditDialogComponent, {
            data: project
        });

        dialogRef
            .afterClosed()
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => this.refresh$.next(true));
    }

    switchSubrow(row: string): void {
        this.subrowMap.set(row, !this.subrowMap.get(row));
    }

    projectHasDateRange(project: Project | null): boolean {
        return project && Boolean(project.startedAt);
    }

    groupByOffice(data: RolesInfo[]): Map<OfficeName, RolesInfo[]> {
        const resultMap = new Map<OfficeName, RolesInfo[]>();

        data.reduce((result, item) => {
            if (result.has(item.officeName)) {
                const prevValue = result.get(item.officeName);
                result.set(item.officeName, [...prevValue, item]);
            } else {
                result.set(item.officeName, [item]);
            }

            return result;
        }, resultMap);
        return resultMap;
    }

    buildTableToCSV(data: RolesInfo[], officeName: string): string[] {
        const header = `${[
            `Role - ${officeName}`,
            'Employees',
            'Work Days',
            'Hours',
            'Future Days',
            'Future Hours'
        ].join(this.csvSeparator)}${LINE_BREAK}`;

        const rows = data.map(
            (role) =>
                `${[
                    role.roleTitle,
                    role.amount,
                    role.days,
                    role.days * 8,
                    role.plannedDays,
                    role.plannedDays * 8
                ].join(this.csvSeparator)}${LINE_BREAK}`
        );

        const total = `${[
            'Total',
            this.fieldTotalSum('amount', data),
            this.fieldTotalSum('days', data),
            this.fieldTotalSum('days', data) * 8,
            this.fieldTotalSum('plannedDays', data),
            this.fieldTotalSum('plannedDays', data) * 8
        ].join(this.csvSeparator)}${LINE_BREAK}`;

        return [header, ...rows, ...total];
    }

    dataToCSV(data: RolesInfo[]): string[] {
        const officeToData = Array.from(this.groupByOffice(data).entries());
        return officeToData.reduce<string[]>(
            (result, [officeName, item]) => [
                ...this.buildTableToCSV(item, officeName),
                LINE_BREAK,
                ...result
            ],
            []
        );
    }

    onExportToCSV(data: RolesInfo[], project: Project): void {
        const rowsCsvList = this.dataToCSV(data);
        const blob = new Blob(rowsCsvList, { type: 'text/plain;charset=utf-8' });
        const dateNow = new Date();
        saveAs(blob, `summary-${project.title}_${dateNow.toDateString()}.csv`);
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
}
