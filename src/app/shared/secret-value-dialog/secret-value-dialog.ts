import { Component, inject, signal, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslocoPipe } from '@jsverse/transloco';

export interface SecretValueDialogData {
  save: (value: string, idempotencyKey: string) => Promise<void>;
}
@Component({
  selector: 'mns-secret-value-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    TranslocoPipe,
  ],
  template: ` <div class="crud-dialog">
    <header class="dialog-header">
      <div>
        <h2>{{ 'Set secret value' | transloco }}</h2>
        <p>{{ 'The value is stored after the queued operation completes.' | transloco }}</p>
      </div>
    </header>
    <mat-dialog-content class="dialog-content">
      <mat-tab-group class="form-tabs"
        ><mat-tab [label]="'Record' | transloco">
          <div class="tab-content">
            <div class="form-grid">
              <mat-form-field appearance="outline" class="span-4">
                <mat-label>{{ 'Secret value' | transloco }}</mat-label>
                <textarea
                  matInput
                  [ngModel]="value()"
                  (ngModelChange)="change($event)"
                  [disabled]="saving()"
                  rows="12"
                  maxlength="32768"
                  autocomplete="off"
                  autocapitalize="off"
                  [spellcheck]="false"
                ></textarea>
              </mat-form-field>
            </div>
          </div> </mat-tab
      ></mat-tab-group>
    </mat-dialog-content>
    <mat-dialog-actions class="form-actions">
      <div class="secondary-actions">
        <button mat-stroked-button type="button" [disabled]="saving()" (click)="close()">
          {{ 'Cancel' | transloco }}
        </button>
      </div>
      <div class="primary-actions">
        <div class="save-split-action is-single-action">
          <button mat-flat-button type="button" [disabled]="saving() || !value()" (click)="save()">
            <mat-icon>save</mat-icon>{{ 'Save' | transloco }}
          </button>
        </div>
      </div>
    </mat-dialog-actions>
  </div>`,
})
export class SecretValueDialogComponent implements OnDestroy {
  private readonly data = inject<SecretValueDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<SecretValueDialogComponent>);
  readonly value = signal('');
  readonly saving = signal(false);
  private idempotencyKey = crypto.randomUUID();
  change(value: string) {
    this.value.set(value);
    this.idempotencyKey = crypto.randomUUID();
  }
  close() {
    if (!this.saving()) {
      this.value.set('');
      this.ref.close();
    }
  }
  async save() {
    if (this.saving() || !this.value()) return;
    this.saving.set(true);
    try {
      await this.data.save(this.value(), this.idempotencyKey);
      this.value.set('');
      this.ref.close(true);
    } catch {
      /* The API interceptor reports failure; retain this intent ID for a safe retry. */
    } finally {
      this.saving.set(false);
    }
  }
  ngOnDestroy() {
    this.value.set('');
  }
}
