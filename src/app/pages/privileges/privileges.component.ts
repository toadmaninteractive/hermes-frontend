import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { MatList, MatListItem } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { AsyncPipe } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { filter, takeUntil } from 'rxjs/operators';
import { BehaviorSubject, combineLatest, Subject } from 'rxjs';
import { AccountService } from '../../core/services/account.service';
import { Project } from '../../protocol/db-protocol';
import { CacheService } from '../../core/services/cache.service';

@Component({
    selector: 'app-privileges',
    templateUrl: './privileges.component.html',
    styleUrls: ['./privileges.component.scss'],
    standalone: true,
    imports: [MatList, MatListItem, AsyncPipe, MatToolbarModule, MatCheckboxModule, MatCardModule],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class PrivilegesComponent implements OnInit, OnDestroy {
    destroy$ = new Subject<void>();
    managingProjects$ = new BehaviorSubject<Project[]>([]);

    constructor(
        public accountService: AccountService,
        private cacheService: CacheService
    ) {}

    ngOnInit(): void {
        combineLatest([this.cacheService.projects$, this.accountService.profile$])
            .pipe(
                filter(([projects, profile]) => Boolean(projects) && Boolean(profile)),
                takeUntil(this.destroy$)
            )
            .subscribe(([projects, profile]) =>
                this.managingProjects$.next(
                    projects.filter((item) => item.supervisorId === profile.id)
                )
            );
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }
}
