import { Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import {
    BadRequestError,
    ForbiddenError,
    InternalServerError,
    NotFoundError
} from '../../protocol/data-protocol';

export enum NotificationType {
    Success = 1,
    Info = 2,
    Warning = 3,
    Error = 4
}

@Injectable({
    providedIn: 'root'
})
export class NotificationService {
    constructor(private toastr: ToastrService) {}

    error(
        message:
            | string
            | BadRequestError<any>
            | ForbiddenError
            | NotFoundError
            | InternalServerError
    ): void {
        let actualMessage = this.sanitize(message);

        if (message instanceof BadRequestError) {
            actualMessage = `Server cannot process your request. Reason: ${message.error}`;
        } else if (message instanceof ForbiddenError) {
            actualMessage = `You are not authorized to perform requested action`;
        } else if (message instanceof NotFoundError) {
            actualMessage = `Requested object does not exist on the server side`;
        } else if (message instanceof InternalServerError) {
            actualMessage = `Internal server error. Reason: ${message.error}. Please contact developer team.`;
        }

        setTimeout(() => this.toastr.error(actualMessage, null));
    }

    warning(message: string): void {
        setTimeout(() => this.toastr.warning(this.sanitize(message), null));
    }

    info(message: string, title?: string): void {
        setTimeout(() => this.toastr.info(this.sanitize(message) || null, title || null));
    }

    success(message?: string, title?: string): void {
        setTimeout(() => this.toastr.success(this.sanitize(message) || null, title || null));
    }

    private sanitize(message: unknown): string {
        return typeof message === 'string' ? message : JSON.stringify(message);
    }
}
