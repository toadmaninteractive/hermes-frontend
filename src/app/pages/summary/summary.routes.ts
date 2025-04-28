import { Routes } from '@angular/router';

import { SummaryComponent } from './summary.component';

export const SUMMARY_ROUTES: Routes = [
    {
        path: ':name',
        component: SummaryComponent
    }
];
