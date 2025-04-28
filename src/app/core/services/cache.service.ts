import { Injectable } from '@angular/core';
import { filter, map, switchMap, take, tap } from 'rxjs/operators';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { OrderDirection } from '../../protocol/data-protocol';
import {
    Highlight,
    Office,
    PersonnelAccount,
    Project,
    Role,
    Team
} from '../../protocol/db-protocol';
import { PersonnelAccountOrderBy } from '../../protocol/web-protocol';
import { HermesEmployeeService } from '../../protocol/web-employee-protocol.service';
import { HermesTeamService } from '../../protocol/team-protocol.service';
import { HermesProjectService } from '../../protocol/project-protocol.service';
import { HermesRoleService } from '../../protocol/role-protocol.service';
import { HermesOfficeService } from '../../protocol/web-office-protocol.service';
import { HermesHighlightService } from '../../protocol/highlight-protocol.service';
import { AccountService } from './account.service';

@Injectable({
    providedIn: 'root'
})
export class CacheService {
    employees$ = new BehaviorSubject<PersonnelAccount[] | null>(null);
    highlights$ = new BehaviorSubject<Highlight[]>([]);
    projects$ = new BehaviorSubject<Project[]>(null);
    roles$ = new BehaviorSubject<Role[]>(null);
    teams$ = new BehaviorSubject<Team[] | null>(null);
    offices$ = new BehaviorSubject<Office[]>(null);
    selectedOffice$ = new BehaviorSubject<Office | string>(null);
    teamManagers$ = new BehaviorSubject<PersonnelAccount[]>([]);

    constructor(
        private accountService: AccountService,
        private employeeService: HermesEmployeeService,
        private highlightService: HermesHighlightService,
        private officeService: HermesOfficeService,
        private projectService: HermesProjectService,
        private roleService: HermesRoleService,
        private teamService: HermesTeamService
    ) {
        this.accountService
            .isSignedIn()
            .pipe(
                filter((isSignIn) => Boolean(isSignIn)),
                take(1)
            )
            .subscribe(() => this.initialize());
    }

    initialize(): void {
        this.employeeService
            .getEmployees(null, PersonnelAccountOrderBy.Id, OrderDirection.Asc, 0, 10000)
            .pipe(map((collection) => collection.items))
            .subscribe((response) => this.employees$.next(response));

        this.projectService
            .getProjects()
            .pipe(map((response) => response.items))
            .subscribe((projects: Project[]) => {
                const sortedProjects = projects.sort((a, b) =>
                    a.title > b.title ? 1 : a.title < b.title ? -1 : 0
                );
                this.projects$.next(sortedProjects);
            });

        this.roleService
            .getRoles()
            .pipe(map((collection) => collection.items))
            .subscribe((response) => this.roles$.next(response));

        this.teamService
            .getTeams()
            .pipe(
                map((collection) => collection.items),
                tap((response) => this.teams$.next(response)),
                map((teams: Team[]) => teams.map((t) => t.id)),
                switchMap((teamIds: number[]) =>
                    combineLatest(
                        teamIds.map((id) =>
                            this.teamService
                                .getTeamManagers(id)
                                .pipe(map((collection) => collection.items))
                        )
                    )
                ),
                map((teamManagers: PersonnelAccount[][]) =>
                    teamManagers.reduce((acc, cur) => acc.concat(cur), [])
                )
            )
            .subscribe((response) => this.teamManagers$.next(response));

        this.highlightService
            .getHighlights()
            .pipe(map((collection) => collection.items))
            .subscribe((result) => this.highlights$.next(result));

        this.officeService
            .getOffices()
            .pipe(map((response) => response.items))
            .subscribe((offices) => {
                const sortedOffices = offices.sort((a, b) =>
                    a.name > b.name ? 1 : a.name < b.name ? -1 : 0
                );
                this.offices$.next(sortedOffices);
            });

        combineLatest([this.accountService.profile$.asObservable(), this.offices$.asObservable()])
            .pipe(
                filter(
                    ([profile, offices]) =>
                        profile instanceof PersonnelAccount &&
                        Boolean(offices) &&
                        Boolean(offices.length)
                )
            )
            .subscribe(([profile, offices]) => {
                this.selectedOffice$.next(offices.find((office) => office.id === profile.officeId));
            });
    }

    reloadEmployees(): Promise<void> {
        return new Promise((resolve) => {
            this.employeeService
                .getEmployees(null, PersonnelAccountOrderBy.Id, OrderDirection.Asc, 0, 10000)
                .pipe(
                    map((response) => response.items),
                    tap((employees) => this.employees$.next(employees))
                )
                .subscribe(() => resolve());
        });
    }

    reloadProjects(): void {
        this.projectService
            .getProjects()
            .pipe(map((response) => response.items))
            .subscribe((projects) => this.projects$.next(projects));
    }

    reloadRoles(): void {
        this.roleService
            .getRoles()
            .pipe(map((response) => response.items))
            .subscribe((roles) => this.roles$.next(roles));
    }

    reloadTeams(): void {
        this.teamService
            .getTeams()
            .pipe(
                map((collection) => collection.items),
                tap((response) => this.teams$.next(response)),
                map((teams: Team[]) => teams.map((t) => t.id)),
                switchMap((teamIds: number[]) =>
                    combineLatest(
                        teamIds.map((id) =>
                            this.teamService
                                .getTeamManagers(id)
                                .pipe(map((collection) => collection.items))
                        )
                    )
                ),
                map((teamManagers) => teamManagers.flat())
            )
            .subscribe((response) => this.teamManagers$.next(response));
    }

    reloadOffices(): void {
        this.officeService
            .getOffices()
            .pipe(map((response) => response.items))
            .subscribe((offices) => this.offices$.next(offices));
    }

    reloadHighlights(): void {
        this.highlightService
            .getHighlights()
            .pipe(map((collection) => collection.items))
            .subscribe((res) => this.highlights$.next(res));
    }
}
