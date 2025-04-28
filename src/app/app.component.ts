import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { SplashScreenService } from './components/splash-screen/splash-screen.service';
import { SplashScreenComponent } from './components/splash-screen/splash-screen.component';
import { ThemeService } from './core/services/theme.service';

@Component({
    // eslint-disable-next-line @angular-eslint/component-selector
    selector: 'body[root]',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [RouterOutlet, SplashScreenComponent]
})
export class AppComponent implements OnInit, OnDestroy {
    private destroy$ = new Subject<void>();

    constructor(
        private splashScreenService: SplashScreenService,
        private router: Router,
        private themeService: ThemeService
    ) {
        this.themeService.applyStoredTheme();
    }

    ngOnInit() {
        this.router.events.pipe(takeUntil(this.destroy$)).subscribe((event) => {
            if (event instanceof NavigationEnd) {
                // hide splash screen
                this.splashScreenService.hide();

                // scroll to top on every route change
                window.scrollTo(0, 0);

                // to display back the body content
                setTimeout(() => {
                    document.body.classList.add('page-loaded');
                }, 500);
            }
        });
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }
}
