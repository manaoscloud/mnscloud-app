import { Component, computed, inject, resource, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

import { PageShellComponent } from '../../../shared/pages/page-shell';
import { ApiService } from '../../../services/api.service';
import { SnackbarService } from '../../../services/snackbar.service';
import {
  GlobalTableComponent,
  defineGlobalTable,
} from '../../../shared/crud/configurable-crud/global-table';

export interface AnatelReportItem {
  [key: string]: unknown;
  CodigoMunicipio: string;
  TipoPessoa: 'F' | 'J';
  Tecnologia: string;
  FaixaVelocidade: string;
  QuantidadeAcessos: number;
}

export interface AnatelSummaryData {
  items: AnatelReportItem[];
  totalAcessos: number;
  year: number;
  month: number;
}

@Component({
  selector: 'app-isp-anatel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    TranslocoPipe,
    PageShellComponent,
    GlobalTableComponent,
  ],
  template: `
    <mns-page-shell
      [title]="'isp.anatel.title'"
      [description]="'isp.anatel.description'"
      [loading]="loading()"
      (refresh)="refreshSummary()"
    >
      <div style="padding: 1.5rem 0;">
        <!-- Filters and Actions Card -->
        <mat-card appearance="outlined" style="padding: 1.5rem; margin-bottom: 1.5rem;">
          <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem;">
            <div style="display: flex; gap: 1rem; align-items: center;">
              <mat-form-field appearance="outline" style="width: 140px;">
                <mat-label>{{ 'isp.anatel.year' | transloco }}</mat-label>
                <mat-select [ngModel]="selectedYear()" (ngModelChange)="selectedYear.set($event)">
                  @for (y of years; track y) {
                    <mat-option [value]="y">{{ y }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" style="width: 160px;">
                <mat-label>{{ 'isp.anatel.month' | transloco }}</mat-label>
                <mat-select [ngModel]="selectedMonth()" (ngModelChange)="selectedMonth.set($event)">
                  @for (m of months; track m.value) {
                    <mat-option [value]="m.value">{{ m.label }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <button mat-stroked-button (click)="refreshSummary()" [disabled]="loading()">
                <mat-icon>refresh</mat-icon>
                {{ 'Refresh' | transloco }}
              </button>
            </div>

            <div>
              <button
                mat-flat-button
                color="primary"
                [disabled]="loading() || exporting()"
                (click)="exportCsv()"
              >
                <mat-icon>download</mat-icon>
                {{ 'isp.anatel.exportCsv' | transloco }}
              </button>
            </div>
          </div>
        </mat-card>

        <!-- Summary KPIs -->
        @if (summary(); as data) {
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
            <mat-card appearance="outlined" style="padding: 1.25rem;">
              <span style="font-size: 0.85rem; color: #666;">{{ 'isp.anatel.totalAccesses' | transloco }}</span>
              <h2 style="margin: 0.5rem 0 0 0; font-size: 2rem; color: var(--mat-sys-primary, #006a6a);">
                {{ data.totalAcessos | number }}
              </h2>
            </mat-card>

            <mat-card appearance="outlined" style="padding: 1.25rem;">
              <span style="font-size: 0.85rem; color: #666;">{{ 'isp.anatel.byPersonType' | transloco }}</span>
              <div style="margin-top: 0.5rem; font-size: 0.95rem;">
                <div>PF: <strong>{{ getCountByPerson('F') | number }}</strong></div>
                <div>PJ: <strong>{{ getCountByPerson('J') | number }}</strong></div>
              </div>
            </mat-card>

            <mat-card appearance="outlined" style="padding: 1.25rem;">
              <span style="font-size: 0.85rem; color: #666;">{{ 'isp.anatel.period' | transloco }}</span>
              <h3 style="margin: 0.5rem 0 0 0;">
                {{ selectedMonth() }}/{{ selectedYear() }}
              </h3>
            </mat-card>
          </div>

          <!-- Breakdown Table -->
          <mat-card appearance="outlined" style="padding: 1.5rem;">
            <h3 style="margin: 0 0 1rem 0;">{{ 'isp.anatel.breakdownTitle' | transloco }}</h3>
            <mns-global-table [config]="anatelTable" [rows]="items()" [loading]="loading()" />
          </mat-card>
        }
      </div>
    </mns-page-shell>
  `,
})
export class IspAnatelPage {
  private readonly api = inject(ApiService);
  private readonly snackbar = inject(SnackbarService);

  readonly exporting = signal(false);

  readonly currentYear = new Date().getFullYear();
  readonly years = [
    this.currentYear,
    this.currentYear - 1,
    this.currentYear - 2,
    this.currentYear - 3,
  ];

  readonly months = [
    { value: 1, label: '01 - Janeiro' },
    { value: 2, label: '02 - Fevereiro' },
    { value: 3, label: '03 - Março' },
    { value: 4, label: '04 - Abril' },
    { value: 5, label: '05 - Maio' },
    { value: 6, label: '06 - Junho' },
    { value: 7, label: '07 - Julho' },
    { value: 8, label: '08 - Agosto' },
    { value: 9, label: '09 - Setembro' },
    { value: 10, label: '10 - Outubro' },
    { value: 11, label: '11 - Novembro' },
    { value: 12, label: '12 - Dezembro' },
  ];

  readonly selectedYear = signal(this.currentYear);
  readonly selectedMonth = signal(new Date().getMonth() + 1);

  readonly summaryResource = resource({
    params: () => ({ year: this.selectedYear(), month: this.selectedMonth() }),
    loader: async ({ params }) => {
      const res = await this.api.get<{ status: string; data: AnatelSummaryData }>(
        `isp/anatel/summary?year=${params.year}&month=${params.month}`,
      );
      return res.data;
    },
  });

  readonly summary = computed(() => this.summaryResource.value() ?? null);
  readonly items = computed(() => this.summary()?.items ?? []);
  readonly loading = computed(() => this.exporting() || this.summaryResource.isLoading());

  readonly anatelTable = defineGlobalTable({
    ['key']: 'isp/anatel/breakdown',
    uuidField: 'CodigoMunicipio',
    emptyLabel: 'isp.anatel.noData',
    columns: [
      { id: 'municipality', label: 'isp.anatel.colMunicipality', field: 'CodigoMunicipio' },
      { id: 'personType', label: 'isp.anatel.colPersonType', field: 'TipoPessoa' },
      { id: 'technology', label: 'isp.anatel.colTechnology', field: 'Tecnologia' },
      { id: 'speed', label: 'isp.anatel.colSpeed', field: 'FaixaVelocidade' },
      { id: 'accesses', label: 'isp.anatel.colAccesses', field: 'QuantidadeAcessos', kind: 'number' },
    ],
  });

  refreshSummary() {
    this.summaryResource.reload();
  }

  getCountByPerson(type: 'F' | 'J'): number {
    const items = this.summary()?.items ?? [];
    return items
      .filter((i) => i.TipoPessoa === type)
      .reduce((acc, curr) => acc + curr.QuantidadeAcessos, 0);
  }

  async exportCsv() {
    this.exporting.set(true);
    try {
      const year = this.selectedYear();
      const month = this.selectedMonth();
      const blob = await this.api.getBlob(
        `isp/anatel/export?year=${year}&month=${month}`,
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `anatel_dici_${year}_${String(month).padStart(2, '0')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      this.snackbar.success('Relatório SCM exportado com sucesso.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao exportar CSV da Anatel.';
      this.snackbar.error(msg);
    } finally {
      this.exporting.set(false);
    }
  }
}
