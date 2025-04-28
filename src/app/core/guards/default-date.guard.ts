import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { SelectedDateService } from '../services/selected-date.service';

export const defaultDateGuard: CanActivateFn = (route) => {
    const selectedDateService = inject(SelectedDateService);
    const router = inject(Router);

    return selectedDateService.selectedDate$.asObservable().pipe(
        map((date) => {
            if (!route.queryParamMap.has('month') || !route.queryParamMap.has('year')) {
                const today = new Date();
                const path = route.pathFromRoot
                    .filter((v) => Boolean(v.url.length))
                    .map((v) => v.url.map((segment) => segment.toString()).join('/'))
                    .join('/')
                    .split('/');

                return router.createUrlTree(path, {
                    queryParams: {
                        year: date ? date.getFullYear() : today.getFullYear(),
                        month: date ? date.getMonth() + 1 : today.getMonth() + 1
                    },
                    queryParamsHandling: 'merge'
                });
            }
            return true;
        })
    );
};
