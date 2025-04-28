import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'mMapTo',
    standalone: true
})
export class MapToPipe implements PipeTransform {
    transform(value: Array<any>, mapFun: (any) => any): any {
        return value.map((v) => mapFun(v));
    }
}
