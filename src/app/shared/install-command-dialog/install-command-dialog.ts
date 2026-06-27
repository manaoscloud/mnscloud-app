import { ClipboardModule } from '@angular/cdk/clipboard';
import { Component, computed, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

export type InstallCommandDetail = {
  label: string;
  value: unknown;
  monospace?: boolean;
};

export type InstallCommandDialogData = {
  title: string;
  description: string;
  warning: string;
  command: string;
  details?: InstallCommandDetail[];
};

@Component({
  selector: 'mns-install-command-dialog',
  standalone: true,
  imports: [ClipboardModule, MatButtonModule, MatDialogModule, MatIconModule, TranslocoPipe],
  templateUrl: './install-command-dialog.html',
  styleUrl: './install-command-dialog.scss',
})
export class InstallCommandDialogComponent {
  private readonly data = inject<InstallCommandDialogData | null>(MAT_DIALOG_DATA, {
    optional: true,
  });

  readonly titleInput = input<string | null>(null, { alias: 'title' });
  readonly descriptionInput = input<string | null>(null, { alias: 'description' });
  readonly warningInput = input<string | null>(null, { alias: 'warning' });
  readonly commandInput = input<string | null>(null, { alias: 'command' });
  readonly detailsInput = input<InstallCommandDetail[] | null>(null, { alias: 'details' });
  readonly copied = output<boolean>();

  readonly titleText = computed(() => this.titleInput() ?? this.data?.title ?? '');
  readonly descriptionText = computed(
    () => this.descriptionInput() ?? this.data?.description ?? '',
  );
  readonly warningText = computed(() => this.warningInput() ?? this.data?.warning ?? '');
  readonly commandText = computed(() => this.commandInput() ?? this.data?.command ?? '');
  readonly detailItems = computed(() => this.detailsInput() ?? this.data?.details ?? []);
  readonly visibleDetails = computed(() =>
    this.detailItems().filter(
      (detail) => detail.value !== null && detail.value !== undefined && `${detail.value}` !== '',
    ),
  );

  notifyCopied(copied: boolean): void {
    this.copied.emit(copied);
  }
}
