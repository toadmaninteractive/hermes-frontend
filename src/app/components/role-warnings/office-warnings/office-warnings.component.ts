import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { MatIcon } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';
import { AsyncPipe } from '@angular/common';
import { SelectedDateService } from '../../../core/services/selected-date.service';
import { PersonnelAccount } from '../../../protocol/db-protocol';

interface WarningGroups {
    unassignedRoles: PersonnelAccount[];
    unavailableRoles: PersonnelAccount[];
    allocatedBeforeHiring: PersonnelAccount[];
    allocatedAfterFiring: PersonnelAccount[];
}

@Component({
    selector: 'app-office-warnings',
    templateUrl: './office-warnings.component.html',
    styleUrls: ['./office-warnings.component.scss'],
    standalone: true,
    imports: [MatIconButton, MatIcon, CdkScrollable, RouterLink, AsyncPipe, MatDialogModule],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class OfficeWarningsComponent {
    constructor(
        @Inject(MAT_DIALOG_DATA) public data: WarningGroups | null,
        public dialogRef: MatDialogRef<OfficeWarningsComponent>,
        public selectedDateService: SelectedDateService
    ) {}
}
