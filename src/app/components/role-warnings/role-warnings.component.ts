import { ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AsyncPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { filter, map, takeUntil } from 'rxjs/operators';
import { BehaviorSubject, combineLatest, Subject } from 'rxjs';
import { CacheService } from '../../core/services/cache.service';
import { MonthlyEmployeeTimesheet } from '../../protocol/web-protocol';
import { Office, PersonnelAccount, TimesheetCell } from '../../protocol/db-protocol';
import { OfficeWarningsComponent } from './office-warnings/office-warnings.component';

interface WarningGroups {
    unassignedRoles: PersonnelAccount[];
    unavailableRoles: PersonnelAccount[];
    allocatedBeforeHiring: PersonnelAccount[];
    allocatedAfterFiring: PersonnelAccount[];
}

@Component({
    selector: 'app-role-warnings',
    templateUrl: './role-warnings.component.html',
    styleUrls: ['./role-warnings.component.scss'],
    standalone: true,
    imports: [AsyncPipe, MatButtonModule, MatIconModule],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoleWarningsComponent implements OnInit, OnDestroy {
    destroy$ = new Subject<void>();
    timesheet$ = new BehaviorSubject<MonthlyEmployeeTimesheet[] | null>(null);
    office$ = new BehaviorSubject<Office | null>(null);
    warningGroups$ = new BehaviorSubject<WarningGroups>({
        unassignedRoles: [],
        unavailableRoles: [],
        allocatedBeforeHiring: [],
        allocatedAfterFiring: []
    });

    @Input() set timesheet(value: MonthlyEmployeeTimesheet[]) {
        this.timesheet$.next(value);
    }

    @Input() set office(value: Office) {
        this.office$.next(value);
    }

    constructor(
        private dialog: MatDialog,
        public cacheService: CacheService
    ) {}

    ngOnInit(): void {
        combineLatest([
            this.timesheet$.asObservable().pipe(filter((timesheet) => Boolean(timesheet))),
            this.cacheService.employees$.asObservable(),
            this.office$.asObservable()
        ])
            .pipe(
                takeUntil(this.destroy$),
                map(([timesheet, employees, office]) => {
                    const timesheetId = timesheet
                        .filter((item) => Boolean(item.cells.length))
                        .map((item) => item.personnelId);
                    const allowedRoles = office.allowedRoles;
                    const timesheetEmployees = employees.filter((employee) =>
                        timesheetId.includes(employee.id)
                    );

                    const sortCallback = (a, b) => {
                        if (a.name.toLowerCase() > b.name.toLowerCase()) {
                            return 1;
                        } else if (a.name.toLowerCase() < b.name.toLowerCase()) {
                            return -1;
                        }

                        return 0;
                    };

                    return {
                        unassignedRoles: timesheetEmployees
                            .filter((employee) => !employee.roleId)
                            .sort(sortCallback),
                        unavailableRoles: timesheetEmployees
                            .filter(
                                (employee) =>
                                    employee.roleId && !allowedRoles.includes(employee.roleId)
                            )
                            .sort(sortCallback),
                        // FIXME: Find better solution
                        allocatedBeforeHiring: timesheetEmployees
                            .filter((employee) => {
                                const cells = timesheet
                                    .find((ts) => ts.personnelId === employee.id)
                                    .cells.map((cell) => {
                                        const calcCell = TimesheetCell.fromJson(cell.toJson());
                                        const plus1Day = new Date(cell.cellDate);
                                        plus1Day.setDate(plus1Day.getDate() + 1);
                                        calcCell.cellDate = plus1Day;
                                        return calcCell;
                                    });
                                return Boolean(
                                    cells.filter(
                                        (cell) => new Date(cell.cellDate) <= employee.hiredAt
                                    )?.length
                                );
                            })
                            .sort(sortCallback),
                        allocatedAfterFiring: timesheetEmployees
                            .filter((employee) => {
                                const cells = timesheet.find(
                                    (ts) => ts.personnelId === employee.id
                                ).cells;
                                return (
                                    employee.firedAt &&
                                    Boolean(
                                        cells.filter((cell) => cell.cellDate >= employee.firedAt)
                                            ?.length
                                    )
                                );
                            })
                            .sort(sortCallback)
                    };
                })
            )
            .subscribe((warningGroups) => {
                this.warningGroups$.next(warningGroups);
            });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.timesheet$.complete();
        this.office$.complete();
        this.warningGroups$.complete();
    }

    openWarningsDialog(warnings: WarningGroups): void {
        this.dialog.open(OfficeWarningsComponent, {
            autoFocus: false,
            width: '390px',
            data: warnings
        });
    }
}
