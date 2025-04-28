import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { combineLatest } from 'rxjs';
import { PersonnelAccount, Project, Team } from 'src/app/protocol/db-protocol';
import { Constants } from '../../shared/constants/constants';
import { AccountService } from '../services/account.service';
import { CacheService } from '../services/cache.service';

const isProjectManager = (projects: Project[], userId: number): boolean => {
    return Boolean(projects?.find((p) => p.supervisorId === userId));
};

const isTeamCreator = (teams: Team[], userId): boolean => {
    return Boolean(teams?.find((team) => team.createdBy === userId));
};

const isTeamManager = (managers: PersonnelAccount[], userId: number): boolean => {
    return Boolean(managers?.find((team) => team.id === userId));
};

const isManager = (
    userId: number,
    projects: Project[],
    teams: Team[],
    teamManagers: PersonnelAccount[]
): boolean => {
    return (
        isProjectManager(projects, userId) ||
        isTeamCreator(teams, userId) ||
        isTeamManager(teamManagers, userId)
    );
};

export const managerGuard: CanActivateFn = (route) => {
    const cacheService = inject(CacheService);
    const accountService = inject(AccountService);
    const router = inject(Router);

    return combineLatest([
        accountService.profile$
            .asObservable()
            .pipe(filter((profile) => profile instanceof PersonnelAccount)),
        cacheService.projects$.asObservable(),
        cacheService.teams$.asObservable(),
        cacheService.teamManagers$.asObservable()
    ]).pipe(
        map(([profile, projects, teams, teamManagers]) =>
            profile.isSuperadmin ||
            profile.isOfficeManager ||
            isManager(profile.id, projects, teams, teamManagers)
                ? true
                : router.parseUrl(Constants.defaultUrl)
        )
    );
};
