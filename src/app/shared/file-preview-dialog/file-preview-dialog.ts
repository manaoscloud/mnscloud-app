import { Component, DestroyRef, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { ReportProblemButtonComponent } from '../support-report-dialog/report-problem-button';

export type FilePreviewDialogData = {
  fileName: string;
  /** Object URL owned by the dialog; it is revoked when the dialog closes. */
  url: string;
};

/**
 * Shows a private image inside the App. Opening it in a browser tab replaced the App with a
 * `blob:` page that looks like a frozen screen (screenshots are pictures of the App) and breaks on
 * reload once the object URL is revoked.
 */
@Component({
  selector: 'mns-file-preview-dialog',
  standalone: true,
  imports: [
    ReportProblemButtonComponent,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    TranslocoPipe,
  ],
  templateUrl: './file-preview-dialog.html',
  styleUrl: './file-preview-dialog.scss',
})
export class FilePreviewDialogComponent {
  readonly data = inject<FilePreviewDialogData>(MAT_DIALOG_DATA);

  constructor() {
    inject(DestroyRef).onDestroy(() => URL.revokeObjectURL(this.data.url));
  }
}

/** Opens an image blob in the preview dialog; the dialog owns and revokes its object URL. */
export function openImagePreview(dialog: MatDialog, blob: Blob, fileName: string): void {
  dialog.open(FilePreviewDialogComponent, {
    panelClass: 'file-preview-dialog-panel',
    width: 'min(1200px, 96vw)',
    maxWidth: '96vw',
    maxHeight: '92vh',
    data: { fileName, url: URL.createObjectURL(blob) } satisfies FilePreviewDialogData,
  });
}
