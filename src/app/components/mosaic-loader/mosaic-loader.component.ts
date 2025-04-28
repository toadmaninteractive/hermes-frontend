import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
    selector: 'app-mosaic-loader',
    templateUrl: './mosaic-loader.component.html',
    styleUrls: ['./mosaic-loader.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: []
})
export class MosaicLoaderComponent {
    rows = [1, 2, 3, 4];
    cols = [1, 2, 3, 4];
}
