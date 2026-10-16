import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ApiService } from '../../../services/api.service';
import { DashboardPageComponent } from '../../../shared/dashboard/dashboard-page';
import {
  type DashboardRecord,
  DashboardRecordListComponent,
} from '../../../shared/dashboard/dashboard-record-list';
import { dashboardResource } from '../../../shared/dashboard/dashboard-resource';
import { aiFeatureLabel } from '../ai-features/ai-features';
import { aiProviderKindLabel } from '../ai-providers/ai-providers';

/** Window of the dashboard (fixed: stated in the panel descriptions). */
export const AI_DASHBOARD_DAYS = 30;

export type AiUsageGroup = {
  feature: string;
  providerName: string | null;
  providerKind: string;
  model: string;
  calls: number;
  errors: number;
  inputTokens: number;
  outputTokens: number;
  cacheHitRate: number;
  cacheSavingsUsd: number | null;
  avgLatencyMs: number | null;
  lastCallAt: string | null;
  estimatedCostUsd: number | null;
  costPerCallUsd: number | null;
};

export type AiUsageTip = {
  code: string;
  severity: 'warning' | 'saving' | 'info';
  feature: string;
  model: string;
  params: Record<string, string | number>;
  savingUsd: number | null;
};

export type AiUsageSummary = {
  days: number;
  priceCatalogDate: string;
  totals: {
    calls: number;
    errors: number;
    errorRate: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
    costCoverage: number;
    avgLatencyMs: number | null;
    cacheHitRate: number;
    cacheSavingsUsd: number;
  };
  groups: AiUsageGroup[];
  tips: AiUsageTip[];
};

/** USD with cents, or a few more digits for sub-cent amounts. */
export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const digits = value !== 0 && Math.abs(value) < 0.01 ? 4 : 2;
  return `US$ ${value.toFixed(digits)}`;
}

/** Compact token count (1.2k, 3.4M). */
export function formatTokens(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

const TIP_TONE: Record<AiUsageTip['severity'], DashboardRecord['tone']> = {
  warning: 'danger',
  saving: 'running',
  info: 'skipped',
};
const TIP_STATUS: Record<AiUsageTip['severity'], string> = {
  warning: 'Attention',
  saving: 'Saving',
  info: 'Information',
};

/** Settings › AI › Dashboard: AI usage, estimated cost and where to save, from the usage log. */
@Component({
  selector: 'app-ai-dashboard',
  standalone: true,
  imports: [DashboardPageComponent, DashboardRecordListComponent, RouterLink, TranslocoPipe],
  templateUrl: './ai-dashboard.html',
})
export class AiDashboardPage {
  private readonly api = inject(ApiService);
  private readonly transloco = inject(TranslocoService);

  readonly dashboard = dashboardResource({
    defaultValue: null as AiUsageSummary | null,
    loader: async () => {
      const response = await this.api.get<{ data: AiUsageSummary }>(
        `system/ai/usage/summary?days=${AI_DASHBOARD_DAYS}`,
        { timeout: 30000 },
      );
      return response.data;
    },
  });

  readonly metrics = computed(() => {
    const totals = this.dashboard.value()?.totals;
    return [
      { label: 'Calls', value: totals ? String(totals.calls) : '—', hint: '' },
      {
        label: 'Estimated cost',
        value: totals ? formatUsd(totals.estimatedCostUsd) : '—',
        hint:
          totals && totals.costCoverage < 1
            ? 'Some models have no catalog price'
            : 'List prices; the provider invoice prevails',
      },
      {
        label: 'Tokens (input / output)',
        value: totals
          ? `${formatTokens(totals.inputTokens)} / ${formatTokens(totals.outputTokens)}`
          : '—',
        hint: '',
      },
      {
        label: 'Error rate',
        value: totals ? `${(totals.errorRate * 100).toFixed(1)}%` : '—',
        hint: totals ? `${totals.errors}` : '',
      },
      {
        label: 'Average latency',
        value: totals?.avgLatencyMs != null ? `${(totals.avgLatencyMs / 1000).toFixed(1)} s` : '—',
        hint: '',
      },
      {
        label: 'Saved with prompt cache',
        value: totals ? formatUsd(totals.cacheSavingsUsd) : '—',
        hint: totals
          ? `${(totals.cacheHitRate * 100).toFixed(0)}% ${this.t('of input from cache')}`
          : '',
      },
    ];
  });

  readonly consumption = computed<DashboardRecord[]>(() =>
    (this.dashboard.value()?.groups ?? []).map((group) => {
      const errorRate = group.calls ? group.errors / group.calls : 0;
      return {
        id: `${group.feature}:${group.model}:${group.providerName ?? ''}`,
        name: this.t(aiFeatureLabel(group.feature)),
        meta: `${group.providerName ?? this.t(aiProviderKindLabel(group.providerKind))} · ${group.model}`,
        status: errorRate >= 0.05 ? 'With errors' : 'Healthy',
        tone: errorRate >= 0.05 ? 'danger' : 'success',
        details: [
          { label: 'Calls', value: String(group.calls) },
          { label: 'Estimated cost', value: formatUsd(group.estimatedCostUsd) },
          { label: 'Cost per call', value: formatUsd(group.costPerCallUsd) },
          {
            label: 'Tokens (input / output)',
            value: `${formatTokens(group.inputTokens)} / ${formatTokens(group.outputTokens)}`,
          },
          {
            label: 'Average latency',
            value: group.avgLatencyMs != null ? `${(group.avgLatencyMs / 1000).toFixed(1)} s` : '—',
          },
          {
            label: 'Prompt cache',
            value: `${(group.cacheHitRate * 100).toFixed(0)}% · ${formatUsd(group.cacheSavingsUsd)}`,
          },
          { label: 'Last call', value: group.lastCallAt ?? '', format: 'datetime' },
        ],
      };
    }),
  );

  readonly improvements = computed<DashboardRecord[]>(() =>
    (this.dashboard.value()?.tips ?? []).map((tip, index) => ({
      id: `${tip.code}:${tip.feature}:${tip.model}:${index}`,
      name: this.t(`aiTip.${tip.code}`, { ...tip.params, model: tip.model }),
      meta: `${this.t(aiFeatureLabel(tip.feature))} · ${tip.model}`,
      status: TIP_STATUS[tip.severity],
      tone: TIP_TONE[tip.severity],
      details: tip.savingUsd
        ? [{ label: 'Estimated saving', value: formatUsd(tip.savingUsd) }]
        : [],
    })),
  );

  private t(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(key, params);
  }
}
