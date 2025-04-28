import { Routes } from '@angular/router';
import { TeamsComponent } from './teams/teams.component';
import { TeamTimesheetComponent } from './team-timesheet/team-timesheet.component';

export const TEAMS_ROUTES: Routes = [
    {
        path: '',
        component: TeamsComponent
    },
    /**
     * TODO: do the same thing as here:
     * @see /src/app/pages/employees/employees-routing.module.ts
     * */
    {
        path: ':name/:year/:month',
        component: TeamTimesheetComponent
    }
];
