import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { tap } from 'rxjs/operators';
import { AccountService } from '../services/account.service';
import { StorageService } from '../services/storage.service';

export const authorizedGuard: CanActivateFn = (route, state) => {
    const accountService = inject(AccountService);
    const router = inject(Router);
    const storageService = inject(StorageService);
    return accountService.isSignedIn().pipe(
        tap((signedIn: boolean) => {
            if (!signedIn) {
                if (!state.url.startsWith('/auth')) {
                    storageService.setStoredRoute(state.url);
                }

                router.navigate(['/auth']);
            }
        })
    );
};
