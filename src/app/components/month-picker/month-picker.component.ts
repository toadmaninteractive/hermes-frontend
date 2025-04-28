import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    OnDestroy,
    OnInit,
    Output
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AsyncPipe, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon, MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { filter, map, switchMap, take, takeUntil } from 'rxjs/operators';
import { BehaviorSubject, combineLatest, of, Subject } from 'rxjs';
import { Direction } from '../../shared/enums/direction.enum';
import { StorageService } from '../../core/services/storage.service';

@Component({
    selector: 'app-month-picker',
    templateUrl: './month-picker.component.html',
    styleUrls: ['./month-picker.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,

    imports: [
        AsyncPipe,
        DatePipe,
        MatIcon,
        MatButtonModule,
        MatIconModule,
        MatInputModule,
        MatFormFieldModule,
        MatMenuModule
    ]
})
export class MonthPickerComponent implements OnInit, OnDestroy {
    @Input() set keysDirection(value: Direction | null) {
        if (value) {
            this.onChangeMonth(value);
        }
    }

    @Input() set date(value: unknown) {
        if (value instanceof Date) {
            this.selectedDate$.next(value);
            this.currentDate$.next(value);
        }
    }

    @Input() username: string;
    @Input() section: string;

    @Output() readonly dateChange = new EventEmitter<Date>();

    destroy$ = new Subject<void>();
    direction$ = new Subject<Direction>();
    selectedDate$ = new BehaviorSubject<Date>(
        new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    );
    currentDate$ = new BehaviorSubject<Date>(new Date());
    showMonthMenu$ = new BehaviorSubject(false);
    range = [...Array(12).keys()];
    direction = Direction;
    today = new Date();

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private storageService: StorageService
    ) {}

    ngOnInit(): void {
        this.route.paramMap
            .pipe(
                filter((paramMap) => paramMap.has('year') && paramMap.has('month')),
                map((paramMap) => [paramMap.get('year'), paramMap.get('month')]),
                takeUntil(this.destroy$)
            )
            .subscribe(([year, month]) => {
                const newDate = new Date(Number(year), Number(month) - 1, 1, 12);
                this.selectedDate$.next(newDate);
                this.dateChange.emit(newDate);
            });

        this.direction$
            .asObservable()
            .pipe(
                switchMap((direction) =>
                    combineLatest([of(direction), this.selectedDate$.asObservable()]).pipe(take(1))
                ),
                takeUntil(this.destroy$)
            )
            .subscribe(([direction, date]) => {
                const dateCopy = new Date(date);
                dateCopy.setMonth(date.getMonth() + direction);

                const prevYear = date.getFullYear().toString();
                const prevMonth = (date.getMonth() + 1).toString();

                const nextYear = dateCopy.getFullYear().toString();
                const nextMonth = (dateCopy.getMonth() + 1).toString();

                let changedUrl = this.replaceFullValue(this.router.url, prevYear, nextYear);
                changedUrl = this.replaceFullValue(changedUrl, prevMonth, nextMonth);
                this.router.navigateByUrl(changedUrl);
            });

        this.selectedDate$
            .asObservable()
            .pipe(takeUntil(this.destroy$))
            .subscribe((date) => {
                if (this.username && this.section) {
                    const config =
                        JSON.parse(this.storageService.getStoredConfig(this.username)) || {};
                    if (!config[this.section]) {
                        config[this.section] = {};
                    }
                    config[this.section]['date'] = date.getTime();
                    this.storageService.setStoredConfig(this.username, JSON.stringify(config));
                }
            });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.selectedDate$.complete();
        this.currentDate$.complete();
        this.direction$.complete();
        this.showMonthMenu$.complete();
    }

    onToggleMonthMenu(show: boolean): void {
        this.showMonthMenu$.next(show);
    }

    onChangeMonth(direction: Direction): void {
        this.direction$.next(direction);
    }

    onSelectMonth(date: Date, month: number): void {
        const dateCopy = new Date(date.getFullYear(), month, date.getDate());

        const prevYear = date.getFullYear().toString();
        const prevMonth = (date.getMonth() + 1).toString();

        const nextYear = dateCopy.getFullYear().toString();
        const nextMonth = (dateCopy.getMonth() + 1).toString();

        let changedUrl = this.replaceFullValue(this.router.url, prevYear, nextYear);
        changedUrl = this.replaceFullValue(changedUrl, prevMonth, nextMonth);
        this.showMonthMenu$.next(false);
        this.router.navigateByUrl(changedUrl);
    }

    alterDate(date: Date, month: number): Date {
        const newDate = new Date(date);
        newDate.setMonth(month);
        return newDate;
    }

    replaceFullValue(url: string, search: string, replace: string): string {
        const urlParts = url.split('/');
        const searchIndex = urlParts.findIndex((part) => part === search);
        if (searchIndex) {
            urlParts.splice(searchIndex, 1, replace);
        }
        return urlParts.join('/');
    }
}
