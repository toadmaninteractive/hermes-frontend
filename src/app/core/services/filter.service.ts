import { inject, Injectable } from '@angular/core';
import { FormControl } from '@angular/forms';
import { combineLatest, distinctUntilChanged, map, of, switchMap, take, tap, timer } from 'rxjs';
import { AccountService } from './account.service';

@Injectable({
    providedIn: 'root'
})
/**
 * NOTE: provide to the component this service and inject with @Self() decorator
 */
export class FilterService {
    private readonly accountService = inject(AccountService);
    filterControl = new FormControl('');

    private search$ = this.filterControl.valueChanges;

    needle = '';
    needle$ = this.search$.pipe(
        // NOTE: optional debounce doesn't work in switch-anything-components
        // switchMap((value) => (value ? timer(200).pipe(switchMap(() => of(value))) : of(value))),
        // NOTE: distinctUntilChanged breaks feature with recovering query from localStorage
        // distinctUntilChanged(),
        map((v) => v.trim().toLowerCase()),
        tap((needle) => (this.needle = needle)),
        switchMap((needle) =>
            combineLatest({
                needle: of(needle),
                profile: this.accountService.profile$.pipe(take(1))
            })
        )
    );
}
