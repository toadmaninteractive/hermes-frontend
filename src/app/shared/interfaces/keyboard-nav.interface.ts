import { Direction } from '../enums/direction.enum';

export interface KeyboardNav {
    direction: Direction;
    isShiftPressed: boolean;
}
