import { ClipboardModule } from '@angular/cdk/clipboard';
import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

export type InstallCommandDetail = {
  label: string;
  value: unknown;
  monospace?: boolean;
};

@Component({
  selector: 'mns-install-command-dialog',
  standalone: true,
  imports: [ClipboardModule, MatButtonModule, MatDialogModule, MatIconModule, TranslocoPipe],
  templateUrl: './install-command-dialog.html',
  styleUrl: './install-command-dialog.scss',
})
export class InstallCommandDialogComponent {
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly warning = input.required<string>();
  readonly command = input.required<string>();
  readonly details = input<InstallCommandDetail[]>([]);
  readonly copied = output<boolean>();

  readonly visibleDetails = computed(() =>
    this.details().filter((detail) => detail.value !== null && detail.value !== undefined && `${detail.value}` !== ''),
  );

  notifyCopied(copied: boolean): void {
    this.copied.emit(copied);
  }
}
