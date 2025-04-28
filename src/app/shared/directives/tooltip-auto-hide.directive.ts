import { Directive, HostListener } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';

@Directive({
    selector: '[appMatTooltipAutoHide][matTooltip]',
    standalone: true
})
export class TooltipAutoHideDirective {
    constructor(private tooltip: MatTooltip) {}

    @HostListener('mouseleave', ['$event'])
    async onMouseleave(event: MouseEvent): Promise<void> {
        this.tooltip.hide();
    }
}
