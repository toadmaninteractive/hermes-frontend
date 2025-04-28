import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { combineLatest } from 'rxjs';
import { SelectedDateService } from '../services/selected-date.service';
import { CacheService } from '../services/cache.service';
import { simplifyTitle } from '../../shared/functions/simplify-title';
import { AccountService } from '../services/account.service';
import { StorageService } from '../services/storage.service';

export const reportRedirectGuard: CanActivateFn = (route) => {
    const router = inject(Router);
    const accountService = inject(AccountService);
    const storageService = inject(StorageService);
    const selectedDateService = inject(SelectedDateService);
    const cacheService = inject(CacheService);

    return combineLatest([
        accountService.profile$.asObservable(),
        cacheService.selectedOffice$.asObservable(),
        selectedDateService.selectedDate$.asObservable(),
        cacheService.offices$.asObservable()
    ]).pipe(
        filter(([profile, office, date, offices]) => offices && offices.length > 0),
        map(([profile, office, date, offices]) => {
            if (
                !route.paramMap.has('month') ||
                !route.paramMap.has('year') ||
                !route.paramMap.has('officeName')
            ) {
                const today = new Date();
                const config = JSON.parse(storageService.getStoredConfig(profile.username));
                let officeFromStorage;
                if (config && config['reports'] && config['reports']['office_id']) {
                    officeFromStorage = config['reports']['office_id'];
                } else {
                    officeFromStorage = false;
                }

                let firstOffice;
                if (officeFromStorage) {
                    firstOffice =
                        offices.filter((o) => o.id === officeFromStorage)[0] || offices[0];
                } else {
                    firstOffice = offices.filter((o) => o.id === profile.officeId)[0] || offices[0];
                }

                const dateFromStorage =
                    config['reports'] && config['reports']['date']
                        ? config['reports']['date']
                        : false;

                date = dateFromStorage ? new Date(dateFromStorage) : date;

                return router.createUrlTree(
                    [
                        '/',
                        'reports',
                        // @ts-expect-error -- FIXME: types
                        simplifyTitle(firstOffice.name || office.name),
                        date ? date.getFullYear() : today.getFullYear(),
                        date ? date.getMonth() + 1 : today.getMonth() + 1
                    ],
                    {}
                );
            }
            return true;
        })
    );
};
