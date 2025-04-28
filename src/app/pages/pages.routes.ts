import { Routes } from '@angular/router';
import { superadminGuard } from '../core/guards/superadmin.guard';
import { managerGuard } from '../core/guards/manager.guard';
// import { LayoutComponent } from './_layout/layout.component';
import { LayoutComponent } from './layout/layout.component';

export const PAGES_ROUTES: Routes = [
    {
        path: '',
        component: LayoutComponent,
        children: [
            // {
            //     title: 'Hermes | Dashboard',
            //     path: 'dashboard',
            //     loadChildren: () =>
            //         import('./dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES)
            // },
            {
                title: 'Hermes | Offices',
                path: 'offices',
                loadChildren: () => import('./offices/offices.routes').then((m) => m.OFFICE_ROUTES)
            },
            {
                title: 'Hermes | Reports',
                path: 'reports',
                loadChildren: () =>
                    import('./reports/reports.routes').then((m) => m.REPORTS_ROUTES),
                canActivate: [managerGuard]
            },
            {
                title: 'Hermes | Employees',
                path: 'employees',
                loadChildren: () =>
                    import('./employees/employees.routes').then((m) => m.EMPLOYEES_ROUTES)
            },
            {
                title: 'Hermes | Projects',
                path: 'projects',
                loadChildren: () =>
                    import('./projects/projects.routes').then((m) => m.PROJECTS_ROUTES)
            },
            {
                title: 'Hermes | Summary',
                path: 'summary',
                loadChildren: () => import('./summary/summary.routes').then((m) => m.SUMMARY_ROUTES)
            },
            {
                title: 'Hermes | Roles',
                path: 'roles',
                loadChildren: () => import('./roles/roles.routes').then((m) => m.ROLE_ROUTES),
                canActivate: [superadminGuard]
            },
            {
                title: 'Hermes | Teams',
                path: 'teams',
                loadChildren: () => import('./teams/teams.routes').then((m) => m.TEAMS_ROUTES)
            },
            {
                title: 'Hermes | Highlights',
                path: 'highlights',
                loadChildren: () =>
                    import('./highlights/highlights.routes').then((m) => m.HIGHLIGHTS_ROUTES),
                canActivate: [superadminGuard]
            },
            {
                title: 'Hermes | Privileges',
                path: 'privileges',
                loadChildren: () =>
                    import('./privileges/privileges.routes').then((m) => m.PRIVILEGES_ROUTES)
            },
            {
                path: '',
                redirectTo: '/projects',
                pathMatch: 'full'
            },
            {
                path: '**',
                redirectTo: 'error/404'
            }
        ]
    }
];
