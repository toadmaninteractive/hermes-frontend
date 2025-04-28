import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';

@Component({
    selector: 'app-error1',
    templateUrl: './error1.component.html',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class Error1Component {
    constructor() {}
}
