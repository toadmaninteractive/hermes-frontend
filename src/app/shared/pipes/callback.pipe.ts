import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'mCallback',
    pure: false,
    standalone: true
})
export class CallbackPipe implements PipeTransform {
    transform(items: any[], callback: (item: any) => boolean): any {
        if (!items || !callback) {
            return items;
        }
        return items.filter((item) => callback(item));
    }
}
