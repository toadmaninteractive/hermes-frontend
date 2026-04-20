import { Injectable } from '@angular/core';
import { isWeekend, parse } from 'date-fns/esm';
import * as ExcelJS from 'exceljs';
import { Worksheet } from 'exceljs';
import { saveAs } from 'file-saver';

@Injectable({
    providedIn: 'root'
})
export class ExcelService {
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

    generateAllocationSummaryReport(projects: string[], employeeAllocs: Map<string, string>[], title: string, fileName: string): void {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(title || 'Sheet 1', {
            views: [{ state: 'frozen', ySplit: 1, xSplit: 1 }]
        });

        // Define header columns
        const headers = ['Employee', ...projects];
        worksheet.columns = headers.map((h) => ({ header: h, key: h }));

        // Define rows
        employeeAllocs.forEach((item) => {
            worksheet.addRow(Object.fromEntries(item.entries()));
        });

        // Mark headers
        worksheet.getColumn(1).fill = { pattern: 'solid', type: 'pattern', fgColor: { argb: 'FFD3D3D3' } };
        worksheet.getRow(1).fill =  { pattern: 'solid', type: 'pattern', fgColor: { argb: 'FFD3D3D3' } };

        // Mark employees without projects
        worksheet
            .getRows(2, worksheet.rowCount - 1)
            .forEach((row, index) => {
                const cell = row.getCell(1);
                const allocs = [...employeeAllocs.at(index).values()].filter(v => v && v !== cell.text);

                if (allocs.length === 0) {
                    row.fill = { pattern: 'solid', type: 'pattern', fgColor: { argb: 'FFFA8072' } };
                }
            });

        // Size columns
        this.autoFitColumnWidth(worksheet);

        // Produce output
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
