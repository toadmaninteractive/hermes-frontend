import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'mCharacterLimit',
    standalone: true
})
export class CharacterLimitPipe implements PipeTransform {
    transform(value: string, limit: number): unknown {
        return value.length > limit ? value.slice(0, limit) + '...' : value;
    }
}
