import { Component, input, output } from '@angular/core';
import { PageShellComponent } from './page-shell';

@Component({
  selector: 'mns-detail-page',
  standalone: true,
  imports: [PageShellComponent],
  template: `
    <mns-page-shell
      [title]="title()"
      [description]="description()"
      [identity]="identity()"
      [recordId]="recordId()"
      [loading]="loading()"
      (refresh)="refresh.emit()"
    >
      <ng-content />
    </mns-page-shell>
  `,
})
export class DetailPageComponent {
  readonly title = input.required<string>();
  readonly description = input('');
  readonly identity = input('');
  readonly recordId = input('');
  readonly loading = input(false);
  readonly refresh = output<void>();
}
