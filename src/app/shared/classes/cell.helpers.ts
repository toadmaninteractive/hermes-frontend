import { TimeOffKind } from '../../protocol/db-protocol';

export function isWeekend(date: Date): boolean {
    return date.getDay() === 6 || date.getDay() === 0;
}

export function timeOffDescription(timeOff: TimeOffKind): string {
    return TimeOffKind.getDescription(timeOff);
}
