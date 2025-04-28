import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnDestroy,
    OnInit,
    Self,
    ViewChild
} from '@angular/core';
import { MatSort, SortDirection, MatSortHeader } from '@angular/material/sort';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import {
    MatTableDataSource,
    MatTable,
    MatColumnDef,
    MatHeaderCellDef,
    MatHeaderCell,
    MatCellDef,
    MatCell,
    MatHeaderRowDef,
    MatHeaderRow,
    MatRowDef,
    MatRow
} from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatTooltip } from '@angular/material/tooltip';
import { MatIcon } from '@angular/material/icon';
import { MatButtonModule, MatIconButton } from '@angular/material/button';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatInput } from '@angular/material/input';
import { MatFormField, MatSuffix } from '@angular/material/form-field';
import { AsyncPipe, DatePipe } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDividerModule } from '@angular/material/divider';
import { filter, map, switchMap, takeUntil, tap } from 'rxjs/operators';
import { BehaviorSubject, combineLatest, of, Subject } from 'rxjs';
import { compare } from '../../../shared/functions/compare';
import { repeat } from '../../../shared/functions/repeat';
import { PersonnelAccountOrderBy } from '../../../protocol/web-protocol';
import { OrderDirection } from '../../../protocol/data-protocol';
import { Office, PersonnelAccount, Role } from '../../../protocol/db-protocol';
import { HermesEmployeeService } from '../../../protocol/web-employee-protocol.service';
import { CacheService } from '../../../core/services/cache.service';
import { AccountService } from '../../../core/services/account.service';
import { SelectedDateService } from '../../../core/services/selected-date.service';
import { StorageService } from '../../../core/services/storage.service';
import { LoadingIndicatorComponent } from '../../../components/loading-indicator/loading-indicator.component';
import { RoleSelectorComponent } from '../../../components/role-selector/role-selector.component';
import { OfficeSelectorComponent } from '../../../components/office-selector/office-selector.component';
import { ScrollTopComponent } from '../../../components/scroll-top/scroll-top.component';
import { TooltipAutoHideDirective } from '../../../shared/directives/tooltip-auto-hide.directive';
import { FilterService } from '../../../core/services/filter.service';

enum Column {
    Id = 'id',
    Name = 'name',
    SupervisorName = 'supervisorName',
    JobTitle = 'jobTitle',
    RoleTitle = 'roleTitle',
    OfficeName = 'officeName',
    CreatedAt = 'createdAt',
    UpdatedAt = 'updatedAt'
}

interface CustomFilter {
    needle: string;
    showFired: boolean;
}

const DEFAULT_ORDER_BY = Column.Id;
const DEFAULT_ORDER_DIR: SortDirection = 'asc';
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_COLUMNS = [
    Column.Id,
    Column.Name,
    Column.SupervisorName,
    Column.OfficeName,
    Column.JobTitle,
    Column.RoleTitle,
    Column.UpdatedAt
];

@Component({
    selector: 'app-employees',
    templateUrl: './employees.component.html',
    styleUrls: ['./employees.component.scss'],
    standalone: true,
    imports: [
        MatFormField,
        MatInput,
        FormsModule,
        MatIconButton,
        MatSuffix,
        MatIcon,
        MatTooltip,
        RouterLink,
        MatCheckbox,
        OfficeSelectorComponent,
        RoleSelectorComponent,
        MatTable,
        MatSort,
        MatColumnDef,
        MatHeaderCellDef,
        MatHeaderCell,
        MatSortHeader,
        MatCellDef,
        MatCell,
        MatHeaderRowDef,
        MatHeaderRow,
        MatRowDef,
        MatRow,
        LoadingIndicatorComponent,
        MatPaginator,
        AsyncPipe,
        DatePipe,
        MatButtonModule,
        MatToolbarModule,
        MatDividerModule,
        ScrollTopComponent,
        TooltipAutoHideDirective,
        ReactiveFormsModule
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [FilterService]
})
export class EmployeesComponent implements OnInit, OnDestroy {
    @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator;
    @ViewChild(MatSort, { static: false }) sort: MatSort;
    destroy$ = new Subject<void>();
    date$ = new BehaviorSubject<Date>(new Date());
    loading$ = new BehaviorSubject<boolean>(false);
    employees$ = new BehaviorSubject<PersonnelAccount[]>(null);
    role$ = new BehaviorSubject<Role | 'all' | 'unassigned'>('all');
    refresh$ = new BehaviorSubject<boolean>(true);
    dataSource = new MatTableDataSource<PersonnelAccount, MatPaginator>();
    column = Column;
    displayedColumns = [...DEFAULT_COLUMNS];
    sortBy = DEFAULT_ORDER_BY;
    sortDir = DEFAULT_ORDER_DIR;
    pageSizes = [DEFAULT_PAGE_SIZE, 25, 50, 100];
    pageSize = DEFAULT_PAGE_SIZE;
    showFired = false;
    pageTag = 'employees';
    pageIndex = 0;

    filterControl = this.filterService.filterControl;
    needle$ = this.filterService.needle$;

    constructor(
        public accountService: AccountService,

        private hermesEmployeeService: HermesEmployeeService,
        public cacheService: CacheService,
        private selectedDateService: SelectedDateService,
        private storageService: StorageService,
        private cdr: ChangeDetectorRef,
        @Self()
        private filterService: FilterService
    ) {}

    ngOnInit(): void {
        this.initialize([]);

        this.needle$.pipe(takeUntil(this.destroy$)).subscribe(({ needle, profile }) => {
            this.setProps(profile.username, 'needle', needle);
            this.dataSource.filter = JSON.stringify({ needle, showFired: this.showFired });

            if (this.dataSource.paginator) {
                this.dataSource.paginator.firstPage();
            }
        });

        this.selectedDateService.selectedDate$
            .asObservable()
            .pipe(
                takeUntil(this.destroy$),
                filter((date) => Boolean(date))
            )
            .subscribe((date) => this.date$.next(date));

        combineLatest([
            this.accountService.profile$
                .asObservable()
                .pipe(filter((profile) => profile instanceof PersonnelAccount)),
            this.cacheService.offices$.asObservable().pipe(filter((offices) => Boolean(offices))),
            this.cacheService.roles$.asObservable().pipe(filter((roles) => Boolean(roles)))
        ])
            .pipe(takeUntil(this.destroy$))
            .subscribe(([profile, offices, roles]) => {
                const config =
                    JSON.parse(this.storageService.getStoredConfig(profile.username)) || {};

                this.showFired =
                    config[this.pageTag] && config[this.pageTag].firedChecked
                        ? config[this.pageTag].firedChecked === 'true'
                        : false;
                this.filterControl.patchValue(
                    config[this.pageTag] && config[this.pageTag].needle
                        ? config[this.pageTag].needle
                        : ''
                );
                // eslint-disable-next-line prefer-destructuring
                const role =
                    config[this.pageTag] && config[this.pageTag].role
                        ? config[this.pageTag].role
                        : false;
                if (role) {
                    if (role !== 'all' && role !== 'unassigned') {
                        this.role$.next(roles.find((r) => r.id === role));
                    } else {
                        this.role$.next(role);
                    }
                }

                if (config[this.pageTag]) {
                    const { sortBy } = config[this.pageTag];

                    const { sortDir } = config[this.pageTag];
                    if (sortBy && sortDir) {
                        this.sortBy = sortBy;
                        this.sortDir = sortDir;
                    }
                    const { pageIndex } = config[this.pageTag];

                    const { pageSize } = config[this.pageTag];
                    if (pageIndex && pageSize) {
                        this.pageIndex = pageIndex;
                        this.pageSize = pageSize;
                    }
                }

                let firstOffice;

                const officeFromStorage =
                    config[this.pageTag] && config[this.pageTag].office_id
                        ? config[this.pageTag].office_id
                        : false;
                if (officeFromStorage) {
                    if (officeFromStorage !== 'all' && officeFromStorage !== 'unassigned') {
                        firstOffice =
                            offices.filter((o) => o.id === officeFromStorage)[0] || offices[0];
                    } else {
                        firstOffice = officeFromStorage;
                    }
                } else {
                    firstOffice = offices.filter((o) => o.id === profile.officeId)[0] || offices[0];
                }
                this.cacheService.selectedOffice$.next(firstOffice);
            });

        combineLatest([
            this.cacheService.selectedOffice$.asObservable(),
            this.role$.asObservable(),
            this.refresh$.asObservable()
        ])
            .pipe(
                takeUntil(this.destroy$),
                filter(([office, __, _]) => Boolean(office)),
                tap((_) => this.loading$.next(true)),
                switchMap(([office, role, _]) => {
                    const isUnassigned = office === 'unassigned';

                    const employeesObservable =
                        office instanceof Office
                            ? this.hermesEmployeeService.getEmployeesByOffice(office.id).pipe(
                                  takeUntil(this.destroy$),
                                  map((employees) =>
                                      employees.items.sort((a, b) => (a.name > b.name ? 1 : -1))
                                  )
                              )
                            : this.hermesEmployeeService
                                  .getEmployees(
                                      null,
                                      PersonnelAccountOrderBy.Name,
                                      OrderDirection.Asc,
                                      0,
                                      10000
                                  )
                                  .pipe(
                                      takeUntil(this.destroy$),
                                      map((response) =>
                                          response.items.filter((employee) =>
                                              isUnassigned ? !employee.officeId : true
                                          )
                                      )
                                  );
                    return combineLatest([employeesObservable, of(role)]);
                }),
                map(([employees, role]) => {
                    if (role === 'all') {
                        return employees;
                    }
                    if (role === 'unassigned') {
                        return employees.filter((person) => person.roleId === null);
                    }
                    return employees.filter((person) => person.roleId === role.id);
                })
            )
            .subscribe((res) => {
                this.initialize(res);
                this.employees$.next(res);
                this.filterControl.updateValueAndValidity();
                this.loading$.next(false);
            });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.date$.complete();
        this.loading$.complete();
        this.employees$.complete();
        this.refresh$.complete();
        this.role$.complete();
    }

    onReload(): void {
        this.loading$.next(true);
        this.refresh$.next(true);
    }

    sortTable(sort: MatSort, username): void {
        const data = this.dataSource.data.slice();

        if (!sort.active || sort.direction === '') {
            this.dataSource.data = data;
            return;
        }

        this.dataSource.data = data.sort((a, b) => {
            const isAsc = sort.direction === 'asc';
            return compare(a[sort.active], b[sort.active], isAsc);
        });

        this.setProps(username, 'sortBy', this.sort.active);
        this.setProps(username, 'sortDir', this.sort.direction);

        setTimeout(() => this.cdr.detectChanges());
    }

    onRoleChange(value: Role | 'all' | 'unassigned'): void {
        this.role$.next(value);
    }

    refresh(): void {
        // FIXME: not a good approach to set both at once
        this.loading$.next(true);
        this.refresh$.next(true);
    }

    onFiredChecked(employees: PersonnelAccount[], username: string): void {
        this.dataSource.filter = JSON.stringify({
            needle: this.filterService.needle,
            showFired: this.showFired
        });
        this.setProps(username, 'firedChecked', `${this.showFired}`);
    }

    paginatorChanged(event: PageEvent, username: string): void {
        const config = JSON.parse(this.storageService.getStoredConfig(username)) || {};
        config[this.pageTag].pageIndex = event.pageIndex;
        config[this.pageTag].pageSize = event.pageSize;
        this.storageService.setStoredConfig(username, JSON.stringify(config));
    }

    setProps(username: string, key: string, value: string): void {
        const config = JSON.parse(this.storageService.getStoredConfig(username)) || {};

        if (!config[this.pageTag]) {
            config[this.pageTag] = {};
        }
        config[this.pageTag][key] = value;

        this.storageService.setStoredConfig(username, JSON.stringify(config));
    }

    private initialize(employees: PersonnelAccount[], setFirstPage = false): void {
        this.dataSource = new MatTableDataSource(employees);
        setTimeout(() => {
            if (this.sort) {
                this.dataSource.sort = this.sort;
            }
        });

        this.dataSource.filterPredicate = this.filter;
        this.dataSource.filter = JSON.stringify({
            needle: this.filterService.needle,
            showFired: this.showFired
        });

        if (this.paginator) {
            const { pageIndex } = this.paginator;
            this.dataSource.paginator = this.paginator;
            this.dataSource.paginator.firstPage();
            if (!setFirstPage) {
                setTimeout(() => repeat(pageIndex, () => this.dataSource.paginator.nextPage()), 0);
            }
        }
    }

    private filter(employee: PersonnelAccount, filterJson: string): boolean {
        const filterObj = JSON.parse(filterJson) as CustomFilter;
        // NOTE: .toLowerCase() and .trim() are probably redundant
        const trimmedNeedle = filterObj.needle.toLowerCase().trim();

        return (
            (filterObj.showFired ? true : !employee.isDeleted) &&
            (employee?.id.toString().includes(trimmedNeedle) ||
                employee.name?.toLowerCase().includes(trimmedNeedle) ||
                employee.username?.toLowerCase().includes(trimmedNeedle) ||
                employee.email?.toLowerCase().includes(trimmedNeedle) ||
                employee.jobTitle?.toLowerCase().includes(trimmedNeedle) ||
                employee.roleTitle?.toLowerCase().includes(trimmedNeedle))
        );
    }
}
