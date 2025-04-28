import { Component, ChangeDetectionStrategy, OnDestroy, inject, ViewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { RouterModule } from '@angular/router';
import { AsyncPipe, NgTemplateOutlet } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Subject, takeUntil } from 'rxjs';
import { Constants } from '../../shared/constants/constants';
import { AccountService } from '../../core/services/account.service';
import { CacheService } from '../../core/services/cache.service';
import { PersonnelAccount, Project, Team } from '../../protocol/db-protocol';
import { ThemeService } from '../../core/services/theme.service';

export const DynamicAsideMenuConfig = {
    items: [
        {
            title: 'Offices',
            root: true,
            icon: 'domain',
            page: '/offices'
        },
        {
            title: 'Projects',
            root: true,
            icon: 'layers',
            page: '/projects'
        },
        {
            title: 'Teams',
            root: true,
            icon: 'group',
            page: '/teams'
        },
        {
            title: 'Reports',
            for: 'manager',
            root: true,
            icon: 'query_stats',
            page: '/reports'
        },
        {
            title: 'Employees',
            root: true,
            icon: 'badge',
            page: '/employees'
        },
        {
            title: 'Roles',
            for: 'superadmin',
            root: true,
            icon: 'business_center',
            page: '/roles'
        },
        {
            title: 'Highlights',
            for: 'superadmin',
            root: true,
            icon: 'star',
            page: '/highlights'
        }
    ]
};

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-layout',
    templateUrl: './layout.component.html',
    styleUrls: ['./layout.component.scss'],
    standalone: true,
    imports: [
        MatSidenavModule,
        MatListModule,
        MatIconModule,
        RouterModule,
        MatButtonModule,
        AsyncPipe,
        MatTooltipModule,
        MatToolbarModule,
        NgTemplateOutlet
    ]
})
export class LayoutComponent implements OnDestroy {
    @ViewChild(MatSidenav) sidenav?: MatSidenav;
    menuItems = DynamicAsideMenuConfig.items;
    version = Constants.version;

    public readonly accountService = inject(AccountService);
    public readonly cacheService = inject(CacheService);
    public readonly themeService = inject(ThemeService);

    isOpen =
        this.breakpointObserver.isMatched(Breakpoints.Large) ||
        this.breakpointObserver.isMatched(Breakpoints.XLarge);
    isSmall =
        !this.breakpointObserver.isMatched(Breakpoints.Large) &&
        !this.breakpointObserver.isMatched(Breakpoints.XLarge);

    constructor(private breakpointObserver: BreakpointObserver) {
        breakpointObserver
            .observe([
                Breakpoints.XSmall,
                Breakpoints.Small,
                Breakpoints.Medium,
                Breakpoints.Large,
                Breakpoints.XLarge
            ])
            .pipe(takeUntil(this.destroy$))
            .subscribe((result) => {
                if (
                    result.breakpoints[Breakpoints.Large] ||
                    result.breakpoints[Breakpoints.XLarge]
                ) {
                    this.isSmall = false;
                    this.sidenav?.open();
                } else {
                    this.isSmall = true;
                    this.sidenav?.close();
                }
            });
    }

    private destroy$ = new Subject<void>();

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    get currentTheme() {
        return this.themeService.currentTheme;
    }

    toggleTheme() {
        this.themeService.toggleTheme();
    }

    logout(): void {
        this.accountService
            .signOut()
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (response) => {
                    /* TODO: maybe display error box */
                },
                error: (error) => console.log('Sign-out failed, error: ', error)
            });
    }

    matchesFor(
        expectedRole: string | null,
        profile: PersonnelAccount,
        projects: Project[],
        teams: Team[],
        teamManagers: PersonnelAccount[]
    ): boolean {
        switch (expectedRole) {
            case 'superadmin':
                return profile && profile.isSuperadmin;
            case 'manager':
                return (
                    profile &&
                    (profile.isOfficeManager ||
                        profile.isSuperadmin ||
                        this.isProjectManager(projects, profile.id) ||
                        this.isTeamCreator(teams, profile.id) ||
                        this.isTeamManager(teamManagers, profile.id))
                );
            default:
                return true;
        }
    }

    private isProjectManager(projects: Project[], userId: number): boolean {
        return Boolean(projects?.find((p) => p.supervisorId === userId));
    }

    private isTeamCreator(teams: Team[], userId): boolean {
        return Boolean(teams?.find((team) => team.createdBy === userId));
    }

    private isTeamManager(managers: PersonnelAccount[], userId: number): boolean {
        return Boolean(managers?.find((team) => team.id === userId));
    }
}
