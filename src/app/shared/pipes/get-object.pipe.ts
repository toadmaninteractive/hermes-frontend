import { Pipe, PipeTransform } from '@angular/core';
import objectPath from 'object-path';

@Pipe({
    name: 'mGetObject',
    standalone: true
})
export class GetObjectPipe implements PipeTransform {
    transform(value: any, args?: any): any {
        return objectPath.get(value, args);
    }
}
