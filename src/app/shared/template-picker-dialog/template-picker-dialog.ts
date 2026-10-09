import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

import { openCrudComponentDialog } from '../dialog/crud-dialog.util';
import { ReportProblemButtonComponent } from '../support-report-dialog/report-problem-button';

export type TemplatePickerMeta = { icon: string; label: string; value?: string };

/** `label` is a Transloco key; `detail` is shown as given (it may contain `{{placeholders}}`). */
export type TemplatePickerStep = { label: string; detail?: string };

export type TemplatePickerItem = {
  id: string;
  /** Name, description and category are Transloco keys (English source text). */
  name: string;
  description: string;
  category?: string;
  meta?: TemplatePickerMeta[];
  steps?: TemplatePickerStep[];
};

export type TemplatePickerDialogData = {
  title: string;
  description?: string;
  items: TemplatePickerItem[];
  emptyLabel?: string;
  useLabel?: string;
};

/**
 * Shared picker for resource templates: searchable cards with metadata and an
 * ordered step preview inside the standard CRUD dialog surface. Returns the
 * selected item id, or undefined when closed.
 */
@Component({
  selector: 'mns-template-picker-dialog',
  standalone: true,
  imports: [
    ReportProblemButtonComponent,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslocoPipe,
  ],
  templateUrl: './template-picker-dialog.html',
  styleUrl: './template-picker-dialog.scss',
})
export class TemplatePickerDialogComponent {
  readonly data = inject<TemplatePickerDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<TemplatePickerDialogComponent>);
  private readonly transloco = inject(TranslocoService);

  readonly search = signal('');
  readonly items = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) return this.data.items;
    return this.data.items.filter((item) =>
      [item.name, item.description, item.category ?? '']
        .flatMap((text) => [text, text ? this.transloco.translate(text) : ''])
        .some((text) => text.toLowerCase().includes(term)),
    );
  });

  choose(item: TemplatePickerItem): void {
    this.dialogRef.close(item.id);
  }

  close(): void {
    this.dialogRef.close();
  }
}

export async function openTemplatePickerDialog(
  dialog: MatDialog,
  data: TemplatePickerDialogData,
): Promise<string | undefined> {
  const binding = openCrudComponentDialog(
    dialog,
    TemplatePickerDialogComponent,
    'crud-form-dialog',
    {
      data,
    },
  );
  try {
    return (await firstValueFrom(binding.ref.afterClosed())) as string | undefined;
  } finally {
    binding.stop();
  }
}
