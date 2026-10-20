import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

import { openCrudComponentDialog } from '../dialog/crud-dialog.util';
import { ReportProblemButtonComponent } from '../support-report-dialog/report-problem-button';

/** Tab order and hidden tabs of a dashboard; two empty lists mean the default layout. */
export type DashboardLayout = { order: string[]; hidden: string[] };

export type DashboardLayoutDialogData = {
  /** Every tab in the current order; `label` is a Transloco key. */
  tabs: Array<{ key: string; label: string }>;
  hidden: string[];
};

/**
 * Reorders and hides dashboard tabs (App home). Up/down buttons instead of drag and drop, so it
 * works the same with keyboard, screen readers and touch. Returns the new layout, the default
 * layout (`{ order: [], hidden: [] }`) on reset, or undefined when cancelled.
 */
@Component({
  selector: 'mns-dashboard-layout-dialog',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    ReportProblemButtonComponent,
    TranslocoPipe,
  ],
  template: `
    <div class="crud-dialog dashboard-layout-dialog">
      <header class="dialog-header">
        <div>
          <h2>{{ 'home.layout.title' | transloco }}</h2>
          <p>{{ 'home.layout.description' | transloco }}</p>
        </div>
        <mns-report-problem-button />
      </header>

      <div class="dialog-content">
        <div class="dialog-scroll">
          <ol class="dashboard-layout-list">
            @for (tab of tabs(); track tab.key; let index = $index, first = $first, last = $last) {
              <li class="dashboard-layout-item" [class.is-hidden]="hidden().has(tab.key)">
                <mat-checkbox
                  [checked]="!hidden().has(tab.key)"
                  (change)="setVisible(tab.key, $event.checked)"
                  >{{ tab.label | transloco }}</mat-checkbox
                >
                <span class="dashboard-layout-moves">
                  <button
                    mat-icon-button
                    type="button"
                    [disabled]="first"
                    [attr.aria-label]="
                      'home.layout.move_up' | transloco: { name: (tab.label | transloco) }
                    "
                    (click)="move(index, -1)"
                  >
                    <mat-icon>arrow_upward</mat-icon>
                  </button>
                  <button
                    mat-icon-button
                    type="button"
                    [disabled]="last"
                    [attr.aria-label]="
                      'home.layout.move_down' | transloco: { name: (tab.label | transloco) }
                    "
                    (click)="move(index, 1)"
                  >
                    <mat-icon>arrow_downward</mat-icon>
                  </button>
                </span>
              </li>
            }
          </ol>
          <p class="dashboard-layout-note">{{ 'home.layout.note' | transloco }}</p>
        </div>
      </div>

      <div class="form-actions">
        <div class="secondary-actions">
          <button mat-stroked-button type="button" (click)="cancel()">
            {{ 'Cancel' | transloco }}
          </button>
          <button mat-stroked-button type="button" (click)="reset()">
            {{ 'home.layout.reset' | transloco }}
          </button>
        </div>
        <div class="primary-actions">
          <button mat-flat-button color="primary" type="button" (click)="save()">
            {{ 'Save' | transloco }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class DashboardLayoutDialogComponent {
  private readonly data = inject<DashboardLayoutDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<DashboardLayoutDialogComponent>);

  readonly tabs = signal([...this.data.tabs]);
  readonly hidden = signal(new Set(this.data.hidden));

  move(index: number, delta: -1 | 1): void {
    const tabs = [...this.tabs()];
    const target = index + delta;
    if (target < 0 || target >= tabs.length) return;
    [tabs[index], tabs[target]] = [tabs[target], tabs[index]];
    this.tabs.set(tabs);
  }

  setVisible(key: string, visible: boolean): void {
    const hidden = new Set(this.hidden());
    if (visible) hidden.delete(key);
    else hidden.add(key);
    this.hidden.set(hidden);
  }

  save(): void {
    const order = this.tabs().map((tab) => tab.key);
    this.dialogRef.close({ order, hidden: order.filter((key) => this.hidden().has(key)) });
  }

  reset(): void {
    this.dialogRef.close({ order: [], hidden: [] } satisfies DashboardLayout);
  }

  cancel(): void {
    this.dialogRef.close();
  }
}

export async function openDashboardLayoutDialog(
  dialog: MatDialog,
  data: DashboardLayoutDialogData,
): Promise<DashboardLayout | undefined> {
  const binding = openCrudComponentDialog(
    dialog,
    DashboardLayoutDialogComponent,
    'crud-form-dialog',
    {
      data,
    },
  );
  try {
    return (await firstValueFrom(binding.ref.afterClosed())) as DashboardLayout | undefined;
  } finally {
    binding.stop();
  }
}

/** Tabs in the saved order (unknown tabs keep the default order after them), hidden ones removed. */
export function applyDashboardLayout<T extends { key: string }>(
  tabs: T[],
  layout: DashboardLayout,
): { ordered: T[]; visible: T[] } {
  const rank = new Map(layout.order.map((key, index) => [key, index]));
  const ordered = tabs
    .map((tab, index) => ({ tab, index }))
    .sort(
      (a, b) =>
        (rank.get(a.tab.key) ?? layout.order.length + a.index) -
        (rank.get(b.tab.key) ?? layout.order.length + b.index),
    )
    .map((item) => item.tab);
  const hidden = new Set(layout.hidden);
  return { ordered, visible: ordered.filter((tab) => !hidden.has(tab.key)) };
}
