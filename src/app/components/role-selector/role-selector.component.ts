import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    OnDestroy,
    OnInit,
    Output
} from '@angular/core';
import { MatDivider } from '@angular/material/divider';
import { MatOption } from '@angular/material/core';
import { MatSelect, MatSelectTrigger } from '@angular/material/select';
import { MatFormField } from '@angular/material/form-field';
import { AsyncPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { map, takeUntil } from 'rxjs/operators';
import { BehaviorSubject, Subject } from 'rxjs';
import { StorageService } from '../../core/services/storage.service';
import { Role } from '../../protocol/db-protocol';
import { HermesRoleService } from '../../protocol/role-protocol.service';

@Component({
    selector: 'app-role-selector',
    templateUrl: './role-selector.component.html',
    styleUrls: ['./role-selector.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatFormField,
        MatSelect,
        MatSelectTrigger,
        MatOption,
        MatDivider,
        AsyncPipe,
        MatIconModule
    ]
})
export class RoleSelectorComponent implements OnInit, OnDestroy {
    @Input() set role(value: Role | 'all' | 'unassigned') {
        if (value) {
            this.role$.next(value);
        }
    }

    @Input() section: string;
    @Input() username: string;
    @Output() readonly roleChange = new EventEmitter<Role | 'all' | 'unassigned'>();
    destroy$ = new Subject<void>();
    roles$ = new BehaviorSubject<Role[]>([]);
    role$ = new BehaviorSubject<Role | 'all' | 'unassigned'>('all');

    constructor(
        private hermesRoleService: HermesRoleService,
        private storageService: StorageService
    ) {}

    ngOnInit(): void {
        this.hermesRoleService
            .getRoles()
            .pipe(
                takeUntil(this.destroy$),
                map((collection) => collection.items)
            )
            .subscribe((roles) => {
                this.roles$.next(roles);
            });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.roles$.complete();
        this.role$.complete();
    }

    onSelectionChange(value: Role | 'all' | 'unassigned'): void {
        this.role$.next(value);
        this.roleChange.emit(value);
        if (this.username) {
            const config = JSON.parse(this.storageService.getStoredConfig(this.username)) || {};
            config[this.section].role = value instanceof Role ? value.id : value;
            this.storageService.setStoredConfig(this.username, JSON.stringify(config));
        }
    }

    compare(option: Role | 'all' | 'unassigned', value: Role | 'all' | 'unassigned'): boolean {
        if (typeof option === 'string' || typeof value === 'string') {
            return option === value;
        }
        return option.id === value.id;
    }
}
