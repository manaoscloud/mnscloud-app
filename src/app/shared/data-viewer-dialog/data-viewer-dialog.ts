import { ClipboardModule } from '@angular/cdk/clipboard';
import { Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

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
  download?: {
    filename: string;
    label?: string;
    mimeType?: string;
  };
};

export type DataViewerTableColumn = {
  key: string;
  label: string;
  monospace?: boolean;
  translate?: boolean;
  kind?: 'text' | 'download';
  filenameKey?: string;
  actionLabel?: string;
};

export type DataViewerTable = {
  columns: readonly DataViewerTableColumn[];
  rows: readonly Record<string, unknown>[];
  emptyLabel?: string;
};

export type DataViewerSection = {
  title: string;
  details?: readonly DataViewerDetail[];
  table?: DataViewerTable;
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
      .filter((section) => section.details.length || section.table || section.code),
  );

  statusTone(status: DataViewerStatus): DataViewerTone {
    return status.tone ?? 'neutral';
  }

  detailValue(detail: DataViewerDetail): string {
    return this.displayValue(detail.value);
  }

  tableValue(value: unknown): string {
    return this.displayValue(value);
  }

  tableDownloadUrl(row: Record<string, unknown>, column: DataViewerTableColumn): string {
    return String(row[column.key] ?? '').trim();
  }

  tableDownloadFilename(row: Record<string, unknown>, column: DataViewerTableColumn): string {
    const value = column.filenameKey ? row[column.filenameKey] : null;
    return this.safeFilename(String(value ?? 'mnscloud-diagnostic-capture'));
  }

  codeText(block: DataViewerCodeBlock): string {
    if (block.format === 'json') return this.formatJson(block.value);
    return this.displayValue(block.value);
  }

  notifyCopied(copied: boolean): void {
    copied ? this.snack.success('Data copied.') : this.snack.error('Failed to copy data.');
  }

  downloadCode(block: DataViewerCodeBlock): void {
    if (!block.download) return;
    try {
      const blob = new Blob([this.codeText(block)], {
        type: block.download.mimeType ?? this.mimeTypeFor(block),
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = this.safeFilename(block.download.filename);
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      this.snack.success('Data downloaded.');
    } catch {
      this.snack.error('Failed to download data.');
    }
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
    try {
      return this.formatReadableJson(this.parseJsonLike(value), 0);
    } catch {
      return String(value);
    }
  }

  private parseJsonLike(value: unknown): unknown {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return this.normalizeLogText(value);
    try {
      return JSON.parse(trimmed);
    } catch {
      return this.normalizeLogText(value);
    }
  }

  private formatReadableJson(value: unknown, depth: number): string {
    if (value === null) return 'null';
    if (value === undefined) return '-';
    if (typeof value === 'string') return this.formatReadableString(value, depth);
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return this.formatReadableArray(value, depth);
    if (typeof value === 'object') return this.formatReadableObject(value, depth);
    return JSON.stringify(String(value));
  }

  private formatReadableArray(values: unknown[], depth: number): string {
    if (!values.length) return '[]';
    const indent = this.indent(depth);
    const childIndent = this.indent(depth + 1);
    return [
      '[',
      values
        .map(
          (value) =>
            `${childIndent}${this.formatReadableJson(this.parseJsonLike(value), depth + 1)}`,
        )
        .join(',\n'),
      `${indent}]`,
    ].join('\n');
  }

  private formatReadableObject(value: object, depth: number): string {
    const entries = Object.entries(value as Record<string, unknown>);
    if (!entries.length) return '{}';
    const indent = this.indent(depth);
    const childIndent = this.indent(depth + 1);
    return [
      '{',
      entries
        .map(([key, item]) => {
          const formatted = this.formatReadableJson(this.parseJsonLike(item), depth + 1);
          return `${childIndent}${JSON.stringify(key)}: ${formatted}`;
        })
        .join(',\n'),
      `${indent}}`,
    ].join('\n');
  }

  private formatReadableString(value: string, depth: number): string {
    const normalized = this.normalizeLogText(value);
    if (!normalized.includes('\n')) return JSON.stringify(normalized);

    const indent = this.indent(depth);
    const childIndent = this.indent(depth + 1);
    const lines = normalized.split('\n').map((line) => `${childIndent}${line}`);
    return ['<<<', ...lines, `${indent}>>>`].join('\n');
  }

  private normalizeLogText(value: string): string {
    return value
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '  ');
  }

  private indent(depth: number): string {
    return '  '.repeat(depth);
  }

  private mimeTypeFor(block: DataViewerCodeBlock): string {
    if (block.format === 'json') return 'application/json;charset=utf-8';
    if (block.format === 'shell') return 'text/x-shellscript;charset=utf-8';
    return 'text/plain;charset=utf-8';
  }

  private safeFilename(filename: string): string {
    const normalized = filename
      .trim()
      .replace(/[^\w.\-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return normalized || 'mnscloud-data.txt';
  }
}

export function openDataViewerDialog(
  dialog: MatDialog,
  data: DataViewerDialogData,
): CrudDialogBinding {
  const binding = openCrudTemplateDialog(dialog, DataViewerDialogComponent, 'crud-form-dialog', {
    data,
  });
  void firstValueFrom(binding.ref.afterClosed()).finally(binding.stop);
  return binding;
}
