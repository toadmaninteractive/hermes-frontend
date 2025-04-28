import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    Inject,
    OnDestroy,
    OnInit,
    ViewChild
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { UntypedFormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { MatOption } from '@angular/material/core';
import { MatAutocompleteTrigger, MatAutocomplete } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormField } from '@angular/material/form-field';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AsyncPipe, TitleCasePipe } from '@angular/common';
import {
    debounceTime,
    distinctUntilChanged,
    filter,
    map,
    startWith,
    switchMap,
    take,
    takeUntil
} from 'rxjs/operators';
import { BehaviorSubject, combineLatest, Subject } from 'rxjs';
import { TeamManagerError } from '../../../protocol/web-protocol';
import {
    BadRequestError,
    ForbiddenError,
    InternalServerError,
    NotFoundError
} from '../../../protocol/data-protocol';
import { Empty } from '../../../protocol/common-protocol';
import { HermesTeamService } from '../../../protocol/team-protocol.service';
import { CacheService } from '../../../core/services/cache.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PersonnelAccount, Team } from '../../../protocol/db-protocol';

@Component({
    selector: 'app-team-manager-dialog',
    templateUrl: 'team-manager-dialog.component.html',
    styleUrls: ['team-manager-dialog.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        CdkScrollable,
        MatFormField,
        FormsModule,
        MatAutocompleteTrigger,
        MatChipsModule,
        ReactiveFormsModule,
        MatAutocomplete,
        MatOption,
        AsyncPipe,
        TitleCasePipe,
        MatDialogModule,
        MatButtonModule,
        MatIconModule
    ]
})
export class TeamManagerDialogComponent implements OnInit, OnDestroy {
    @ViewChild('managerInput') managerInput: ElementRef<HTMLInputElement>;
    destroy$ = new Subject<void>();
    employees$ = new BehaviorSubject<PersonnelAccount[]>([]);
    filteredEmployees$ = new BehaviorSubject<PersonnelAccount[]>(null);
    refresh$ = new BehaviorSubject<boolean>(false);
    managers$ = new BehaviorSubject<PersonnelAccount[]>([]);
    team$ = new BehaviorSubject<Team>(null);

    separatorKeysCodes = [ENTER, COMMA];
    managerInputCtrl = new UntypedFormControl();

    constructor(
        public dialogRef: MatDialogRef<TeamManagerDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: Team,
        private cacheService: CacheService,
        private teamService: HermesTeamService,
        private notificationService: NotificationService
    ) {}

    ngOnInit(): void {
        this.refresh$
            .asObservable()
            .pipe(
                takeUntil(this.destroy$),
                switchMap(() =>
                    combineLatest([
                        this.cacheService.employees$
                            .asObservable()
                            .pipe(filter((emp) => emp && Boolean(emp.length))),
                        this.teamService
                            .getTeamManagers(this.data.id)
                            .pipe(map((collection) => collection.items))
                    ])
                )
            )
            .subscribe(([employees, managers]) => {
                this.employees$.next(
                    employees.filter(
                        (e) => e.id !== this.data.createdBy && !managers.find((m) => m.id === e.id)
                    )
                );
                this.managers$.next(
                    employees.filter((e) => e.id === this.data.createdBy).concat(managers)
                );
            });

        this.team$.next(this.data);

        combineLatest([
            this.managerInputCtrl.valueChanges.pipe(
                takeUntil(this.destroy$),
                startWith(''),
                filter((changes) => typeof changes === 'string')
            ),
            this.employees$.asObservable(),
            this.team$.asObservable()
        ])
            .pipe(
                takeUntil(this.destroy$),
                distinctUntilChanged(),
                debounceTime(250),
                filter(([, employees, employee]) => employees.length && Boolean(employee))
            )
            .subscribe(([changes, employees, team]) => {
                const filteredEmployees = employees.filter((e) =>
                    (e.name.toLowerCase() + e.username.toLowerCase()).includes(
                        changes.toLowerCase()
                    )
                );

                this.filteredEmployees$.next(filteredEmployees);
            });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.employees$.complete();
        this.filteredEmployees$.complete();
        this.managers$.complete();
        this.refresh$.complete();
        this.team$.complete();
    }

    closeDialog(result: PersonnelAccount): void {
        this.dialogRef.close(result);
    }

    removeTeamManager(employeeId: number, teamId: number): void {
        this.teamService
            .unsetTeamManager(teamId, employeeId)
            .pipe(takeUntil(this.destroy$), take(1))
            .subscribe({
                next: () => {
                    this.refresh();
                    this.notificationService.success('Successfully removes from team manages');
                },
                error: (err) => {
                    this.handleBadRequestError(err);
                }
            });
    }

    addTeamManager(employeeId: string, teamId: number, employees: PersonnelAccount[]): void {
        if (!employees.find((e) => e.id === Number(employeeId))) {
            return;
        }
        this.teamService
            .setTeamManager(new Empty(), teamId, Number(employeeId))
            .pipe(takeUntil(this.destroy$), take(1))
            .subscribe({
                next: () => {
                    this.refresh();
                    this.notificationService.success('Successfully added as team manager');
                },
                error: (err) => {
                    this.handleBadRequestError(err);
                },
                complete: () => {
                    this.managerInput.nativeElement.blur();
                }
            });
    }

    refresh(): void {
        this.managerInput.nativeElement.value = '';
        this.managerInputCtrl.setValue('', { emitEvent: false });
        this.refresh$.next(true);
        this.cacheService.reloadTeams();
        this.cacheService.reloadEmployees();
    }

    handleBadRequestError(
        error:
            | BadRequestError<TeamManagerError>
            | ForbiddenError
            | NotFoundError
            | InternalServerError
    ): void {
        let errorMessage: string = null;

        if (error instanceof BadRequestError) {
            switch (error.error) {
                case TeamManagerError.ManagerIsOwner:
                    errorMessage = 'Manager is owner';
                    break;
                case TeamManagerError.ManagerNotExists:
                    errorMessage = 'Manager not exist';
                    break;
                default:
                    break;
            }
        } else if (error instanceof ForbiddenError) {
            errorMessage = 'Forbidden';
        } else if (error instanceof NotFoundError) {
            errorMessage = 'employee not found';
        } else if (error instanceof InternalServerError) {
            errorMessage = 'internal server error';
        }

        this.notificationService.error(errorMessage);
        this.dialogRef.close();
    }
}
