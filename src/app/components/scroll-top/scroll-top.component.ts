import {
    Component,
    ChangeDetectionStrategy,
    AfterViewInit,
    ElementRef,
    Inject,
    OnDestroy,
    signal
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { DOCUMENT } from '@angular/common';
import { debounceTime, fromEvent, Subject, takeUntil } from 'rxjs';

@Component({
    // eslint-disable-next-line @angular-eslint/component-selector
    selector: '[with-scroll-top]',
    templateUrl: './scroll-top.component.html',
    styleUrls: ['./scroll-top.component.scss'],
    standalone: true,
    imports: [MatIconModule, MatButtonModule],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ScrollTopComponent implements AfterViewInit, OnDestroy {
    readonly isShown = signal(false);
    private readonly topPosToStartShowing: number = 600;
    private scrollContainer: HTMLElement;
    private destroy$ = new Subject<void>();

    constructor(
        private elementRef: ElementRef<HTMLElement>,
        @Inject(DOCUMENT) private document: Document
    ) {}

    ngAfterViewInit(): void {
        this.scrollContainer = this.elementRef.nativeElement;
        if (this.scrollContainer) {
            fromEvent(this.scrollContainer, 'scroll')
                .pipe(debounceTime(100), takeUntil(this.destroy$))
                .subscribe(() => this.checkScroll());
        }
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    checkScroll(): void {
        const scrollPosition =
            this.scrollContainer.scrollTop ||
            this.document.documentElement.scrollTop ||
            this.document.body.scrollTop ||
            0;
        this.isShown.set(scrollPosition >= this.topPosToStartShowing);
    }

    scrollToTop(): void {
        this.scrollContainer.scroll({
            top: 0,
            left: 0,
            behavior: 'smooth'
        });
    }
}
