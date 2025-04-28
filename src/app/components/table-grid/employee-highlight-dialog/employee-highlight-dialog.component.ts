import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    Inject,
    OnDestroy,
    OnInit,
    ViewChild
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { MatOption } from '@angular/material/core';
import { UntypedFormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteTrigger, MatAutocomplete } from '@angular/material/autocomplete';
import { MatChipGrid, MatChipRow, MatChipRemove, MatChipInput } from '@angular/material/chips';
import { MatFormField } from '@angular/material/form-field';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AsyncPipe } from '@angular/common';
import {
    debounceTime,
    distinctUntilChanged,
    filter,
    map,
    startWith,
    take,
    takeUntil,
    tap
} from 'rxjs/operators';
import { BehaviorSubject, combineLatest, Subject } from 'rxjs';
import { CacheService } from '../../../core/services/cache.service';
import { NotificationService } from '../../../core/services/notification.service';
import { CreateHighlightRequest } from '../../../protocol/web-protocol';
import { Highlight, PersonnelAccount } from '../../../protocol/db-protocol';
import { HermesEmployeeService } from '../../../protocol/web-employee-protocol.service';
import { HermesHighlightService } from '../../../protocol/highlight-protocol.service';

export interface HighlightDialogData {
    employee: PersonnelAccount;
    projectId: number;
}

@Component({
    selector: 'app-cell-edit-dialog',
    templateUrl: 'employee-highlight-dialog.component.html',
    styleUrls: ['employee-highlight-dialog.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        CdkScrollable,
        MatFormField,
        MatChipGrid,
        MatChipRow,
        MatChipRemove,
        FormsModule,
        MatAutocompleteTrigger,
        MatChipInput,
        ReactiveFormsModule,
        MatAutocomplete,
        MatOption,
        AsyncPipe,
        MatDialogModule,
        MatButtonModule,
        MatIconModule
    ]
})
export class EmployeeHighlightDialogComponent implements OnInit, OnDestroy {
    @ViewChild('highlightInput') highlightInput: ElementRef<HTMLInputElement>;
    destroy$ = new Subject<void>();
    employee$ = new BehaviorSubject<PersonnelAccount>(null);
    highlights$ = new BehaviorSubject<Highlight[]>([]);
    filteredHighlights$ = new BehaviorSubject<Highlight[]>(null);
    refresh$ = new BehaviorSubject<boolean>(false);

    highlightInputCtrl = new UntypedFormControl();
    selectedHighlights: Highlight[] = [];
    separatorKeysCodes: number[] = [ENTER, COMMA];

    constructor(
        public dialogRef: MatDialogRef<EmployeeHighlightDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: HighlightDialogData,
        private cacheService: CacheService,
        private highlightService: HermesHighlightService,
        private employeeService: HermesEmployeeService,
        private notificationService: NotificationService
    ) {}

    ngOnInit(): void {
        this.cacheService.highlights$
            .asObservable()
            .pipe(
                takeUntil(this.destroy$),
                map((collection) =>
                    collection.sort((a, b) =>
                        a.title.toLowerCase() > b.title.toLowerCase() ? 1 : -1
                    )
                )
            )
            .subscribe((res) => {
                this.highlights$.next(res);
            });

        this.employee$.next(this.data.employee);
        if (this.data.employee.highlights[this.data.projectId]) {
            this.selectedHighlights = [...this.data.employee.highlights[this.data.projectId]];
        }

        combineLatest([
            this.highlightInputCtrl.valueChanges.pipe(takeUntil(this.destroy$), startWith('')),
            this.highlights$.asObservable(),
            this.employee$.asObservable(),
            this.refresh$.asObservable()
        ])
            .pipe(
                takeUntil(this.destroy$),
                distinctUntilChanged(),
                debounceTime(250),
                filter(([, highlights, employee]) => highlights.length && Boolean(employee))
            )
            .subscribe(([changes, highlights, employee]) => {
                let filteredHighlights = highlights;
                filteredHighlights = filteredHighlights.filter(
                    (h) => !this.selectedHighlights.find((sh) => sh.id === h.id)
                );
                if (employee.highlights[this.data.projectId]?.length) {
                    filteredHighlights = filteredHighlights.filter(
                        (item) =>
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-return
                            !employee.highlights[this.data.projectId]
                                .map((elem) => elem.title)
                                .includes(item.title)
                    );
                }

                if (typeof changes === 'string') {
                    filteredHighlights = filteredHighlights.filter((item) =>
                        item.title.toLowerCase().includes(changes.toLowerCase())
                    );
                }
                this.filteredHighlights$.next(filteredHighlights);
            });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    closeDialog(): void {
        this.dialogRef.close(this.selectedHighlights);
    }

    createHighlight(name: string): void {
        const request = new CreateHighlightRequest();
        request.title = name;
        request.code = name.toLowerCase().replace(' ', '.');
        this.highlightService
            .createHighlight(request)
            .pipe(
                takeUntil(this.destroy$),
                take(1),
                tap((res) => this.notificationService.success(`New ${res.title} highlight created`))
            )
            .subscribe((res) => {
                this.highlightInput.nativeElement.value = '';
                this.highlightInputCtrl.setValue('');
                this.selectedHighlights.push(res);
                this.cacheService.reloadHighlights();
            });
    }

    addHighlight(option: MatOption, filteredHighlights: Highlight[]): void {
        this.selectedHighlights.push(filteredHighlights.find((h) => h.id === option.value));
    }

    onRemove(employeeId: number, highlights: Highlight[], highlightCode: string): void {
        const index = this.selectedHighlights.findIndex((h) => h.code === highlightCode);
        if (index !== undefined && index !== -1) {
            this.selectedHighlights.splice(index, 1);
            this.refresh$.next(true);
        }
    }
}
