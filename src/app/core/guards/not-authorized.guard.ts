import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { map, tap } from 'rxjs/operators';
import { AccountService } from '../services/account.service';

export const notAuthorizedGuard: CanActivateFn = (route) => {
    const accountService = inject(AccountService);
    const router = inject(Router);
    return accountService.isSignedIn().pipe(
        tap((signedIn: boolean) => {
            return signedIn && router.navigate(['/']);
        }),
        map((signedIn: boolean) => !signedIn) // Inverse signed in flag
    );
};
