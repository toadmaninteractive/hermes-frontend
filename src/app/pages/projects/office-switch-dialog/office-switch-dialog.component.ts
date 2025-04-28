import { ChangeDetectionStrategy, Component, Inject, OnDestroy, OnInit, Self } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatListModule, MatSelectionListChange } from '@angular/material/list';
import { MatInput } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AsyncPipe } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { map, takeUntil } from 'rxjs/operators';
import { InlineSVGModule } from 'ng-inline-svg-2';
import { BehaviorSubject, Subject } from 'rxjs';
import { OverlayService } from '../../../core/services/overlay.service';
import { Office } from '../../../protocol/db-protocol';
import { HermesOfficeService } from '../../../protocol/web-office-protocol.service';
import { OfficeData } from '../../../shared/interfaces/dialog-data.interface';
import { CountryFlagComponent } from '../../../components/country-flag/country-flag.component';
import { FilterService } from '../../../core/services/filter.service';

@Component({
    templateUrl: 'office-switch-dialog.component.html',
    styleUrls: ['office-switch-dialog.component.scss'],
    standalone: true,
    imports: [
        MatInput,
        MatListModule,
        InlineSVGModule,
        AsyncPipe,
        MatFormFieldModule,
        MatIconModule,
        MatButtonModule,
        CountryFlagComponent,
        MatDialogModule,
        ReactiveFormsModule
    ],
    providers: [FilterService],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class OfficeSwitchDialogComponent implements OnInit, OnDestroy {
    destroy$ = new Subject<void>();
    filteredOffices$ = new BehaviorSubject<Office[]>(null);
    offices: Office[] = [];

    filterControl = this.filterService.filterControl;
    needle$ = this.filterService.needle$;

    constructor(
        public dialogRef: MatDialogRef<OfficeSwitchDialogComponent>,
        private hermesOfficeService: HermesOfficeService,
        private overlayService: OverlayService,
        @Inject(MAT_DIALOG_DATA) public data: OfficeData,
        @Self()
        private filterService: FilterService
    ) {}

    ngOnInit(): void {
        this.needle$.pipe(takeUntil(this.destroy$)).subscribe(({ needle }) => {
            const filtered = needle
                ? this.offices.filter((office) => office.name.toLowerCase().includes(needle))
                : [...this.offices];

            this.filteredOffices$.next(filtered);
        });
        this.hermesOfficeService
            .getOffices()
            .pipe(
                map((collection) => collection.items),
                takeUntil(this.destroy$)
            )
            .subscribe((offices) => {
                this.offices = offices;
                this.filteredOffices$.next(offices);
            });

        this.overlayService.isDialogDisplayed$.next(true);
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.filteredOffices$.complete();
        this.overlayService.isDialogDisplayed$.next(false);
    }

    select(office: MatSelectionListChange) {
        this.dialogRef.close(office.options.at(0).value);
    }
}
