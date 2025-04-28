import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { PersonnelAccount } from 'src/app/protocol/db-protocol';
import { Constants } from '../../shared/constants/constants';
import { AccountService } from '../services/account.service';

export const superadminGuard: CanActivateFn = (route) => {
    const accountService = inject(AccountService);
    const router = inject(Router);
    return accountService.profile$.pipe(
        filter((profile) => profile instanceof PersonnelAccount),
        map((profile) => (profile.isSuperadmin ? true : router.parseUrl(Constants.defaultUrl)))
    );
};
