import { Routes } from '@angular/router';
import { reportRedirectGuard } from '../../core/guards/report-redirect.guard';
import { LogsComponent } from './logs/logs.component';
import { ReportsComponent } from './reports.component';

export const REPORTS_ROUTES: Routes = [
    {
        path: '',
        component: ReportsComponent,
        canActivate: [reportRedirectGuard]
    },
    {
        path: ':id/logs',
        component: LogsComponent
    },
    /**
     * TODO: do the same thing as here:
     * @see /src/app/pages/employees/employees-routing.module.ts
     * */
    {
        path: ':officeName/:year/:month',
        component: ReportsComponent
    }
];
