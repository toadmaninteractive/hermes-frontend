import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    OnDestroy,
    OnInit,
    Self,
    ViewChild
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatInput } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { AsyncPipe, TitleCasePipe, DatePipe } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { filter, map, switchMap, take, takeUntil, tap } from 'rxjs/operators';
import { BehaviorSubject, combineLatest, Observable, Subject } from 'rxjs';
import { HistoryEntry, Office } from '../../../protocol/db-protocol';
import { CacheService } from '../../../core/services/cache.service';
import { HermesHistoryService } from '../../../protocol/history-protocol.service';
import { HistoryEntryOrderBy } from '../../../protocol/web-protocol';
import { Collection, CollectionSlice, OrderDirection } from '../../../protocol/data-protocol';
import { SelectedDateService } from '../../../core/services/selected-date.service';
import { OfficeSelectorComponent } from '../../../components/office-selector/office-selector.component';
import { FilterService } from '../../../core/services/filter.service';

@Component({
    selector: 'app-role-history',
    templateUrl: './role-history.component.html',
    styleUrls: ['./role-history.component.scss'],
    standalone: true,
    imports: [
        MatInput,
        OfficeSelectorComponent,
        RouterLink,
        AsyncPipe,
        TitleCasePipe,
        DatePipe,
        MatToolbarModule,
        ReactiveFormsModule,
        MatIconModule,
        MatButtonModule,
        MatFormFieldModule
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [FilterService]
})
export class RoleHistoryComponent implements OnInit, OnDestroy {
    @ViewChild('filter') filter: ElementRef<HTMLInputElement>;
    destroy$ = new Subject<void>();
    office$ = new BehaviorSubject<Office>(null);
    entries$ = new BehaviorSubject<HistoryEntry[]>([]);
    filteredEntries$ = new BehaviorSubject<HistoryEntry[]>([]);

    filterControl = this.filterService.filterControl;
    private needle$ = this.filterService.needle$;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        public cacheService: CacheService,
        private historyService: HermesHistoryService,
        public selectedDateService: SelectedDateService,
        @Self()
        private filterService: FilterService
    ) {}

    ngOnInit(): void {
        this.needle$
            .pipe(
                switchMap(({ needle }) =>
                    this.entries$.pipe(
                        take(1),
                        map((records) =>
                            records.filter((record) => {
                                const isActorFits = record.actorName.toLowerCase().includes(needle);
                                let isAffectsFits = false;
                                let isRoleFits = false;
                                if (record.properties['affects']) {
                                    isAffectsFits = (record.properties['affects'] as Array<any>)
                                        .map((user) => user.name)
                                        .join(' ')
                                        .toLowerCase()
                                        .includes(needle);
                                }
                                if (record.properties['data']['role']) {
                                    isRoleFits = record.properties['data']['role']['title']
                                        .toLowerCase()
                                        .includes(needle);
                                }
                                return isActorFits || isAffectsFits || isRoleFits;
                            })
                        )
                    )
                ),
                takeUntil(this.destroy$)
            )
            .subscribe((filteredRecords) => {
                this.filteredEntries$.next(filteredRecords);
            });

        combineLatest([this.route.params, this.cacheService.offices$.asObservable()])
            .pipe(
                filter(([_, offices]) => Boolean(offices)),
                map(([params, offices]) => {
                    if (params.officeId !== 'all' && params.officeId !== 'unassigned') {
                        return offices.find((office) => office.id === Number(params.officeId));
                    }
                    return params.officeId as string;
                }),
                tap((office) => this.cacheService.selectedOffice$.next(office)),
                switchMap((office) => {
                    let result: Observable<any>;
                    if (office instanceof Office) {
                        result = this.historyService
                            .getEmployeeRoleChangeHistoryForOffice(office.id)
                            .pipe(take(1), takeUntil(this.destroy$));
                    } else if (office === 'all') {
                        result = this.historyService
                            .getHistory(
                                'user',
                                null,
                                HistoryEntryOrderBy.CreatedAt,
                                OrderDirection.Desc,
                                0,
                                10000
                            )
                            .pipe(take(1), takeUntil(this.destroy$));
                    } else if (office === 'unassigned') {
                        result = combineLatest([
                            this.historyService
                                .getHistory(
                                    'user',
                                    null,
                                    HistoryEntryOrderBy.CreatedAt,
                                    OrderDirection.Desc,
                                    0,
                                    10000
                                )
                                .pipe(take(1), takeUntil(this.destroy$)),
                            this.cacheService.employees$
                                .asObservable()
                                .pipe(filter((emp) => Boolean(emp)))
                        ]).pipe(
                            map(([historyEntries, employees]) => {
                                if (!historyEntries.items.length) {
                                    return [];
                                }
                                return historyEntries.items.filter((he) => {
                                    return he.properties['affects']
                                        ? Boolean(
                                              employees.find(
                                                  (emp) =>
                                                      emp.id === he.properties['affects'][0]['id']
                                              )?.officeId
                                          ) === false
                                        : false;
                                });
                            })
                        );
                    }
                    return result;
                }),

                map((collection) =>
                    collection instanceof CollectionSlice || collection instanceof Collection
                        ? collection.items
                        : collection
                ),
                map((entries: HistoryEntry[]) =>
                    entries.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
                ),
                takeUntil(this.destroy$)
            )
            .subscribe((res) => {
                this.entries$.next(res);
                this.filterControl.updateValueAndValidity();
            });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.entries$.complete();
        this.filteredEntries$.complete();
        this.office$.complete();
    }

    navigateTo(office: Office | string) {
        this.router.navigate([
            'employees',
            'office',
            office instanceof Office ? office.id : office,
            'history'
        ]);
    }
}
