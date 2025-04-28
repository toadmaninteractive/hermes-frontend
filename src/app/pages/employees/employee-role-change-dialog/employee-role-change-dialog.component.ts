import { ChangeDetectionStrategy, Component, Inject, OnDestroy, OnInit, Self } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatListModule, MatSelectionListChange } from '@angular/material/list';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatInput } from '@angular/material/input';
import { MatFormField, MatSuffix } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AsyncPipe } from '@angular/common';
import { BehaviorSubject, Subject, takeUntil } from 'rxjs';
import { Role } from '../../../protocol/db-protocol';
import { RoleData } from '../../../shared/interfaces/dialog-data.interface';
import { FilterService } from '../../../core/services/filter.service';

@Component({
    templateUrl: './employee-role-change-dialog.component.html',
    styleUrls: ['./employee-role-change-dialog.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatFormField,
        MatInput,
        FormsModule,
        MatSuffix,
        AsyncPipe,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatListModule,
        ReactiveFormsModule
    ],
    providers: [FilterService]
})
export class EmployeeRoleChangeDialogComponent implements OnInit, OnDestroy {
    destroy$ = new Subject<void>();
    filteredRoles$ = new BehaviorSubject<Role[]>(null);
    filterControl = this.filterService.filterControl;
    private needle$ = this.filterService.needle$;

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: RoleData,
        public dialogRef: MatDialogRef<EmployeeRoleChangeDialogComponent>,
        @Self()
        private filterService: FilterService
    ) {}

    ngOnInit(): void {
        this.filteredRoles$.next(this.data.roles);

        this.needle$.pipe(takeUntil(this.destroy$)).subscribe(({ needle }) => {
            const filtered = needle
                ? this.data.roles.filter((roles) => roles.title.toLowerCase().includes(needle))
                : [...this.data.roles];

            this.filteredRoles$.next(filtered);
        });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.filteredRoles$.complete();
    }

    onSelectRole(role: MatSelectionListChange): void {
        this.dialogRef.close(role.options.at(0).value);
    }
}
