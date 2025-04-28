import { Routes } from '@angular/router';
import { ProjectTimesheetComponent } from './project-timesheet/project-timesheet.component';
import { ProjectsComponent } from './projects/projects.component';

export const PROJECTS_ROUTES: Routes = [
    {
        path: '',
        component: ProjectsComponent
    },
    /**
     * TODO: do the same thing as here:
     * @see /src/app/pages/employees/employees-routing.module.ts
     * */
    {
        path: ':name/:year/:month',
        component: ProjectTimesheetComponent
    }
];
