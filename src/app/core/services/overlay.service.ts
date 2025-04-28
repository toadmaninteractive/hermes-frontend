import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class OverlayService {
    isDialogDisplayed$ = new BehaviorSubject<boolean>(false);
}
