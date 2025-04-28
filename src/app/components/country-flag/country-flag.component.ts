import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CountryFlagPipe } from './country-flag.pipe';

@Component({
    selector: 'app-country-flag',
    standalone: true,
    imports: [CountryFlagPipe],
    templateUrl: './country-flag.component.html',
    styleUrl: './country-flag.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CountryFlagComponent {
    @Input({ required: true }) code: string;
    @Input() alt: string | null = null;
    @Input() size = 20;
}
