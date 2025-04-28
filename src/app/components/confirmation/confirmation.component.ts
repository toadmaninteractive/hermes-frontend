import { Component, ChangeDetectionStrategy, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { ConfirmationData } from './confirmation.model';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-confirmation',
    standalone: true,
    imports: [MatDialogModule, MatButtonModule],
    templateUrl: './confirmation.component.html',
    styleUrl: './confirmation.component.scss'
})
export class ConfirmDialogComponent {
    constructor(
        public dialogRef: MatDialogRef<ConfirmDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: ConfirmationData
    ) {}

    onConfirm(): void {
        this.dialogRef.close(true);
    }

    onCancel(): void {
        this.dialogRef.close(false);
    }
}
