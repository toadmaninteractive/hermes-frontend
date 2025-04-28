import { Injectable } from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { BehaviorSubject } from 'rxjs';
import { TimeOffKind } from '../../protocol/db-protocol';
import { ExtendedCell } from '../../shared/interfaces/extended-cell.interface';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class PseudoClipboardService {
    savedCells$ = new BehaviorSubject<Set<ExtendedCell>>(new Set());

    constructor(
        private storageService: StorageService,
        private clipboard: Clipboard
    ) {
        this.savedCells$.subscribe((res) => {
            this.cellConverter(res);

            this.storageService.setClipboardValue(
                Array.from(res)
                    .map((ec) => JSON.stringify(ec))
                    .join(',')
            );
        });
    }

    cellConverter(cells: Set<ExtendedCell>) {
        const sortedCells = Array.from(cells)
            .sort((a, b) => (a.colIndex < b.colIndex ? -1 : 1))
            .sort((a, b) => (a.rowIndex < b.rowIndex ? -1 : 1));
        const rowIndexes = Array.from(new Set(sortedCells.map((sc) => sc.rowIndex)));

        const result = rowIndexes
            .map((rowIndex) =>
                sortedCells
                    .filter((sc) => sc.rowIndex === rowIndex)
                    .map((ex) => this.getCellValue(ex))
                    .join('\t')
            )
            .join('\n');

        this.clipboard.copy(result);
    }

    getCellValue(cell: ExtendedCell): string {
        const timesheetCell = cell.cell;
        if (timesheetCell.projectName) {
            return timesheetCell.projectName;
        }
        if (timesheetCell.timeOff) {
            return TimeOffKind.toJsonKey(timesheetCell.timeOff) as string;
        }
        return '';
    }
}
