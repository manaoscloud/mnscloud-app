import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { openCrudComponentDialog } from '../dialog/crud-dialog.util';
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
}

/** Opens an image blob in the preview dialog; the dialog owns and revokes its object URL. */
export function openImagePreview(dialog: MatDialog, blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const binding = openCrudComponentDialog(
    dialog,
    FilePreviewDialogComponent,
    'crud-form-dialog',
    {
      data: { fileName, url } satisfies FilePreviewDialogData,
    },
  );
  void firstValueFrom(binding.ref.afterClosed()).finally(() => {
    binding.stop();
    URL.revokeObjectURL(url);
  });
}

