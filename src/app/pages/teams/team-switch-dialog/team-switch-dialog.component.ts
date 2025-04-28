import { Component, OnInit, OnDestroy, Inject, ChangeDetectionStrategy, Self } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Router, RouterLink } from '@angular/router';
import { MatList, MatListModule, MatSelectionListChange } from '@angular/material/list';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatInput } from '@angular/material/input';
import { MatFormField, MatSuffix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';
import { AsyncPipe } from '@angular/common';
import { filter, take, takeUntil } from 'rxjs/operators';
import { BehaviorSubject, Subject } from 'rxjs';
import { simplifyTitle } from '../../../shared/functions/simplify-title';
import { SelectedDateService } from '../../../core/services/selected-date.service';
import { Team } from '../../../protocol/db-protocol';
import { TeamData } from '../../../shared/interfaces/dialog-data.interface';
import { FilterService } from '../../../core/services/filter.service';

@Component({
    selector: 'app-team-switch-dialog',
    templateUrl: './team-switch-dialog.component.html',
    styleUrls: ['./team-switch-dialog.component.scss'],
    standalone: true,
    imports: [
        MatIconButton,
        MatIcon,
        MatFormField,
        MatInput,
        FormsModule,
        MatSuffix,
        MatList,
        RouterLink,
        AsyncPipe,
        MatListModule,
        MatDialogModule,
        ReactiveFormsModule
    ],
    providers: [FilterService],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamSwitchDialogComponent implements OnInit, OnDestroy {
    destroy$ = new Subject<void>();
    date$ = new BehaviorSubject<Date>(new Date());
    filteredTeams$ = new BehaviorSubject<Team[]>(null);
    selectedTeam!: Team;

    filterControl = this.filterService.filterControl;
    needle$ = this.filterService.needle$;

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: TeamData,
        public dialogRef: MatDialogRef<TeamSwitchDialogComponent>,
        private selectedDateService: SelectedDateService,
        private router: Router,
        @Self()
        private filterService: FilterService
    ) {}

    ngOnInit(): void {
        this.filteredTeams$.next(this.data.teams);
        this.selectedTeam = this.data.currentTeam;

        this.needle$.pipe(takeUntil(this.destroy$)).subscribe(({ needle }) => {
            const filtered = needle
                ? this.data.teams.filter((team) => team.title.toLowerCase().includes(needle))
                : [...this.data.teams];

            this.filteredTeams$.next(filtered);
        });

        this.selectedDateService.selectedDate$
            .asObservable()
            .pipe(
                filter((date) => Boolean(date)),
                takeUntil(this.destroy$)
            )
            .subscribe((date) => this.date$.next(date));
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.date$.complete();
        this.filteredTeams$.complete();
    }

    getTeamLink(title: string): string {
        return simplifyTitle(title);
    }

    select(team: MatSelectionListChange) {
        this.date$.pipe(take(1), takeUntil(this.destroy$)).subscribe((date) => {
            this.dialogRef.close();
            this.router.navigate([
                'teams',
                this.getTeamLink(team.options.at(0).value.title),
                date.getFullYear(),
                date.getMonth() + 1
            ]);
        });
    }
}
