import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'flag',
    standalone: true
})
export class CountryFlagPipe implements PipeTransform {
    transform(code: string): string {
        return `assets/media/flags/3x2/${String(code).toUpperCase()}.svg`;
    }
}
