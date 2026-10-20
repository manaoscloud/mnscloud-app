import type { DashboardRecord } from '../../../shared/dashboard/dashboard-record-list';

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
