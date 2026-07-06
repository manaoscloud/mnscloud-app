import { ClipboardModule } from '@angular/cdk/clipboard';
import { Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

import { SnackbarService } from '../../services/snackbar.service';
import { CrudDialogBinding, openCrudTemplateDialog } from '../dialog/crud-dialog.util';

export type DataViewerTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export type DataViewerStatus = {
  label?: string;
  value: string;
  tone?: DataViewerTone;
};

export type DataViewerDetail = {
  label: string;
  value: unknown;
  monospace?: boolean;
  wide?: boolean;
};

export type DataViewerCodeBlock = {
  title?: string;
  value: unknown;
  format?: 'json' | 'text' | 'shell';
  copy?: boolean;
};

export type DataViewerSection = {
  title: string;
  details?: readonly DataViewerDetail[];
  code?: DataViewerCodeBlock;
};

export type DataViewerDialogData = {
  title: string;
  description?: string;
  status?: DataViewerStatus;
  details?: readonly DataViewerDetail[];
  sections?: readonly DataViewerSection[];
  closeLabel?: string;
};

@Component({
  selector: 'mns-data-viewer-dialog',
  standalone: true,
  imports: [ClipboardModule, MatButtonModule, MatDialogModule, MatIconModule, TranslocoPipe],
  templateUrl: './data-viewer-dialog.html',
  styleUrl: './data-viewer-dialog.scss',
})
export class DataViewerDialogComponent {
  private readonly data = inject<DataViewerDialogData | null>(MAT_DIALOG_DATA, {
    optional: true,
  });
  private readonly snack = inject(SnackbarService);

  readonly dataInput = input<DataViewerDialogData | null>(null, { alias: 'data' });

  readonly viewerData = computed(() => this.dataInput() ?? this.data ?? { title: '' });
  readonly titleText = computed(() => this.viewerData().title);
  readonly descriptionText = computed(() => this.viewerData().description ?? '');
  readonly closeLabel = computed(() => this.viewerData().closeLabel ?? 'Close');
  readonly status = computed(() => this.viewerData().status ?? null);
  readonly details = computed(() => this.visibleDetails(this.viewerData().details ?? []));
  readonly sections = computed(() =>
    (this.viewerData().sections ?? [])
      .map((section) => ({
        ...section,
        details: this.visibleDetails(section.details ?? []),
      }))
      .filter((section) => section.details.length || section.code),
  );

  statusTone(status: DataViewerStatus): DataViewerTone {
    return status.tone ?? 'neutral';
  }

  detailValue(detail: DataViewerDetail): string {
    return this.displayValue(detail.value);
  }

  codeText(block: DataViewerCodeBlock): string {
    if (block.format === 'json') return this.formatJson(block.value);
    return this.displayValue(block.value);
  }

  notifyCopied(copied: boolean): void {
    copied ? this.snack.success('Data copied.') : this.snack.error('Failed to copy data.');
  }

  private visibleDetails(details: readonly DataViewerDetail[]): DataViewerDetail[] {
    return details.filter((detail) => {
      const value = detail.value;
      return value !== null && value !== undefined && String(value) !== '';
    });
  }

  private displayValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return this.formatJson(value);
  }

  private formatJson(value: unknown): string {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'string') {
      try {
        return JSON.stringify(JSON.parse(value), null, 2);
      } catch {
        return value;
      }
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
}

export function openDataViewerDialog(
  dialog: MatDialog,
  data: DataViewerDialogData,
): CrudDialogBinding {
  const binding = openCrudTemplateDialog(dialog, DataViewerDialogComponent, 'crud-form-dialog', {
    data,
  });
  const subscription = binding.ref.afterClosed().subscribe(() => {
    subscription.unsubscribe();
    binding.stop();
  });
  return binding;
}
