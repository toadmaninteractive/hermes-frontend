import { importProvidersFrom } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
    PreloadAllModules,
    provideRouter,
    withPreloading,
    withRouterConfig
} from '@angular/router';
import { MAT_DIALOG_DEFAULT_OPTIONS, MatDialogConfig } from '@angular/material/dialog';
import {
    MAT_FORM_FIELD_DEFAULT_OPTIONS,
    MatFormFieldDefaultOptions
} from '@angular/material/form-field';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';
import { CalendarModule, DateAdapter } from 'angular-calendar';
import { provideToastr } from 'ngx-toastr';
import { InlineSVGModule } from 'ng-inline-svg-2';

import { enUS } from 'date-fns/esm/locale';
import { AppComponent } from './app/app.component';
import { ROUTES } from './app/app.routes';
import { corsInterceptor } from './app/core/interceptors/cors.interceptor';

bootstrapApplication(AppComponent, {
    providers: [
        importProvidersFrom(
            InlineSVGModule.forRoot(),
            CalendarModule.forRoot({ provide: DateAdapter, useFactory: adapterFactory })
        ),
        provideRouter(
            ROUTES,
            withRouterConfig({ paramsInheritanceStrategy: 'always' }),
            withPreloading(PreloadAllModules)
        ),
        provideHttpClient(withInterceptors([corsInterceptor])),
        provideAnimations(),
        {
            provide: MAT_DATE_LOCALE,
            useValue: enUS
        },
        provideToastr({
            closeButton: true,
            positionClass: 'toast-top-right',
            progressAnimation: 'increasing',
            progressBar: true,
            timeOut: 5000
        }),
        {
            provide: MAT_DIALOG_DEFAULT_OPTIONS,
            useValue: {
                minWidth: 440,
                maxWidth: '80vw',
                panelClass: 'dialog-size',
                width: 'clamp(var(--min-dialog-width), var(--preffered-dialog-width), var(--max-dialog-width))'
            } satisfies MatDialogConfig
        },
        {
            provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
            useValue: {
                floatLabel: 'auto',
                appearance: 'outline'
            } satisfies MatFormFieldDefaultOptions
        }
    ]
}).catch((err) => console.error(err));
