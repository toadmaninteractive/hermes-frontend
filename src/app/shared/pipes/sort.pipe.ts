import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'sort',
    standalone: true
})
export class SortPipe implements PipeTransform {
    public transform<T>(value: Array<T>, compareFn: (a: T, b: T) => number): Array<T> {
        return value.sort(compareFn);
    }
}
