import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { CdkColumnDef } from '@angular/cdk/table';
import { InlineSVGModule } from 'ng-inline-svg-2';

@Component({
    selector: 'app-prompts-dialog',
    templateUrl: './prompts-dialog.component.html',
    styleUrls: ['./prompts-dialog.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    providers: [CdkColumnDef],
    imports: [
        InlineSVGModule,
        MatButtonModule,
        MatIconModule,
        MatTableModule,
        MatDialogModule,
        MatMenuModule
    ]
})
export class PromptsDialogComponent {
    isDialogOpen = false;

    public toggleDialogVisibility(state: boolean): void {
        this.isDialogOpen = state;
    }
}
