import { ChangeDetectionStrategy, Component, Inject, OnDestroy, OnInit, Self } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatListModule, MatSelectionListChange } from '@angular/material/list';
import { MatCheckbox } from '@angular/material/checkbox';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule, MatSuffix } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AsyncPipe, UpperCasePipe, SlicePipe } from '@angular/common';
import { map, takeUntil } from 'rxjs/operators';
import { BehaviorSubject, combineLatest, Subject } from 'rxjs';
import { Project } from '../../../protocol/db-protocol';
import { AllocateData } from '../../../shared/interfaces/dialog-data.interface';
import { hexToRgbA } from '../../../shared/functions/color';
import { FilterService } from '../../../core/services/filter.service';

@Component({
    templateUrl: './employee-project-change-dialog.component.html',
    styleUrls: ['./employee-project-change-dialog.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        FormsModule,
        MatSuffix,
        MatCheckbox,
        AsyncPipe,
        UpperCasePipe,
        SlicePipe,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatListModule,
        MatFormFieldModule,
        MatInputModule,
        ReactiveFormsModule
    ],
    providers: [FilterService]
})
export class EmployeeProjectChangeDialogComponent implements OnInit, OnDestroy {
    destroy$ = new Subject<void>();
    includeArchived$ = new BehaviorSubject<boolean>(false);
    filteredProjects$ = new BehaviorSubject<Project[]>([]);
    hexToRgbA = hexToRgbA;

    filterControl = this.filterService.filterControl;
    needle$ = this.filterService.needle$;

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: AllocateData,
        public dialogRef: MatDialogRef<EmployeeProjectChangeDialogComponent>,
        @Self()
        private filterService: FilterService
    ) {}

    ngOnInit(): void {
        this.filteredProjects$.next(this.data.projects);
        combineLatest([
            this.needle$.pipe(map(({ needle }) => needle)),
            this.includeArchived$.asObservable()
        ])
            .pipe(takeUntil(this.destroy$))
            .subscribe(([needle, includeArchived]) => {
                const filteredByNeedle = needle
                    ? this.data.projects.filter((project) =>
                          project.title.toLowerCase().includes(needle)
                      )
                    : this.data.projects;
                const filtered = filteredByNeedle.filter((project) =>
                    includeArchived ? true : !project.isArchived
                );

                this.filteredProjects$.next(filtered);
            });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.includeArchived$.complete();
        this.filteredProjects$.complete();
    }

    onSelectProject(project: MatSelectionListChange): void {
        this.dialogRef.close(project.options.at(0).value);
    }

    onDeallocate(): void {
        this.dialogRef.close('deallocate');
    }

    onCheckArchived(value: boolean): void {
        this.includeArchived$.next(value);
    }
}
