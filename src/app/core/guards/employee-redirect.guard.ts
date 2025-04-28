import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { catchError, map } from 'rxjs/operators';
import { of } from 'rxjs';
import { HermesEmployeeService } from '../../protocol/web-employee-protocol.service';
import { PersonnelAccount } from '../../protocol/db-protocol';

export const employeeRedirectGuard: CanActivateFn = (route) => {
    const router = inject(Router);
    const hermesEmployeeService = inject(HermesEmployeeService);
    if (!route.paramMap.get('username')) {
        return router.createUrlTree(['/', 'error', '404']);
    }

    return hermesEmployeeService.getEmployeeByUsername(route.paramMap.get('username')).pipe(
        catchError(() => of(router.createUrlTree(['/', 'error', '404']))),

        map((employee) =>
            employee instanceof PersonnelAccount
                ? router.createUrlTree([
                      '/employees',
                      employee.username,
                      new Date().getFullYear(),
                      new Date().getMonth() + 1
                  ])
                : router.createUrlTree(['/', 'error', '404'])
        )
    );
};
