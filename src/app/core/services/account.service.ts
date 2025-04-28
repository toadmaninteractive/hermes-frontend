import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { filter, finalize, switchMap, tap } from 'rxjs/operators';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { Constants } from '../../shared/constants/constants';
import { HermesAuthService } from '../../protocol/web-auth-protocol.service';
import * as CommonProtocol from '../../protocol/common-protocol';
import * as DataProtocol from '../../protocol/data-protocol';
import * as DbProtocol from '../../protocol/db-protocol';
import * as WebProtocol from '../../protocol/web-protocol';
import { PersonnelLoginResponse, PersonnelStatusResponse } from '../../protocol/web-protocol';

@Injectable({
    providedIn: 'root'
})
export class AccountService {
    private isInitializing$ = new BehaviorSubject(true);
    private isSignedIn$ = new BehaviorSubject<boolean | null>(null);
    isSigningIn$ = new BehaviorSubject(false);
    profile$ = new BehaviorSubject<DbProtocol.PersonnelAccount | null>(null);
    isSuperAdmin$ = new BehaviorSubject<boolean>(false);
    isOfficeManager$ = new BehaviorSubject<boolean>(false);

    constructor(
        private router: Router,
        private hermesAuthService: HermesAuthService
    ) {
        this.initialize();
    }

    private initialize(): void {
        if (!this.isInitializing$.getValue()) {
            this.isInitializing$.next(true);
        }

        this.hermesAuthService
            .getPersonnelStatus()
            .pipe(
                switchMap((response: PersonnelStatusResponse) =>
                    response.loggedIn ? this.hermesAuthService.getMyPersonnelProfile() : of(null)
                ),
                finalize(() => this.isInitializing$.next(false))
            )
            .subscribe((profile: DbProtocol.PersonnelAccount | null) => {
                this.profile$.next(profile);
                this.isSignedIn$.next(profile instanceof DbProtocol.PersonnelAccount);

                if (profile) {
                    this.isSuperAdmin$.next(profile.isSuperadmin);
                    this.isOfficeManager$.next(profile.isOfficeManager);
                }
            });
    }

    private reset(): void {
        this.isSignedIn$.next(false);
        this.profile$.next(null);
        this.router.navigate([Constants.loginUrl]);
    }

    isSignedIn(): Observable<boolean> {
        return this.isSignedIn$.pipe(filter((value) => value !== null));
    }

    signIn(
        username: string,
        password: string
    ): Observable<DbProtocol.PersonnelAccount | WebProtocol.PersonnelLoginResponse> {
        if (this.isSigningIn$.getValue()) {
            return this.profile$;
        }

        this.isSigningIn$.next(true);

        const request = new WebProtocol.PersonnelLoginRequest();
        request.username = username;
        request.password = password;

        return this.hermesAuthService.loginPersonnel(request).pipe(
            switchMap((response: PersonnelLoginResponse) =>
                response.result ? this.hermesAuthService.getMyPersonnelProfile() : of(response)
            ),
            tap((profile) => {
                if (profile instanceof DbProtocol.PersonnelAccount) {
                    // Success
                    this.profile$.next(profile);
                    this.isSignedIn$.next(true);
                } else {
                    // Failure
                    this.profile$.next(null);
                }
            }),
            finalize(() => this.isSigningIn$.next(false))
        );
    }

    signOut(): Observable<DataProtocol.GenericResponse> {
        return this.hermesAuthService.logoutPersonnel(new CommonProtocol.Empty()).pipe(
            tap((response: DataProtocol.GenericResponse) => {
                console.log(`Sign out ${response.result ? 'successful' : 'failure'}`);
                this.reset();
            })
        );
    }
}
