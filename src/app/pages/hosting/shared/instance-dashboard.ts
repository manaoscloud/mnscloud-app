import type { DashboardRecord } from '../../../shared/dashboard/dashboard-record-list';
import type { ApiService } from '../../../services/api.service';

/**
 * Instance totals counted by the database over every row in scope
 * (`{system/}hosting/vps{-container}/dashboard`), shared by the VPS, VPS Container and Hosting
 * overview dashboards.
 */
export type InstanceDashboard = {
  total: number;
  active: number;
  issues: number;
  byStatus: Array<{ status: string | null; total: number; active: number; issues: number }>;
  byPlan: Array<{ planUUID: string | null; total: number }>;
  byProvider: Array<{ providerUUID: string | null; total: number; issues: number }>;
  /** At most ten instances with a provisioning problem, most recently updated first. */
  issueRows: Array<{ uuid: string; name: string | null; status: string | null }>;
};

export const EMPTY_INSTANCE_DASHBOARD: InstanceDashboard = {
  total: 0,
  active: 0,
  issues: 0,
  byStatus: [],
  byPlan: [],
  byProvider: [],
  issueRows: [],
};

/** The dashboard endpoint payload with every missing field defaulted. */
export function instanceDashboard(response?: { data?: Partial<InstanceDashboard> } | null) {
  return { ...EMPTY_INSTANCE_DASHBOARD, ...response?.data };
}

export function planInstanceCount(dashboard: InstanceDashboard, planUUID: string): number {
  return dashboard.byPlan.find((row) => row.planUUID === planUUID)?.total ?? 0;
}

export function providerInstances(dashboard: InstanceDashboard, providerUUID: string) {
  return (
    dashboard.byProvider.find((row) => row.providerUUID === providerUUID) ?? {
      total: 0,
      issues: 0,
    }
  );
}

/** One record per instance status (most instances first), toned by the page's status rule. */
export function instanceStatusRecords(
  dashboard: InstanceDashboard,
  tone: (status: string, issues: number) => DashboardRecord['tone'],
): DashboardRecord[] {
  return dashboard.byStatus
    .map((row) => {
      const status = String(row.status || 'unknown');
      const { total, active, issues } = row;
      return {
        name: status,
        meta: String(total),
        status,
        tone: tone(status, issues),
        details: [
          { label: 'Total', value: String(total) },
          { label: 'Active', value: String(active) },
          { label: 'Issues', value: String(issues) },
        ],
      } satisfies DashboardRecord;
    })
    .sort((a, b) => Number(b.meta) - Number(a.meta) || a.name.localeCompare(b.name));
}

export type InstanceDashboardSnapshot<P, N> = {
  providers: P[];
  plans: N[];
  instances: InstanceDashboard;
  failedSections: number;
};

/**
 * Loads the provider and plan catalogs (parsing their JSON config field) and the instance totals
 * of `{root}/dashboard`. One failed section stays empty; only a total failure throws.
 */
export async function loadInstanceDashboard<P extends object, N extends object>(
  api: ApiService,
  root: string,
  configFields: { provider: keyof P & string; plan: keyof N & string },
  failure: string,
): Promise<InstanceDashboardSnapshot<P, N>> {
  const [providers, plans, instances] = await Promise.allSettled([
    api.get<{ data?: { items?: P[] } }>(`${root}/providers?limit=500&offset=0`, { timeout: 30000 }),
    api.get<{ data?: { items?: N[] } }>(`${root}/plans?limit=500&offset=0`, { timeout: 30000 }),
    api.get<{ data?: Partial<InstanceDashboard> }>(`${root}/dashboard`, { timeout: 30000 }),
  ]);
  const results = [providers, plans, instances];
  const failedSections = results.filter((result) => result.status === 'rejected').length;
  if (failedSections === results.length) throw new Error(failure);
  return {
    providers:
      providers.status === 'fulfilled'
        ? withParsedConfig(providers.value, configFields.provider)
        : [],
    plans: plans.status === 'fulfilled' ? withParsedConfig(plans.value, configFields.plan) : [],
    instances:
      instances.status === 'fulfilled'
        ? instanceDashboard(instances.value)
        : EMPTY_INSTANCE_DASHBOARD,
    failedSections,
  };
}

function withParsedConfig<T extends object>(response: { data?: { items?: T[] } }, field: string) {
  const items = Array.isArray(response?.data?.items) ? response.data.items : [];
  return items.map((item) => ({
    ...item,
    [field]: parseJsonValue((item as Record<string, unknown>)[field]),
  })) as T[];
}

export function parseJsonValue<T>(value: T | string | null | undefined): T | null {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function isActiveValue(value: unknown, status?: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string' && value.trim()) {
    return ['1', 'true', 'active', 'running', 'ready'].includes(value.toLowerCase());
  }
  return ['active', 'running', 'ready'].includes(String(status ?? '').toLowerCase());
}

export function isIssueStatus(value: unknown): boolean {
  return ['failed', 'error', 'suspended', 'cancelled', 'canceled'].includes(
    String(value ?? '').toLowerCase(),
  );
}

export function instanceStatusTone(status: string, issues: number): DashboardRecord['tone'] {
  if (issues > 0 || isIssueStatus(status)) return 'danger';
  const normalized = status.toLowerCase();
  if (['pending', 'queued', 'provisioning', 'creating', 'running'].includes(normalized)) {
    return 'running';
  }
  if (['inactive', 'disabled', 'stopped', 'unknown'].includes(normalized)) return 'skipped';
  return 'success';
}

export function formatMemoryMb(value: number | null | undefined): string {
  const mb = Number(value ?? 0);
  if (!Number.isFinite(mb) || mb <= 0) return '-';
  if (mb >= 1024) return `${Math.round((mb / 1024) * 10) / 10} GB`;
  return `${mb} MB`;
}

export function formatPlanPrice(
  value: number | string | null | undefined,
  currency: string | null | undefined,
): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return '-';
  return `${currency || 'BRL'} ${amount.toFixed(2)}`;
}

export function dashboardErrorMessage(error: unknown, fallback: string): string {
  const maybe = error as { error?: { error?: string; message?: string }; message?: string };
  return maybe?.error?.message || maybe?.error?.error || maybe?.message || fallback;
}
