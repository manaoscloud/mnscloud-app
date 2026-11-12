import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';

import { ApiService } from '../../../../services/api.service';
import { ReportProblemButtonComponent } from '../../../../shared/support-report-dialog/report-problem-button';

export type AdoptionCandidate = {
  vmid: string;
  name: string;
  node: string;
  status: string | null;
  cpu: number | null;
  memoryMb: number | null;
  diskGb: number | null;
  placementGroup: string | null;
  agentUUID: string | null;
  agentName: string | null;
};

export type AdoptVmsDialogData = {
  providerUUID: string;
};

type AdoptionResult = {
  adopted: unknown[];
  failed: { vmid: string; message: string }[];
};

/**
 * Platform VMs created directly on Proxmox are linked to platform server rows. Adoption never
 * touches the VM (API FA3); closes with `true` when something was adopted.
 */
@Component({
  selector: 'app-hosting-vps-adopt-vms-dialog',
  standalone: true,
  imports: [
    ReportProblemButtonComponent,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslocoPipe,
  ],
  template: `
    <div class="adopt-dialog">
      <div class="dialog-header">
        <div>
          <h2>{{ 'Adopt existing VMs' | transloco }}</h2>
          <p>
            {{
              'Platform VMs created outside the platform (names mns-...). Adoption only links them: the platform never changes, powers off or deletes an adopted VM, and removing the server only unlinks it.'
                | transloco
            }}
          </p>
        </div>
        <mns-report-problem-button />
      </div>

      <mat-dialog-content class="adopt-content">
        @if (loading()) {
          <div class="adopt-state"><mat-spinner diameter="28" /></div>
        } @else if (loadError()) {
          <p class="adopt-state adopt-error">{{ loadError() }}</p>
        } @else if (!candidates().length && !result()) {
          <p class="adopt-state">{{ 'No VM to adopt.' | transloco }}</p>
        } @else {
          @if (candidates().length) {
            <div class="adopt-helpers">
              <button mat-button type="button" (click)="selectAll()" [disabled]="busy()">
                {{ 'Select all' | transloco }}
              </button>
              <button mat-button type="button" (click)="clear()" [disabled]="busy()">
                {{ 'Clear' | transloco }}
              </button>
            </div>
            <ul class="adopt-list">
              @for (item of candidates(); track item.vmid) {
                <li>
                  <mat-checkbox
                    [checked]="selected().has(item.vmid)"
                    [disabled]="busy()"
                    (change)="toggle(item.vmid, $event.checked)"
                  >
                    <span class="adopt-name">{{ item.name }}</span>
                  </mat-checkbox>
                  <small class="adopt-meta">
                    {{ item.node }} · {{ specLabel(item) }}
                    @if (item.placementGroup) {
                      · {{ item.placementGroup }}
                    }
                    ·
                    @if (item.agentName) {
                      {{ item.agentName }}
                    } @else {
                      {{ 'No Agent' | transloco }}
                    }
                  </small>
                </li>
              }
            </ul>
          }
          @if (result(); as summary) {
            <div class="adopt-result">
              @if (summary.adopted.length) {
                <p>
                  {{ '{n} VM(s) adopted' | transloco: { n: summary.adopted.length } }}
                </p>
              }
              @for (failure of summary.failed; track failure.vmid) {
                <p class="adopt-error">{{ failure.vmid }}: {{ failure.message }}</p>
              }
            </div>
          }
        }
        @if (submitError()) {
          <p class="adopt-error">{{ submitError() }}</p>
        }
      </mat-dialog-content>

      <mat-dialog-actions class="adopt-actions">
        <button mat-stroked-button type="button" (click)="close()" [disabled]="busy()">
          {{ 'Close' | transloco }}
        </button>
        <button
          mat-flat-button
          color="primary"
          type="button"
          (click)="adopt()"
          [disabled]="!selected().size || busy() || loading()"
        >
          <mat-icon>move_to_inbox</mat-icon>
          {{ 'Adopt selected ({n})' | transloco: { n: selected().size } }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: `
    .adopt-dialog {
      padding: 1.25rem 1.5rem 1rem;
      box-sizing: border-box;
    }
    .adopt-content {
      display: grid !important;
      gap: 0.75rem;
      max-height: min(60vh, 520px);
      overflow: auto;
      margin: 0 !important;
      padding: 0 0.15rem !important;
    }
    .adopt-state {
      display: flex;
      justify-content: center;
      padding: 1.5rem 0;
      margin: 0;
    }
    .adopt-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.5rem;
    }
    .adopt-name {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    .adopt-meta {
      display: block;
      margin-left: 2.5rem;
      color: var(--mat-sys-color-on-surface-variant);
    }
    .adopt-error {
      color: var(--mat-sys-color-error);
      margin: 0;
    }
    .adopt-result p {
      margin: 0.25rem 0;
    }
    .adopt-actions {
      display: flex;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 1rem 0 0 !important;
    }
  `,
})
export class AdoptVmsDialogComponent {
  private readonly data = inject<AdoptVmsDialogData>(MAT_DIALOG_DATA);
  private readonly api = inject(ApiService);
  private readonly dialogRef = inject(MatDialogRef<AdoptVmsDialogComponent, boolean>);
  private readonly endpoint = `system/hosting/vps/providers/${this.data.providerUUID}/adoption`;

  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly submitError = signal('');
  readonly busy = signal(false);
  readonly candidates = signal<AdoptionCandidate[]>([]);
  readonly selected = signal<ReadonlySet<string>>(new Set());
  readonly result = signal<AdoptionResult | null>(null);
  private readonly adoptedSomething = computed(() => (this.result()?.adopted.length ?? 0) > 0);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set('');
    try {
      const response = await this.api.get<{ data?: { items?: AdoptionCandidate[] } }>(
        this.endpoint,
      );
      const items = response?.data?.items ?? [];
      this.candidates.set(items);
      this.selected.set(new Set(items.filter((item) => item.agentUUID).map((item) => item.vmid)));
    } catch (error) {
      this.loadError.set(errorText(error));
    } finally {
      this.loading.set(false);
    }
  }

  specLabel(item: AdoptionCandidate): string {
    const parts: string[] = [];
    if (item.cpu != null) parts.push(`${item.cpu} vCPU`);
    if (item.memoryMb != null) parts.push(`${item.memoryMb} MB`);
    if (item.diskGb != null) parts.push(`${item.diskGb} GB`);
    return parts.join(' / ') || '-';
  }

  toggle(vmid: string, checked: boolean): void {
    const next = new Set(this.selected());
    if (checked) next.add(vmid);
    else next.delete(vmid);
    this.selected.set(next);
  }

  selectAll(): void {
    this.selected.set(new Set(this.candidates().map((item) => item.vmid)));
  }

  clear(): void {
    this.selected.set(new Set());
  }

  async adopt(): Promise<void> {
    const vmids = [...this.selected()];
    if (!vmids.length || this.busy()) return;
    this.busy.set(true);
    this.submitError.set('');
    try {
      const response = await this.api.post<{ data?: Partial<AdoptionResult> }>(this.endpoint, {
        vmids,
      });
      const adopted = response?.data?.adopted ?? [];
      const failed = response?.data?.failed ?? [];
      this.result.set({ adopted, failed });
      const failedIds = new Set(failed.map((item) => item.vmid));
      // Adopted VMs leave the list; failed ones stay selected for another try.
      this.candidates.update((items) =>
        items.filter((item) => failedIds.has(item.vmid) || !vmids.includes(item.vmid)),
      );
      this.selected.set(new Set(vmids.filter((vmid) => failedIds.has(vmid))));
    } catch (error) {
      this.submitError.set(errorText(error));
    } finally {
      this.busy.set(false);
    }
  }

  close(): void {
    this.dialogRef.close(this.adoptedSomething());
  }
}

function errorText(error: unknown): string {
  const maybe = error as { error?: { error?: string; message?: string }; message?: string };
  return maybe?.error?.error ?? maybe?.error?.message ?? maybe?.message ?? 'Operation failed.';
}
