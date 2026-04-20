import { Injectable } from '@angular/core';
import { isWeekend, parse } from 'date-fns/esm';
import * as ExcelJS from 'exceljs';
import { Worksheet } from 'exceljs';
import { saveAs } from 'file-saver';

@Injectable({
    providedIn: 'root'
})
export class ExcelService {
    constructor() {}
    generateDailyAllocationReport(rows: Map<string, string>[], fileName: string): void {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sheet 1', {
            views: [{ state: 'frozen', ySplit: 1, xSplit: 1 }]
        });

        const headers = [...rows[0].keys()];

        worksheet.columns = headers.map((h) => ({
            header: h.toUpperCase(),
            key: h.toLowerCase()
        }));

        rows.forEach((item) => {
            worksheet.addRow(Object.fromEntries(item.entries()));
        });

        worksheet.getColumn(1).fill = { pattern: 'lightGray', type: 'pattern' };
        worksheet.getRow(1).fill = { pattern: 'lightGray', type: 'pattern' };

        worksheet.columns.forEach((col) => {
            const value = col.values?.[1];

            if (!value || typeof value !== 'string') return;

            if (isWeekend(new Date(value))) {
                col.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFFB6C1' }
                };
            }
        });

        this.autoFitColumnWidth(worksheet);

        workbook.xlsx.writeBuffer().then((buffer) => {
            const blob = new Blob([buffer], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            saveAs(blob, `${fileName}.xlsx`);
        });
    }

    private autoFitColumnWidth(worksheet: Worksheet, minimalWidth = 5) {
        worksheet.columns.forEach((column) => {
            let maxColumnLength = 0;
            if (column && typeof column.eachCell === 'function') {
                column.eachCell({ includeEmpty: true }, (cell) => {
                    maxColumnLength = Math.max(
                        maxColumnLength,
                        minimalWidth,
                        cell.value ? cell.value.toString().length : 0
                    );
                });
                column.width = maxColumnLength + 2;
            }
        });
        return worksheet;
    }
}
