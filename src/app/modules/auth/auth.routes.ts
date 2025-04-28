import { Routes } from '@angular/router';
import { AuthComponent } from './auth.component';
import { LoginComponent } from './login/login.component';
import { LogoutComponent } from './logout/logout.component';

export const AUTH_ROUTES: Routes = [
    {
        path: '',
        component: AuthComponent,
        children: [
            {
                path: '',
                redirectTo: 'login',
                pathMatch: 'full'
            },
            {
                path: 'login',
                component: LoginComponent,
                data: { returnUrl: window.location.pathname }
            },
            {
                path: 'logout',
                component: LogoutComponent
            },
            { path: '', redirectTo: 'login', pathMatch: 'full' },
            { path: '**', redirectTo: 'login', pathMatch: 'full' }
        ]
    }
];
