import { Routes } from '@angular/router';
import { employeeRedirectGuard } from '../../core/guards/employee-redirect.guard';
import { EmployeesComponent } from './employees/employees.component';
import { EmployeeTimesheetComponent } from './employee-timesheet/employee-timesheet.component';
import { RoleHistoryComponent } from './history/role-history.component';

export const EMPLOYEES_ROUTES: Routes = [
    {
        path: '',
        component: EmployeesComponent
    },
    {
        path: 'office/:officeId/history',
        component: RoleHistoryComponent
    },
    {
        path: ':username',
        component: EmployeeTimesheetComponent,
        canActivate: [employeeRedirectGuard]
    },
    {
        path: ':username/:year/:month',
        component: EmployeeTimesheetComponent
    }
];
