import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    OnDestroy,
    OnInit,
    Output
} from '@angular/core';
import { NgClass, AsyncPipe, DatePipe } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';

import { MatButtonModule } from '@angular/material/button';
import { OverlayModule } from '@angular/cdk/overlay';
import { switchMap, take, takeUntil } from 'rxjs/operators';
import { BehaviorSubject, combineLatest, Subject } from 'rxjs';
import { ALPHA_YEAR, DateRange, Direction, PickerState } from './month-range-picker.structures';

@Component({
    selector: 'app-month-range-picker',
    templateUrl: './month-range-picker.component.html',
    styleUrls: ['./month-range-picker.component.scss'],
    standalone: true,
    imports: [
        NgClass,
        AsyncPipe,
        DatePipe,
        MatFormFieldModule,
        MatInputModule,
        MatIconModule,
        MatButtonModule,
        OverlayModule
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonthRangePickerComponent implements OnInit, OnDestroy {
    @Input() label = '';

    @Input() set date(value: DateRange) {
        const startDate = value.start ?? new Date();
        const endDate = value.end ?? new Date();

        this.leftBorderYear = startDate.getFullYear();

        this.startDate$.next(startDate);
        this.endDate$.next(endDate);

        const yearsList = [];

        const currentYear = new Date().getFullYear();

        for (let year = startDate.getFullYear(); year <= currentYear + ALPHA_YEAR; year += 1) {
            yearsList.push(year);
        }

        this.yearsList = yearsList;
    }
    @Output() readonly dateChange = new EventEmitter<DateRange>();

    destroy$ = new Subject<void>();
    updateReady$ = new Subject<void>();
    currentStartDate$ = new BehaviorSubject<Date>(new Date());
    currentEndDate$ = new BehaviorSubject<Date>(new Date());
    endDate$ = new BehaviorSubject<Date>(
        new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    );
    startDate$ = new BehaviorSubject<Date>(
        new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    );
    showMonthMenu$ = new BehaviorSubject(false);

    monthsList = [...Array(12).keys()];
    yearsList = [];
    direction = Direction;
    state: PickerState;
    leftBorderYear = 2000;
    pickerState = PickerState;

    ngOnInit(): void {
        this.updateReady$
            .asObservable()
            .pipe(
                switchMap((_) =>
                    combineLatest([
                        this.startDate$.asObservable(),
                        this.endDate$.asObservable()
                    ]).pipe(take(1))
                ),
                takeUntil(this.destroy$)
            )
            .subscribe(([start, end]) => this.dateChange.emit({ start, end } as DateRange));
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.endDate$.complete();
        this.currentStartDate$.complete();
        this.currentEndDate$.complete();
        this.showMonthMenu$.complete();
        this.startDate$.complete();
        this.updateReady$.next();
        this.updateReady$.complete();
    }

    isStartMonthDisabled(startDate: Date, endDate: Date, month: number): boolean {
        return startDate.getFullYear() === endDate.getFullYear() && month > endDate.getMonth();
    }

    isEndMonthDisabled(startDate: Date, endDate: Date, month: number): boolean {
        return startDate.getFullYear() === endDate.getFullYear() && month < startDate.getMonth();
    }

    onToggleMonthMenuStart(show: boolean): void {
        this.showMonthMenu$.next(show);
        this.state = PickerState.startMonth;
    }

    onToggleMonthMenuEnd(show: boolean): void {
        this.showMonthMenu$.next(show);
        this.state = PickerState.endMonth;
    }

    onSelectYearStart(date: Date, year: number): void {
        const newDate = new Date(year, date.getMonth(), date.getDate());

        this.startDate$.next(newDate);
        this.currentStartDate$.next(newDate);
        this.state = PickerState.startMonth;
    }

    onSelectYearEnd(date: Date, year: number): void {
        const newDate = new Date(year, date.getMonth(), date.getDate());

        this.endDate$.next(newDate);
        this.currentEndDate$.next(newDate);
        this.state = PickerState.endMonth;
    }

    onSelectMonthStart(date: Date, month: number): void {
        const newDate = new Date(date.getFullYear(), month, date.getDate());
        this.startDate$.next(newDate);
        this.currentStartDate$.next(newDate);
        this.state = PickerState.endMonth;
    }

    onSelectMonthEnd(date: Date, month: number): void {
        const newDate = new Date(date.getFullYear(), month, date.getDate());
        this.endDate$.next(newDate);
        this.currentEndDate$.next(newDate);
        this.state = null;
        this.showMonthMenu$.next(false);
        this.updateReady$.next();
    }

    alterDate(date: Date, month: number): Date {
        const newDate = new Date(date);
        newDate.setMonth(month);
        return newDate;
    }

    rangeClickOutsideHandler(): void {
        this.showMonthMenu$.next(!this.showMonthMenu$);
        this.state = null;
    }
}
