import { MatDialogConfig } from '@angular/material/dialog';

export interface ConfirmationData {
    title: string;
    html?: string;
    content?: string;
    confirmText?: string;
    cancelText?: string;
}

export type ConfirmationConfig = MatDialogConfig<ConfirmationData>;
