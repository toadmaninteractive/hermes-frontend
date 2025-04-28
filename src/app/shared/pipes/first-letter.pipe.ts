import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'mFirstLetter',
    standalone: true
})
export class FirstLetterPipe implements PipeTransform {
    transform(value: any, args?: any): any {
        return value.charAt(0);
    }
}
