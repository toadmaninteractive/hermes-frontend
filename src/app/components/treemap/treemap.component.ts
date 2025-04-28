import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';

@Component({
    selector: 'app-treemap',
    templateUrl: './treemap.component.html',
    styleUrls: ['./treemap.component.scss'],
    standalone: true,
    imports: [MatTooltip],
    changeDetection: ChangeDetectionStrategy.OnPush
})
/**TODO: we don't use this component */
export class TreemapComponent {}
