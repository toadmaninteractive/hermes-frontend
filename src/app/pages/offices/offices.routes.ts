import { Routes } from '@angular/router';
import { OfficeTimesheetComponent } from './office-timesheet/office-timesheet.component';
import { OfficesComponent } from './offices/offices.component';

export const OFFICE_ROUTES: Routes = [
    {
        path: '',
        component: OfficesComponent
    },
    /**
     * TODO: do the same thing as here:
     * @see /src/app/pages/employees/employees-routing.module.ts
     * */
    {
        path: ':name/:year/:month',
        component: OfficeTimesheetComponent
    }
];
