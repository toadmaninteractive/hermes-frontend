import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatIconButton, MatButton } from '@angular/material/button';

import { FormsModule } from '@angular/forms';
import { MatInput } from '@angular/material/input';
import { MatFormField, MatLabel, MatSuffix } from '@angular/material/form-field';
import { Subject } from 'rxjs';
import { OneInputDialogData } from '../../shared/interfaces/dialog-data.interface';

@Component({
    templateUrl: 'one-input-dialog.component.html',
    styleUrls: ['one-input-dialog.component.scss'],
    standalone: true,
    imports: [
        MatFormField,
        MatLabel,
        MatInput,
        FormsModule,
        MatIconButton,
        MatSuffix,
        MatIcon,
        MatButton,
        MatDialogModule
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class OneInputDialogComponent {
    destroy$ = new Subject<void>();

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: OneInputDialogData,
        public dialogRef: MatDialogRef<OneInputDialogComponent>
    ) {}

    clearInput() {
        this.data = { ...this.data, input: '' };
    }

    closeDialog(value: string | null): void {
        this.dialogRef.close(value);
    }
}
