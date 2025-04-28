import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatDivider } from '@angular/material/divider';
import { MatOption } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { AsyncPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { StorageService } from '../../core/services/storage.service';
import { Office } from '../../protocol/db-protocol';
import { CacheService } from '../../core/services/cache.service';
import { CountryFlagPipe } from '../country-flag/country-flag.pipe';
import { CountryFlagComponent } from '../country-flag/country-flag.component';

@Component({
    selector: 'app-office-selector',
    templateUrl: './office-selector.component.html',
    styleUrls: ['./office-selector.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatFormFieldModule,
        MatSelectModule,
        MatOption,
        MatDivider,
        AsyncPipe,
        CountryFlagPipe,
        CountryFlagComponent,
        MatIconModule
    ]
})
export class OfficeSelectorComponent {
    @Input() username: string;
    @Input() section: string;
    @Input() noCache = false;
    @Input() hideCommonOptions = false;

    @Input() set office(value: Office | string) {
        this.cacheService.selectedOffice$.next(value);
    }

    @Output() readonly officeChanged = new EventEmitter<Office | string>();

    constructor(
        public cacheService: CacheService,
        private storageService: StorageService
    ) {}

    onOfficeChange(office: Office | string): void {
        if (!this.noCache) {
            this.cacheService.selectedOffice$.next(office);
        }

        this.officeChanged.emit(office);
        if (this.username) {
            const config = JSON.parse(this.storageService.getStoredConfig(this.username)) || {};
            config[this.section]['office_id'] = office instanceof Office ? office.id : office;
            this.storageService.setStoredConfig(this.username, JSON.stringify(config));
        }
    }
}
