import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatInputModule } from '@angular/material/input';
import { NgTemplateOutlet, AsyncPipe, SlicePipe, DatePipe, KeyValuePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDividerModule } from '@angular/material/divider';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { debounceTime, filter, map, switchMap, take, takeUntil, tap } from 'rxjs/operators';
import { BehaviorSubject, combineLatest, of, Subject } from 'rxjs';
import { CacheService } from '../../../core/services/cache.service';
import { PersonnelAccount, Role } from '../../../protocol/db-protocol';
import { HermesReportService } from '../../../protocol/report-protocol.service';

import { fadeAnimation } from '../../../shared/interfaces/animations';
import { DeliveryData, DeliveryLogs, FilterType } from './logs.structures';

@Component({
    selector: 'app-logs',
    templateUrl: 'logs.component.html',
    styleUrls: ['logs.component.scss'],
    standalone: true,
    imports: [
        NgTemplateOutlet,
        AsyncPipe,
        SlicePipe,
        DatePipe,
        KeyValuePipe,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatToolbarModule,
        MatDividerModule,
        MatButtonToggleModule
    ],
    animations: [fadeAnimation],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class LogsComponent implements OnInit, OnDestroy {
    destroy$ = new Subject<void>();
    activeType$ = new BehaviorSubject<FilterType>(FilterType.All);
    data$ = new BehaviorSubject<DeliveryData | null>(null);
    errorLogs$ = new BehaviorSubject<Map<string, string[]>>(new Map());
    filteredLogs$ = new BehaviorSubject<DeliveryLogs[]>([]);
    filterString$ = new BehaviorSubject<string>('');
    logs$ = new BehaviorSubject<DeliveryLogs[]>([]);
    officeName$ = new BehaviorSubject<string>('');
    reportDate$ = new BehaviorSubject<Date>(new Date());
    omittedIds$ = new BehaviorSubject<Set<number>>(new Set());
    omittedEmployees$ = new BehaviorSubject<PersonnelAccount[]>([]);

    numberSuccess = 0;
    numberErrors = 0;
    numberIgnored = 0;

    array = Array;
    showFullList = false;
    FilterType = FilterType;

    constructor(
        private cacheService: CacheService,
        private route: ActivatedRoute,
        public reportService: HermesReportService
    ) {}

    ngOnInit(): void {
        this.route.params
            .pipe(
                takeUntil(this.destroy$),
                map((params) => Number(params.id)),
                switchMap((reportsId) => this.reportService.getVismaReport(reportsId)),
                tap((report) => this.officeName$.next(report.officeName)),
                tap((report) => this.reportDate$.next(new Date(report.year, report.month - 1, 1))),
                tap((report) => this.omittedIds$.next(new Set(report.omitIds))),
                map((report) => report?.deliveryData as any as DeliveryData),
                tap((data) => {
                    this.numberErrors = Number(
                        data?.logs?.filter((log) => !log.success)?.length || 0
                    );
                    this.numberSuccess = Number(
                        data?.logs?.filter((log) => log.success)?.length || 0
                    );
                    this.numberIgnored = Number(data?.stats?.total_ignored || 0);
                })
            )
            .subscribe((data) => {
                this.filteredLogs$.next(data?.logs || []);
                this.logs$.next(data?.logs || []);
                this.data$.next(data);
            });

        combineLatest(this.cacheService.employees$.asObservable(), this.omittedIds$.asObservable())
            .pipe(
                takeUntil(this.destroy$),
                filter(([employees, omitted]) => Boolean(employees) && Boolean(employees.length)),
                map(([employees, omitted]) =>
                    employees.filter((employee) => omitted.has(employee.id))
                )
            )
            .subscribe((employees) => this.omittedEmployees$.next(employees));

        combineLatest([
            this.activeType$.asObservable(),
            this.filterString$.asObservable(),
            this.logs$.asObservable()
        ])
            .pipe(
                takeUntil(this.destroy$),
                debounceTime(250),
                map(([activeType, filterString, logs]) => {
                    let filteredLogs: DeliveryLogs[] = [];
                    switch (activeType) {
                        case FilterType.Success:
                            filteredLogs = logs.filter((log) => Boolean(log.success));
                            break;
                        case FilterType.Error:
                            filteredLogs = logs.filter((log) => !log.success && log.errors.length);
                            break;
                        case FilterType.Ignored:
                            filteredLogs = logs.filter((log) => !log.success && !log.errors.length);
                            break;
                        case FilterType.All:
                            filteredLogs = logs;
                            break;
                        default:
                            filteredLogs = logs;
                            break;
                    }

                    filteredLogs = filteredLogs.filter(
                        (log) =>
                            log.message.toLowerCase().includes(filterString.toLowerCase().trim()) ||
                            ('errors' in log &&
                                log?.errors.join(' ').toLowerCase().includes(filterString))
                    );
                    return filteredLogs;
                })
            )
            .subscribe((filteredLogs) => {
                this.filteredLogs$.next(filteredLogs);
            });

        this.logs$
            .asObservable()
            .pipe(
                takeUntil(this.destroy$),
                switchMap((logs) => {
                    const roles$ = this.cacheService.roles$.pipe(take(1));
                    return combineLatest([roles$, of(logs)]);
                }),
                map(([roles, logs]) => {
                    const errorsGroupMap = new Map();
                    const handleLogMessage = this.getHandleFunction(roles);
                    return logs
                        .filter((log) => !log.success)
                        .sort()
                        .reduce((result, errorsLog) => {
                            const key = this.createKey(errorsLog.message);
                            const newMessage = handleLogMessage(errorsLog.message);

                            if (result.has(key)) {
                                const lastGroup = result.get(key);
                                lastGroup.push(newMessage);
                                result.set(key, lastGroup);
                            } else {
                                result.set(key, [newMessage]);
                            }
                            return result;
                        }, errorsGroupMap);
                })
            )
            .subscribe((errors: Map<string, string[]>) => {
                this.errorLogs$.next(errors);
            });
    }

    ngOnDestroy(): void {
        this.activeType$.complete();
        this.data$.complete();
        this.destroy$.next();
        this.destroy$.complete();
        this.errorLogs$.complete();
        this.filteredLogs$.complete();
        this.filterString$.complete();
        this.logs$.complete();
        this.officeName$.complete();
        this.reportDate$.complete();
    }

    getHandleFunction(roles: Role[]): (string) => string {
        return (message: string): string => {
            if (message.includes('Could not create time card for visma employee')) {
                const v1 = message.replace(/\sand\syear.+/, '');
                const roleCode = this.searchRoleCode(v1, /00\d{3}/);
                const roleName = this.getRoleNameByCode(roleCode, roles);
                return `Role <strong>${roleName} [${roleCode}]</strong> is not registered in visma`;
            }
            if (message.includes('Could not create a time card in visma for week')) {
                return message.replace(/\sfor.*/, '');
            }
            if (message.includes('It looks like the time card')) {
                const code = message.match(/00\d*/);
                return `Time card <strong>${code}</strong> has been deleted`;
            }
            if (message.includes('Tried fetching time card with id:')) {
                const code = message.match(/00\d*/);
                return `Failed to load time card <strong>${code}</strong>`;
            }
            return message;
        };
    }

    createKey(key: string): string {
        return (
            key
                // Could not create time card for visma employee
                .replace(/\sand\syear.+/, '')
                // Could not create a time card in visma for week
                .replace(/\sweek.*/, '')
        );
    }

    searchRoleCode(target: string, pattern: RegExp): string | null {
        const matchResult = target.match(pattern);
        return matchResult ? matchResult[0] : null;
    }

    getRoleNameByCode(code: string | null, roles: Role[]): string | null {
        return code ? roles.find((role) => role.code === code).title : null;
    }

    onTypeChange(filterType: FilterType): void {
        this.activeType$.next(filterType);
    }

    onFilterChange(filterString: string): void {
        const trimmedNeedle = filterString.toLowerCase().trim();
        this.filterString$.next(trimmedNeedle);
    }

    switchShowMode(): void {
        this.showFullList = !this.showFullList;
    }
}
