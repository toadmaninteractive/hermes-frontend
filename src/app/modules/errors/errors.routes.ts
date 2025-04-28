import { Routes } from '@angular/router';
import { Error1Component } from './error1/error1.component';
import { ErrorsComponent } from './errors.component';

export const ERRORS_ROUTES: Routes = [
    {
        path: '',
        component: ErrorsComponent,
        children: [
            {
                path: 'error-1',
                component: Error1Component
            },
            { path: '', redirectTo: 'error-1', pathMatch: 'full' },
            {
                path: '**',
                component: Error1Component,
                pathMatch: 'full'
            }
        ]
    }
];
