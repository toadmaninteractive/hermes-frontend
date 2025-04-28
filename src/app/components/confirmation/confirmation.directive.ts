import { Directive, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialogComponent } from './confirmation.component';
import { ConfirmationConfig } from './confirmation.model';

@Directive({
    selector: '[appConfirmConfig]',
    standalone: true
})
export class ConfirmationDirective {
    @Input('appConfirmConfig') props: ConfirmationConfig = {};
    @Output() readonly confirm = new EventEmitter<void>();
    @Output() readonly cancel = new EventEmitter<void>();

    constructor(private dialog: MatDialog) {}

    @HostListener('click', ['$event'])
    async onClick(event: MouseEvent): Promise<void> {
        const dialogRef = this.dialog.open(ConfirmDialogComponent, {
            width: 'auto',
            ...this.props
        });

        const result = await firstValueFrom(dialogRef.afterClosed());
        if (result) {
            this.confirm.emit();
        } else {
            this.cancel.emit();
        }
    }
}
