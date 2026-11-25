import { Component, computed, inject, resource, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { TranslocoPipe } from '@jsverse/transloco';

import { PageShellComponent } from '../../../shared/pages/page-shell';
import { ApiService } from '../../../services/api.service';
import { SnackbarService } from '../../../services/snackbar.service';
import {
  GlobalTableComponent,
  defineGlobalTable,
} from '../../../shared/crud/configurable-crud/global-table';

export interface LegalRecordQueryResult {
  found: boolean;
  resolvedIpType: 'cgnat' | 'public_direct';
  targetPublicIp: string;
  targetPort: number;
  targetTimestamp: string;
  resolvedPrivateIp?: string | null;
  portRange?: { start: number; end: number } | null;
  cgnatProfileName?: string | null;
  subscriber?: {
    subscriptionUUID: string;
    subscriptionID: string;
    customerUUID: string;
    customerName: string;
    customerDocument: string | null;
    customerPhone: string | null;
    customerEmail: string | null;
    installationAddress: {
      street: string | null;
      number: string | null;
      city: string | null;
      municipalityCode: string | null;
      zip: string | null;
    };
    contractID: string | null;
    planName: string;
    framedIp: string | null;
    accessUsername: string | null;
  } | null;
  audit: {
    uuid: string;
    queriedAt: string;
    courtDocumentNumber: string;
    reason: string;
    exportHash: string;
  };
}

export interface LegalRecordAuditItem {
  [key: string]: unknown;
  IlaUUID: string;
  IlaUserUUID: string;
  IlaQueriedAt: string;
  IlaPublicIp: string;
  IlaPort: number;
  IlaTargetTimestamp: string;
  IlaReason: string;
  IlaCourtDocumentNumber: string;
  IlaResultFound: number;
  IlaResultSubscriberUUID: string | null;
  IlaExportHash: string;
}

@Component({
  selector: 'app-isp-legal-records',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTabsModule,
    MatChipsModule,
    TranslocoPipe,
    PageShellComponent,
    GlobalTableComponent,
  ],
  template: `
    <mns-page-shell
      [title]="'isp.legalRecords.title'"
      [description]="'isp.legalRecords.description'"
      [loading]="loading()"
      (refresh)="onRefresh()"
    >
      <mat-tab-group>
        <!-- Tab 1: Judicial Query -->
        <mat-tab [label]="'isp.legalRecords.queryTab' | transloco">
          <div style="padding: 1.5rem 0;">
            <mat-card appearance="outlined" style="padding: 1.5rem; margin-bottom: 1.5rem;">
              <header style="margin-bottom: 1.25rem;">
                <h3 style="margin: 0 0 0.5rem 0;">{{ 'isp.legalRecords.formTitle' | transloco }}</h3>
                <p style="margin: 0; color: var(--mat-sys-outline, #666); font-size: 0.9rem;">
                  {{ 'isp.legalRecords.legalNotice' | transloco }}
                </p>
              </header>

              <form (ngSubmit)="submitQuery()" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem;">
                <mat-form-field appearance="outline">
                  <mat-label>{{ 'isp.legalRecords.publicIp' | transloco }}</mat-label>
                  <input
                    matInput
                    type="text"
                    required
                    placeholder="e.g. 203.0.113.1"
                    [(ngModel)]="publicIp"
                    name="publicIp"
                  />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>{{ 'isp.legalRecords.port' | transloco }}</mat-label>
                  <input
                    matInput
                    type="number"
                    min="1"
                    max="65535"
                    required
                    placeholder="e.g. 45000"
                    [(ngModel)]="port"
                    name="port"
                  />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>{{ 'isp.legalRecords.timestamp' | transloco }}</mat-label>
                  <input
                    matInput
                    type="datetime-local"
                    step="1"
                    required
                    [(ngModel)]="timestamp"
                    name="timestamp"
                  />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>{{ 'isp.legalRecords.documentNumber' | transloco }}</mat-label>
                  <input
                    matInput
                    type="text"
                    required
                    placeholder="e.g. Ofício 123/2026 - 1ª Vara Criminal"
                    [(ngModel)]="documentNumber"
                    name="documentNumber"
                  />
                </mat-form-field>

                <mat-form-field appearance="outline" style="grid-column: 1 / -1;">
                  <mat-label>{{ 'isp.legalRecords.reason' | transloco }}</mat-label>
                  <textarea
                    matInput
                    rows="3"
                    required
                    placeholder="Detalhes da ordem judicial / autoridade requisitante..."
                    [(ngModel)]="reason"
                    name="reason"
                  ></textarea>
                </mat-form-field>

                <div style="grid-column: 1 / -1; display: flex; justify-content: flex-end;">
                  <button
                    mat-flat-button
                    color="primary"
                    type="submit"
                    [disabled]="submitting() || !canSubmit()"
                  >
                    <mat-icon>search</mat-icon>
                    {{ 'isp.legalRecords.searchButton' | transloco }}
                  </button>
                </div>
              </form>
            </mat-card>

            <!-- Query Result Card -->
            @if (result(); as res) {
              <mat-card
                appearance="outlined"
                [style.border-color]="res.found ? 'var(--mat-sys-primary, #006a6a)' : 'var(--mat-sys-error, #ba1a1a)'"
                style="padding: 1.5rem; margin-bottom: 1.5rem; background: var(--mat-sys-surface-container-low, #fcfcfc);"
              >
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                  <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <mat-icon [style.color]="res.found ? 'green' : 'crimson'">
                      {{ res.found ? 'check_circle' : 'warning' }}
                    </mat-icon>
                    <h3 style="margin: 0;">
                      {{ (res.found ? 'isp.legalRecords.foundTitle' : 'isp.legalRecords.notFoundTitle') | transloco }}
                    </h3>
                  </div>
                  <span style="font-size: 0.85rem; color: var(--mat-sys-outline, #777);">
                    Tipo IP: <strong>{{ res.resolvedIpType }}</strong>
                  </span>
                </div>

                @if (res.found && res.subscriber) {
                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
                    <div>
                      <p style="margin: 0 0 0.25rem 0; font-size: 0.85rem; color: #666;">{{ 'isp.legalRecords.subscriber' | transloco }}</p>
                      <strong>{{ res.subscriber.customerName }}</strong>
                      <div style="font-size: 0.85rem; color: #555;">
                        {{ res.subscriber.customerDocument || 'N/A' }}
                      </div>
                    </div>

                    <div>
                      <p style="margin: 0 0 0.25rem 0; font-size: 0.85rem; color: #666;">{{ 'isp.legalRecords.contract' | transloco }}</p>
                      <div>Assinatura: <strong>{{ res.subscriber.subscriptionID }}</strong></div>
                      <div style="font-size: 0.85rem; color: #555;">Plano: {{ res.subscriber.planName }}</div>
                    </div>

                    <div>
                      <p style="margin: 0 0 0.25rem 0; font-size: 0.85rem; color: #666;">{{ 'isp.legalRecords.contact' | transloco }}</p>
                      <div>{{ res.subscriber.customerPhone || 'N/A' }}</div>
                      <div style="font-size: 0.85rem; color: #555;">{{ res.subscriber.customerEmail || 'N/A' }}</div>
                    </div>

                    <div>
                      <p style="margin: 0 0 0.25rem 0; font-size: 0.85rem; color: #666;">{{ 'isp.legalRecords.address' | transloco }}</p>
                      <div>{{ res.subscriber.installationAddress.street }}, {{ res.subscriber.installationAddress.number }}</div>
                      <div style="font-size: 0.85rem; color: #555;">
                        {{ res.subscriber.installationAddress.city }} - CEP {{ res.subscriber.installationAddress.zip }}
                      </div>
                    </div>

                    @if (res.resolvedPrivateIp) {
                      <div>
                        <p style="margin: 0 0 0.25rem 0; font-size: 0.85rem; color: #666;">{{ 'isp.legalRecords.cgnatMapping' | transloco }}</p>
                        <div>IP Privado: <code>{{ res.resolvedPrivateIp }}</code></div>
                        @if (res.portRange) {
                          <div style="font-size: 0.85rem; color: #555;">
                            Portas: {{ res.portRange.start }} - {{ res.portRange.end }}
                          </div>
                        }
                      </div>
                    }
                  </div>
                } @else {
                  <p style="color: var(--mat-sys-error, #ba1a1a); margin: 0 0 1rem 0;">
                    {{ 'isp.legalRecords.noSubscriberMatch' | transloco }}
                  </p>
                }

                <div style="padding-top: 1rem; border-top: 1px solid #e0e0e0; font-size: 0.8rem; color: #666; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.5rem;">
                  <div>
                    UUID Auditoria: <code>{{ res.audit.uuid }}</code>
                  </div>
                  <div>
                    Hash de Autenticidade (SHA-256): <code>{{ res.audit.exportHash }}</code>
                  </div>
                </div>
              </mat-card>
            }
          </div>
        </mat-tab>

        <!-- Tab 2: Audit Trail -->
        <mat-tab [label]="'isp.legalRecords.auditTab' | transloco">
          <div style="padding: 1.5rem 0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <h3 style="margin: 0;">{{ 'isp.legalRecords.auditHistoryTitle' | transloco }}</h3>
              <button mat-stroked-button (click)="refreshAudits()">
                <mat-icon>refresh</mat-icon>
                {{ 'Refresh' | transloco }}
              </button>
            </div>

            <mns-global-table [config]="auditTable" [rows]="audits()" [loading]="loading()" />
          </div>
        </mat-tab>
      </mat-tab-group>
    </mns-page-shell>
  `,
})
export class IspLegalRecordsPage {
  private readonly api = inject(ApiService);
  private readonly snackbar = inject(SnackbarService);

  readonly submitting = signal(false);
  readonly result = signal<LegalRecordQueryResult | null>(null);

  readonly auditResource = resource({
    loader: async () => {
      const res = await this.api.get<{ status: string; data: { items: LegalRecordAuditItem[] } }>(
        'isp/legal-records/audits?limit=50',
      );
      return res.data?.items ?? [];
    },
  });

  readonly audits = computed(() => this.auditResource.value() ?? []);
  readonly loading = computed(() => this.submitting() || this.auditResource.isLoading());

  readonly auditTable = defineGlobalTable({
    key: 'isp/legal-records/audits',
    uuidField: 'IlaUUID',
    emptyLabel: 'isp.legalRecords.noAudits',
    columns: [
      { id: 'queriedAt', label: 'isp.legalRecords.queriedAt', field: 'IlaQueriedAt' },
      { id: 'targetIp', label: 'isp.legalRecords.publicIp', field: 'IlaPublicIp' },
      { id: 'targetPort', label: 'isp.legalRecords.port', field: 'IlaPort', kind: 'number' },
      { id: 'targetTimestamp', label: 'isp.legalRecords.targetTimestamp', field: 'IlaTargetTimestamp' },
      { id: 'documentNumber', label: 'isp.legalRecords.documentNumber', field: 'IlaCourtDocumentNumber' },
      { id: 'reason', label: 'isp.legalRecords.reason', field: 'IlaReason' },
      { id: 'result', label: 'isp.legalRecords.result', field: 'IlaResultFound' },
      { id: 'hash', label: 'isp.legalRecords.hash', field: 'IlaExportHash' },
    ],
  });

  publicIp = '';
  port: number | null = null;
  timestamp = '';
  documentNumber = '';
  reason = '';

  canSubmit(): boolean {
    return Boolean(
      this.publicIp.trim() &&
        this.port &&
        this.port >= 1 &&
        this.port <= 65535 &&
        this.timestamp &&
        this.documentNumber.trim() &&
        this.reason.trim(),
    );
  }

  async submitQuery() {
    if (!this.canSubmit()) return;

    this.submitting.set(true);
    try {
      const res = await this.api.post<{ status: string; data: LegalRecordQueryResult }>(
        'isp/legal-records/query',
        {
          publicIp: this.publicIp.trim(),
          port: Number(this.port),
          timestamp: new Date(this.timestamp).toISOString(),
          documentNumber: this.documentNumber.trim(),
          reason: this.reason.trim(),
        },
      );
      this.result.set(res.data);
      this.snackbar.success('Consulta registrada no log de auditoria com sucesso.');
      this.auditResource.reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao consultar registro legal.';
      this.snackbar.error(msg);
    } finally {
      this.submitting.set(false);
    }
  }

  refreshAudits() {
    this.auditResource.reload();
  }

  onRefresh() {
    this.auditResource.reload();
  }
}
