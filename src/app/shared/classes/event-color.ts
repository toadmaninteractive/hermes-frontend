import { EventColor } from 'calendar-utils';

export class Color implements EventColor {
    secondary: string = null;
    primary: string;

    constructor(primary: string) {
        this.primary = primary;
    }
}
