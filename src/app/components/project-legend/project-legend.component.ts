import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    OnDestroy,
    Output
} from '@angular/core';
import { AsyncPipe, UpperCasePipe, SlicePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { BehaviorSubject, Subject } from 'rxjs';
import { hexToRgbA } from '../../shared/functions/color';
import { Project } from '../../protocol/db-protocol';
import { ProjectWithDays } from '../../shared/interfaces/days-spent-on-project.interface';

@Component({
    selector: 'app-project-legend',
    templateUrl: './project-legend.component.html',
    styleUrls: ['./project-legend.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [AsyncPipe, UpperCasePipe, SlicePipe, MatButtonModule]
})
export class ProjectLegendComponent implements OnDestroy {
    destroy$ = new Subject<void>();
    projectsWithDays$ = new BehaviorSubject<ProjectWithDays[]>([]);
    hexToRgbA = hexToRgbA;
    selectedProjectsId = new Set<number>();

    @Input() isColumn = false;

    @Input() set projectsWithDays(value: ProjectWithDays[]) {
        this.projectsWithDays$.next(value);
    }

    @Output() readonly selectProject = new EventEmitter<Set<number>>();

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.projectsWithDays$.complete();
    }

    onHighlightProject(projectId: number): void {
        if (!this.selectedProjectsId.has(projectId)) {
            this.selectedProjectsId.add(projectId);
        } else {
            this.selectedProjectsId.delete(projectId);
        }
        this.selectProject.emit(this.selectedProjectsId);
    }

    calculateColor(project: Project): string {
        let alpha = 0.75;
        if (this.selectedProjectsId.size !== 0 && !this.selectedProjectsId.has(project.id)) {
            alpha = 0.25;
        }
        return hexToRgbA(project?.color || '#CCCCCC', alpha);
    }

    deselectElements(): void {
        this.selectedProjectsId = new Set<number>();
        this.selectProject.emit(this.selectedProjectsId);
    }
}
