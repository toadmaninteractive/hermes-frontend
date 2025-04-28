import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { ConfirmDialogComponent } from './confirmation.component';
import { ConfirmationConfig } from './confirmation.model';

@Injectable({
    providedIn: 'root'
})
export class ConfirmationService {
    constructor(private dialog: MatDialog) {}

    fire(config: ConfirmationConfig): Observable<boolean> {
        const dialogRef = this.dialog.open(ConfirmDialogComponent, {
            width: 'auto',
            ...(config ?? {})
        });

        return dialogRef.afterClosed();
    }
}
