import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MonthPickerComponent } from '../../components/month-picker/month-picker.component';

@Component({
    selector: 'app-dashboard',
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.scss'],
    standalone: true,
    imports: [MonthPickerComponent],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent {
    month?: Date = null;
    selectedDate = new Date(2022, 5, 1);

    setMonth(month: Date): void {
        this.month = month;
    }
}
