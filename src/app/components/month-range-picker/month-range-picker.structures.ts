export const ALPHA_YEAR = 5;

export enum Direction {
    Left = -1,
    Right = 1
}

export interface DateRange {
    start: Date;
    end: Date;
}

export enum PickerState {
    startMonth,
    startYear,
    endMonth,
    endYear
}
