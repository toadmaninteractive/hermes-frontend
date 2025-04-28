import { TimeOffKind } from '../../protocol/db-protocol';

export function hexToRgbA(hex: string, alpha = 1): string {
    if (!hex) {
        return `rgba(204, 204, 204, 1)`;
    }
    const [r, g, b] = hex.match(/\w\w/g).map((x) => parseInt(x, 16));
    return `rgba(${r},${g},${b},${alpha})`;
}

export function timeOffColor(value: TimeOffKind, alpha: number = 1): string {
    switch (value) {
        case TimeOffKind.Absence:
        case TimeOffKind.TimeOff:
        case TimeOffKind.Travel:
            return hexToRgbA('#D5A6BD', alpha);
        case TimeOffKind.Sick:
        case TimeOffKind.UnpaidSick:
        case TimeOffKind.Vab:
            return hexToRgbA('#D5A6BD', alpha);
        case TimeOffKind.Holiday:
            return hexToRgbA('#D5A6BD', alpha);
        case TimeOffKind.Vacation:
        case TimeOffKind.PaidVacation:
        case TimeOffKind.UnpaidVacation:
            return hexToRgbA('#D5A6BD', alpha);
        case TimeOffKind.TempLeave:
        case TimeOffKind.MaternityLeave:
        case TimeOffKind.ParentalLeave:
            return hexToRgbA('#D5A6BD', alpha);
        default:
            return hexToRgbA('#D5A6BD', alpha);
    }
}
