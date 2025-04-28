import { KeyValue, AsyncPipe, DatePipe, KeyValuePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatTooltip, MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { map, take, takeUntil } from 'rxjs/operators';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import {
    HistoryActor,
    HistoryEntry,
    HistoryOperation,
    Office,
    PersonnelAccount,
    Project,
    Team,
    TimesheetCell
} from '../../../protocol/db-protocol';
import { HermesHistoryService } from '../../../protocol/history-protocol.service';
import { CacheService } from '../../../core/services/cache.service';
import { getOperationDescription } from '../../../shared/functions/history-helpers';
import { Collection } from '../../../protocol/data-protocol';
import { SelectedDateService } from '../../../core/services/selected-date.service';
import { OverlayService } from '../../../core/services/overlay.service';
import { SortPipe } from '../../../shared/pipes/sort.pipe';
import { TooltipAutoHideDirective } from '../../../shared/directives/tooltip-auto-hide.directive';
import { ActionComponent } from './action/action.component';

export interface HistoryDialogData {
    entity: Team | Office | Project | Array<TimesheetCell>;
    date: Date;
}

@Component({
    selector: 'app-history-dialog',
    templateUrl: './history-dialog.component.html',
    styleUrls: ['./history-dialog.component.scss'],
    standalone: true,
    imports: [
        CdkScrollable,
        MatProgressSpinner,
        FormsModule,
        ActionComponent,
        AsyncPipe,
        DatePipe,
        KeyValuePipe,
        SortPipe,
        MatFormFieldModule,
        MatInputModule,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatTooltipModule,
        TooltipAutoHideDirective
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class HistoryDialogComponent implements OnInit, OnDestroy {
    destroy$ = new Subject<void>();
    isHistoryEmpty$ = new BehaviorSubject<boolean>(false);
    ready$ = new BehaviorSubject<boolean>(false);
    history$ = new BehaviorSubject<Map<string, HistoryEntry[]> | null>(null);
    historyDisplay$ = new BehaviorSubject<Map<string, HistoryEntry[]> | null>(null);
    needle = '';

    operation = HistoryOperation;
    actor = HistoryActor;

    constructor(
        public dialogRef: MatDialogRef<HistoryDialogComponent>,
        public cacheService: CacheService,
        private historyService: HermesHistoryService,
        private overlayService: OverlayService,
        public selectedDateService: SelectedDateService,
        @Inject(MAT_DIALOG_DATA) public data: HistoryDialogData
    ) {}

    ngOnInit(): void {
        let incomingDays = null;
        let incomingAffects = null;
        let request: Observable<Collection<HistoryEntry>>;

        if (this.data.entity instanceof Team) {
            request = this.historyService.getMonthlyTimesheetHistoryForTeam(
                this.data.date.getFullYear(),
                this.data.date.getMonth() + 1,
                this.data.entity.id
            );
        } else if (this.data.entity instanceof Project) {
            request = this.historyService.getMonthlyTimesheetHistoryForProject(
                this.data.date.getFullYear(),
                this.data.date.getMonth() + 1,
                this.data.entity.id
            );
        } else if (this.data.entity instanceof Office) {
            request = this.historyService.getMonthlyTimesheetHistoryForOffice(
                this.data.date.getFullYear(),
                this.data.date.getMonth() + 1,
                this.data.entity.id
            );
        } else if (this.data.entity instanceof Array) {
            request = this.historyService.getCustomTimesheetHistory(
                this.data.entity.map((cell) => cell.id)
            );
            incomingDays = this.data.entity.map((cell) => cell.cellDate.getDate());
            incomingAffects = this.data.entity.map((cell) => cell.personnelUsername);
        }

        request
            .pipe(
                takeUntil(this.destroy$),
                take(1),
                map((collection) => collection.items),
                map((value) => {
                    const groupedResult = {};

                    value.map((item) => {
                        const key = item.createdAt.toDateString();
                        if (incomingDays) {
                            item.properties['when'].days = item.properties['when'].days.filter(
                                (day) => incomingDays.includes(day)
                            );
                        }

                        if (incomingAffects) {
                            item.properties['affects'] = item.properties['affects'].filter(
                                (affected) => incomingAffects.includes(affected.username)
                            );
                        }

                        if (key in groupedResult) {
                            groupedResult[key].push(item);
                        } else {
                            groupedResult[key] = [];
                            groupedResult[key].push(item);
                        }
                    });

                    return new Map<string, HistoryEntry[]>(Object.entries(groupedResult));
                })
            )
            .subscribe((value) => {
                const isHistoryEmpty =
                    value.size === 0 ||
                    [...value.entries()].every((entry) => entry[1].length === 0);
                this.isHistoryEmpty$.next(isHistoryEmpty);
                this.historyDisplay$.next(value);
                this.history$.next(value);
                this.ready$.next(true);
            });

        this.overlayService.isDialogDisplayed$.next(true);
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.isHistoryEmpty$.complete();
        this.history$.complete();
        this.historyDisplay$.complete();
        this.ready$.complete();

        this.overlayService.isDialogDisplayed$.next(false);
    }

    sortByDate(
        prev: KeyValue<string, HistoryEntry[]>,
        next: KeyValue<string, HistoryEntry[]>
    ): number {
        return new Date(prev.key) < new Date(next.key) ? 1 : -1;
    }

    sortByTime(prev: HistoryEntry, next: HistoryEntry): number {
        return prev.createdAt > next.createdAt ? -1 : 1;
    }

    onFilter(needle: string, history: Map<string, HistoryEntry[]> | null): void {
        const filteredHistory = new Map();

        if (history) {
            if (needle !== '') {
                history.forEach((item, groupKey) => {
                    const filteredValue = history.get(groupKey).filter((hs) => {
                        const isAffectsFits = Boolean(
                            hs.properties['affects'].find((person) =>
                                person.name.toLowerCase().includes(needle)
                            )
                        );

                        const isActorFits = hs.actorName
                            .toLowerCase()
                            .includes(needle.toLowerCase());

                        const isDescriptionFits = getOperationDescription(hs.operation)
                            .toLowerCase()
                            .includes(needle.toLowerCase());

                        const isProjectTitleFits =
                            hs.operation !== HistoryOperation.Deallocate &&
                            hs.properties['data']?.project?.title
                                .toLowerCase()
                                .includes(needle.toLowerCase());

                        return (
                            isAffectsFits || isActorFits || isDescriptionFits || isProjectTitleFits
                        );
                    });

                    filteredHistory.set(groupKey, filteredValue);
                });

                this.historyDisplay$.next(filteredHistory);

                const isHistoryEmpty =
                    filteredHistory.size === 0 ||
                    [...filteredHistory.entries()].every((entry) => entry[1].length === 0);

                this.isHistoryEmpty$.next(isHistoryEmpty);
            } else {
                this.historyDisplay$.next(history);

                const isHistoryEmpty =
                    history.size === 0 ||
                    [...history.entries()].every((entry) => entry[1].length === 0);

                this.isHistoryEmpty$.next(isHistoryEmpty);
            }
        }
    }

    getAffected(userId: number, employees: PersonnelAccount[]): PersonnelAccount | null {
        return employees.find((user) => user.id === userId) || null;
    }

    getUserTooltip(userId: number, employees: PersonnelAccount[]): string | null {
        const employee = employees.find((user) => user.id === userId) || null;
        const employeeRole = employee.jobTitle || employee.roleTitle || 'Employee';

        return employee.officeName ? `${employeeRole} at ${employee.officeName}` : null;
    }
}
