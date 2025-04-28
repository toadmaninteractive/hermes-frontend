import { ChangeDetectionStrategy, Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { KeyValue, AsyncPipe, DatePipe, KeyValuePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { MatIcon, MatIconModule } from '@angular/material/icon';
import { MatButtonModule, MatIconButton } from '@angular/material/button';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { map, take, takeUntil, tap } from 'rxjs/operators';
import { BehaviorSubject, Subject } from 'rxjs';
import { CacheService } from '../../../core/services/cache.service';
import { HermesHistoryService } from '../../../protocol/history-protocol.service';
import { HistoryEntry } from '../../../protocol/db-protocol';
import { SelectedDateService } from '../../../core/services/selected-date.service';

@Component({
    selector: 'app-employee-history-dialog',
    templateUrl: './employee-history.component.html',
    styleUrls: ['./employee-history.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatProgressSpinner,
        RouterLink,
        AsyncPipe,
        DatePipe,
        KeyValuePipe,
        MatDialogModule,
        MatButtonModule,
        MatIconModule
    ]
})
export class HistoryEmployeeDialogComponent implements OnInit, OnDestroy {
    destroy$ = new Subject<void>();
    ready$ = new BehaviorSubject<boolean>(false);
    history$ = new BehaviorSubject<Map<string, HistoryEntry[]> | null>(null);
    isHistoryEmpty$ = new BehaviorSubject<boolean>(false);

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: number,
        private cacheService: CacheService,
        private historyService: HermesHistoryService,
        public dialogRef: MatDialogRef<HistoryEmployeeDialogComponent>,
        public selectedDateService: SelectedDateService
    ) {}

    ngOnInit(): void {
        this.historyService
            .getEmployeeRoleChangeHistory(this.data)
            .pipe(
                take(1),
                takeUntil(this.destroy$),
                map((collection) => collection.items),
                map((value) => {
                    const groupedResult = value.reduce((result, item) => {
                        const key = item.createdAt.toDateString();

                        result[key] = result[key] || [];
                        result[key].push(item);

                        return result as HistoryEntry;
                    }, {});

                    Object.keys(groupedResult).forEach((key) => {
                        groupedResult[key].sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
                    });

                    return new Map(Object.entries(groupedResult));
                }),
                tap(() => this.ready$.next(true))
            )
            .subscribe((history: Map<string, HistoryEntry[]>) => {
                const isHistoryEmpty =
                    history.size === 0 ||
                    [...history.entries()].every((entry) => entry[1].length === 0);
                this.history$.next(history);
                this.isHistoryEmpty$.next(isHistoryEmpty);
            });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.ready$.complete();
        this.history$.complete();
        this.isHistoryEmpty$.complete();
    }

    sortByDate(
        prev: KeyValue<string, HistoryEntry[]>,
        next: KeyValue<string, HistoryEntry[]>
    ): number {
        return new Date(prev.key) < new Date(next.key) ? 1 : -1;
    }
}
