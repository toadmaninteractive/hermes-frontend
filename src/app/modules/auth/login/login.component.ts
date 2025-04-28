import {
    ChangeDetectorRef,
    Component,
    OnDestroy,
    OnInit,
    ChangeDetectionStrategy
} from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NgClass, AsyncPipe } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { take, takeUntil, tap } from 'rxjs/operators';
import { BehaviorSubject, Subject } from 'rxjs';
import { AccountService } from '../../../core/services/account.service';
import { StorageService } from '../../../core/services/storage.service';
import { PersonnelAccount } from '../../../protocol/db-protocol';
import { PersonnelLoginError, PersonnelLoginResponse } from '../../../protocol/web-protocol';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-login',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss'],
    standalone: true,
    imports: [
        FormsModule,
        ReactiveFormsModule,
        NgClass,
        AsyncPipe,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatProgressSpinnerModule
    ]
})
export class LoginComponent implements OnInit, OnDestroy {
    private destroy$ = new Subject<void>();
    isLoading$ = new BehaviorSubject(false);

    defaultAuth = {
        username: '',
        email: '',
        password: ''
    };

    loginForm = this.fb.group({
        username: [this.defaultAuth.username, Validators.required],
        password: [this.defaultAuth.password, Validators.required]
    });

    hasError: boolean;
    returnUrl: string;

    signInError?: string = null;

    constructor(
        private fb: FormBuilder,
        private route: ActivatedRoute,
        private router: Router,
        private cdr: ChangeDetectorRef,
        private accountService: AccountService,
        private storageService: StorageService
    ) {}

    // convenience getter for easy access to form fields
    get f() {
        return this.loginForm.controls;
    }

    ngOnInit(): void {
        // get return url from route parameters or default to '/'
        this.returnUrl = this.route.snapshot.queryParams['returnUrl'.toString()] || '/';
    }

    submit() {
        this.hasError = false;

        this.signInError = null;
        this.cdr.detectChanges();
        this.isLoading$.next(true);

        this.accountService
            .signIn(this.f.username.value, this.f.password.value)
            .pipe(
                tap(() => this.isLoading$.next(false)),
                take(1),
                takeUntil(this.destroy$)
            )
            .subscribe((response: PersonnelAccount | PersonnelLoginResponse) => {
                if (response instanceof PersonnelAccount) {
                    const storedRoute = this.storageService.getStoredRoute();
                    if (storedRoute) {
                        this.storageService.resetStoredRoute();
                        this.router.navigateByUrl(storedRoute);
                    } else {
                        this.router.navigate(['/projects']);
                    }
                    this.hasError = false;
                } else {
                    let message = 'Unpredicted error happened';

                    switch (response.error) {
                        case PersonnelLoginError.Failure:
                            message = 'Internal server error, try again later';
                            break;
                        case PersonnelLoginError.AlreadyLoggedIn:
                            message = 'Already logged in, reload this page';
                            break;
                        case PersonnelLoginError.AccountNotExists:
                            message = 'Account does not exist';
                            break;
                        case PersonnelLoginError.AccountIsBlocked:
                            message = 'Account blocked, contact sysadmin';
                            break;
                        case PersonnelLoginError.AccountIsDeleted:
                            message = 'Account has been deleted, sorry about it';
                            break;
                        case PersonnelLoginError.WrongPassword:
                        case PersonnelLoginError.InvalidPassword:
                            message = 'Invalid credentials';
                            break;
                    }

                    this.signInError = message;
                }
            });
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }
}
