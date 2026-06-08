import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export type SlowConfirmDialogData = {
  title: string;
  message: string;
  confirmLabel?: string;
};

@Component({
  selector: 'app-slow-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <div mat-dialog-content>
      <p class="message">{{ data.message }}</p>
      <p class="hint" *ngIf="!ready()">Please wait a moment…</p>
    </div>
    <div mat-dialog-actions align="end">
      <button mat-stroked-button mat-dialog-close type="button">Cancel</button>
      <button mat-flat-button color="warn" type="button" [disabled]="!ready()" (click)="confirm()">
        {{ data.confirmLabel || 'Confirm' }}
      </button>
    </div>
  `,
})
export class SlowConfirmDialogComponent {
  readonly data = inject<SlowConfirmDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject<MatDialogRef<SlowConfirmDialogComponent>>(MatDialogRef);
  readonly ready = signal(false);

  constructor() {
    setTimeout(() => this.ready.set(true), 700);
  }

  confirm() {
    this.dialogRef.close(true);
  }
}
