import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    OnInit,
    Output
} from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';
import { MatIcon } from '@angular/material/icon';
import { MatMenuTrigger, MatMenu, MatMenuItem } from '@angular/material/menu';
import { MatIconButton } from '@angular/material/button';

import { InlineSVGModule } from 'ng-inline-svg-2';
import { Office, Project, Team } from '../../../protocol/db-protocol';
import { Privileges } from '../../../shared/interfaces/privileges.interface';
import { TooltipAutoHideDirective } from '../../../shared/directives/tooltip-auto-hide.directive';

@Component({
    selector: 'app-table-menu',
    templateUrl: './table-menu.component.html',
    styleUrls: ['./table-menu.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatIconButton,
        MatMenuTrigger,
        MatIcon,
        MatMenu,
        MatMenuItem,
        MatTooltip,
        InlineSVGModule,
        TooltipAutoHideDirective
    ]
})
export class TableMenuComponent implements OnInit {
    @Input() entity: Office | Project | Team;
    @Input() isAllCellProtected: boolean;
    @Input() isAllCellUnprotected: boolean;
    @Input() linkToExcelReport = '';
    @Input() privileges: Privileges;
    @Input() synchronizing: boolean;

    @Output() readonly unprotect = new EventEmitter();
    @Output() readonly protect = new EventEmitter();
    @Output() readonly regenerate = new EventEmitter();
    @Output() readonly showTimesheetHistory = new EventEmitter();
    @Output() readonly generateAllocationSummary = new EventEmitter();
    @Output() readonly synchronize = new EventEmitter();
    @Output() readonly addEmployeeToProject = new EventEmitter();
    @Output() readonly addEmployeeToTeam = new EventEmitter();

    isOffice = false;
    isProject = false;
    isTeam = false;

    ngOnInit(): void {
        this.isOffice = this.entity instanceof Office;
        this.isProject = this.entity instanceof Project;
        this.isTeam = this.entity instanceof Team;
    }

    addEmployeeToProjectHandle(): void {
        this.addEmployeeToProject.emit();
    }

    addEmployeeToTeamHandle(): void {
        this.addEmployeeToTeam.emit();
    }

    unprotectTimesheetHandle(): void {
        this.unprotect.emit();
    }

    protectTimesheetHandle(): void {
        this.protect.emit();
    }

    regenerateHandle(): void {
        this.regenerate.emit();
    }

    showTimesheetHistoryHandle(): void {
        this.showTimesheetHistory.emit();
    }

    generateAllocationSummaryHandle(): void {
        this.generateAllocationSummary.emit();
    }

    synchronizeHandle(): void {
        this.synchronize.emit();
    }
}
