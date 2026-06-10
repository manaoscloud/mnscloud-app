import { Component, DestroyRef, inject, signal, ChangeDetectionStrategy } from '@angular/core';

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
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <div mat-dialog-content>
      <p class="message">{{ data.message }}</p>
      @if (!ready()) {
        <p class="hint">Please wait a moment…</p>
      }
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
  private readonly destroyRef = inject(DestroyRef);
  private readyTimer: ReturnType<typeof setTimeout> | null = null;
  readonly ready = signal(false);

  constructor() {
    this.readyTimer = setTimeout(() => {
      this.readyTimer = null;
      this.ready.set(true);
    }, 700);
    this.destroyRef.onDestroy(() => this.clearReadyTimer());
  }

  confirm() {
    this.dialogRef.close(true);
  }

  private clearReadyTimer() {
    if (!this.readyTimer) return;
    clearTimeout(this.readyTimer);
    this.readyTimer = null;
  }
}
