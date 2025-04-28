import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
    selector: 'app-loading-indicator',
    templateUrl: './loading-indicator.component.html',
    styleUrls: ['./loading-indicator.component.scss'],
    standalone: true,
    imports: [NgClass],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadingIndicatorComponent {
    @Input() isInline = false;
}
