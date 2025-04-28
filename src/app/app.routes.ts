import { Routes } from '@angular/router';
import { notAuthorizedGuard } from './core/guards/not-authorized.guard';
import { authorizedGuard } from './core/guards/authorized.guard';

export const ROUTES: Routes = [
    {
        title: 'Hermes | Error',
        path: 'error',
        loadChildren: () => import('./modules/errors/errors.routes').then((m) => m.ERRORS_ROUTES)
    },
    {
        title: 'Hermes | Auth',
        path: 'auth',
        canActivate: [notAuthorizedGuard],
        loadChildren: () => import('./modules/auth/auth.routes').then((m) => m.AUTH_ROUTES)
    },
    {
        path: '',
        canActivate: [authorizedGuard],
        loadChildren: () => import('./pages/pages.routes').then((m) => m.PAGES_ROUTES)
    },
    { path: '**', redirectTo: 'error/404' }
];
