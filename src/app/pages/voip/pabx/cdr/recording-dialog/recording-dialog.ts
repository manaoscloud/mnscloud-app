import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

import { DateTimeFormatService } from '../../../../../services/date-time-format.service';

export type VoipPabxCdrRecordingDialogData = {
  url: string;
  filename: string;
  title?: string | null;
  subtitle?: string | null;
  showCallSummary?: boolean | null;
  engine?: string | null;
  pabxName?: string | null;
  callerNumber?: string | null;
  destinationNumber?: string | null;
  startedAt?: string | null;
};

@Component({
  selector: 'app-voip-pabx-cdr-recording-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './recording-dialog.html',
  styleUrls: ['./recording-dialog.scss'],
})
export class VoipPabxCdrRecordingDialogComponent {
  private readonly dialogRef =
    inject<MatDialogRef<VoipPabxCdrRecordingDialogComponent>>(MatDialogRef);
  private readonly dateTime = inject(DateTimeFormatService);
  readonly data = inject<VoipPabxCdrRecordingDialogData>(MAT_DIALOG_DATA);

  close() {
    this.dialogRef.close();
  }

  formatDate(value: string | null | undefined) {
    return this.dateTime.formatDateTime(value) || '-';
  }
}
