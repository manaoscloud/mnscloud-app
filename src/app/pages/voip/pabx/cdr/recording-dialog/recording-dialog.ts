import { CommonModule } from '@angular/common';
import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

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
  imports: [CommonModule, MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './recording-dialog.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./recording-dialog.scss'],
})
export class VoipPabxCdrRecordingDialogComponent {
  constructor(
    private readonly dialogRef: MatDialogRef<VoipPabxCdrRecordingDialogComponent>,
    @Inject(MAT_DIALOG_DATA) readonly data: VoipPabxCdrRecordingDialogData,
  ) {}

  close() {
    this.dialogRef.close();
  }

  formatDate(value: string | null | undefined) {
    return value ? new Date(value).toLocaleString() : '-';
  }
}
