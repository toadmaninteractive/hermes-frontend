import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { NgTemplateOutlet, AsyncPipe, SlicePipe } from '@angular/common';
import {
    HistoryEntry,
    HistoryOperation,
    PersonnelAccount,
    TimeOffKind
} from '../../../../protocol/db-protocol';
import { HistoryEntryDate } from '../../../../shared/interfaces/history-entry-date.interface';
import { getOperationDescription } from '../../../../shared/functions/history-helpers';
import { SelectedDateService } from '../../../../core/services/selected-date.service';
import { simplifyTitle } from '../../../../shared/functions/simplify-title';
import { fadeAnimation } from '../../../../shared/interfaces/animations';
import { TooltipAutoHideDirective } from '../../../../shared/directives/tooltip-auto-hide.directive';

interface DateRange {
    from: number | null;
    to: number | null;
}

@Component({
    selector: 'app-hermes-action',
    templateUrl: './action.component.html',
    styleUrls: ['./action.component.scss', './../history-dialog.component.scss'],
    animations: [fadeAnimation],
    standalone: true,
    imports: [
        NgTemplateOutlet,
        RouterLink,
        MatTooltip,
        AsyncPipe,
        SlicePipe,
        TooltipAutoHideDirective
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActionComponent {
    @Input() data: HistoryEntry;
    @Input() employees: PersonnelAccount[];
    showFullList = false;
    getOperationDescription = getOperationDescription;

    operation = HistoryOperation;
    timeOffKind = TimeOffKind;

    constructor(public selectedDateService: SelectedDateService) {}

    dateToString(when: HistoryEntryDate): string {
        const monthName = new Date(when.year, when.month - 1, 1).toLocaleString('en-us', {
            month: 'short'
        });
        return `${monthName} ${this.rangeToString(when.days)}`;
    }

    getAffected(userId: number): PersonnelAccount | null {
        return this.employees.find((user) => user.id === userId) || null;
    }

    switchShowMode(): void {
        this.showFullList = !this.showFullList;
    }

    findSubRanges(arr: number[]): DateRange[] {
        const result = [];
        const tmpRange = { from: null, to: null } as DateRange;
        arr.forEach((elem, index) => {
            if (!tmpRange.from) {
                tmpRange.from = elem;
            }
            if (arr[index - 1] && elem > arr[index - 1] + 1) {
                result.push({ ...tmpRange });
                tmpRange.from = elem;
                tmpRange.to = null;
            } else {
                tmpRange.to = elem;
            }

            if (index === arr.length - 1) {
                result.push({ ...tmpRange });
                return;
            }
        });
        return result;
    }

    rangeToString(dates: number[]): string {
        const dateRanges = this.findSubRanges(dates);
        return dateRanges
            .map((dateRange) => {
                if (!dateRange.to || dateRange.from === dateRange.to) {
                    return String(dateRange.from);
                }
                return dateRange.from + '–' + dateRange.to;
            })
            .join(', ');
    }

    getUserTooltip(userId: number): string | null {
        const employee = this.employees.find((user) => user.id === userId) || null;
        const employeeRole = employee.jobTitle || employee.roleTitle || 'Employee';
        return employee.officeName ? `${employeeRole} at ${employee.officeName}` : null;
    }

    getSimpleTitle(title: string): string {
        return simplifyTitle(title);
    }
}
