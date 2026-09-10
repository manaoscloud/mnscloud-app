import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { PageShellComponent } from './page-shell';

@Component({
  selector: 'mns-settings-page',
  standalone: true,
  imports: [PageShellComponent, MatButtonModule, MatIconModule, TranslocoPipe],
  template: `
    <mns-page-shell
      [title]="title()"
      [description]="description()"
      [loading]="loading()"
      [refreshDisabled]="dirty() || saving()"
      (refresh)="refresh.emit()"
    >
      <fieldset
        class="settings-page-fields"
        [disabled]="loading() || saving()"
        [attr.inert]="loading() || saving() ? '' : null"
      >
        <ng-content />
      </fieldset>
      <footer pageFooter class="settings-page-actions">
        <button
          mat-stroked-button
          type="button"
          [disabled]="!dirty() || saving() || loading()"
          (click)="cancel.emit()"
        >
          {{ 'Cancel' | transloco }}
        </button>
        <button
          mat-flat-button
          type="button"
          [disabled]="!dirty() || saving() || loading() || !valid()"
          (click)="save.emit()"
        >
          <mat-icon>save</mat-icon>{{ (saving() ? 'Saving...' : 'Save') | transloco }}
        </button>
        @if (error()) {
          <p class="settings-page-feedback" role="alert">{{ error() }}</p>
        }
        @if (success()) {
          <p class="settings-page-feedback" role="status">{{ success() | transloco }}</p>
        }
      </footer>
    </mns-page-shell>
  `,
})
export class SettingsPageComponent {
  readonly title = input.required<string>();
  readonly description = input('');
  readonly loading = input(false);
  readonly saving = input(false);
  readonly dirty = input(false);
  readonly valid = input(true);
  readonly error = input<string | null>(null);
  readonly success = input<string | null>(null);
  readonly refresh = output<void>();
  readonly save = output<void>();
  readonly cancel = output<void>();
}
