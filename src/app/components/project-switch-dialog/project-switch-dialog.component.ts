import { ChangeDetectionStrategy, Component, Inject, OnDestroy, OnInit, Self } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { MatListModule, MatSelectionListChange } from '@angular/material/list';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatInput } from '@angular/material/input';
import { MatFormField, MatSuffix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';
import { AsyncPipe } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { OverlayService } from '../../core/services/overlay.service';
import { simplifyTitle } from '../../shared/functions/simplify-title';
import { Project } from '../../protocol/db-protocol';
import { hexToRgbA } from '../../shared/functions/color';
import { ProjectsData } from '../../shared/interfaces/dialog-data.interface';
import { FilterService } from '../../core/services/filter.service';

@Component({
    templateUrl: 'project-switch-dialog.component.html',
    styleUrls: ['project-switch-dialog.component.scss'],
    standalone: true,
    imports: [
        MatIconButton,
        MatIcon,
        MatFormField,
        MatInput,
        FormsModule,
        MatSuffix,
        MatListModule,
        MatDialogModule,
        AsyncPipe,
        ReactiveFormsModule
    ],
    providers: [FilterService],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectSwitchDialogComponent implements OnInit, OnDestroy {
    destroy$ = new Subject<void>();

    hexToRgbA = hexToRgbA;

    selectedProject!: Project;
    filteredProjects = [...this.data.projects];

    filterControl = this.filterService.filterControl;

    constructor(
        public dialogRef: MatDialogRef<ProjectSwitchDialogComponent>,
        private overlayService: OverlayService,
        private router: Router,
        @Self()
        private filterService: FilterService,
        @Inject(MAT_DIALOG_DATA) public data: ProjectsData
    ) {}

    ngOnInit(): void {
        this.filterService.needle$.pipe(takeUntil(this.destroy$)).subscribe(({ needle }) => {
            const filtered = needle
                ? this.data.projects.filter((project) =>
                      project.title.toLowerCase().includes(needle)
                  )
                : this.data.projects;
            this.filteredProjects = [...filtered];
        });

        this.selectedProject = this.data.currentProject;
        this.overlayService.isDialogDisplayed$.next(true);
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.overlayService.isDialogDisplayed$.next(false);
    }

    makeLink(title: string): string {
        return this.data.url.replace('{}', simplifyTitle(title));
    }

    select(project: MatSelectionListChange) {
        this.dialogRef.close();
        this.router.navigate([this.makeLink(project.options.at(0).value.title)]);
    }
}
