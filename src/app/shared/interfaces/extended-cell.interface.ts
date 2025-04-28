import { TimesheetCell } from '../../protocol/db-protocol';

export interface ExtendedCell {
    cell: TimesheetCell;
    rowIndex: number;
    colIndex: number;
}
