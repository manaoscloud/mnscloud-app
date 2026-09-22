import type { DashboardRecord } from '../../../../shared/dashboard/dashboard-record-list';

export interface SecretMetadata {
  CstUUID: string;
  CstName: string;
  CstStatus: number;
  CstVaultVersion: number | null;
  CstExpiresAt: string | null;
  SecretAccountName: string;
  ValidityState: string | null;
  ValueState: string | null;
}

function collection(response: unknown): { items: unknown[]; total: number } {
  const data = (response as { data?: { items?: unknown; total?: unknown } } | null)?.data;
  if (
    !data ||
    !Array.isArray(data.items) ||
    typeof data.total !== 'number' ||
    !Number.isSafeInteger(data.total) ||
    data.total < data.items.length
  ) {
    throw new Error('Invalid secrets inventory response');
  }
  return { items: data.items, total: data.total };
}
export function readTotal(response: unknown): number {
  return collection(response).total;
}
export function readSecretInventory(response: unknown): { items: SecretMetadata[]; total: number } {
  const data = collection(response);
  if (data.items.length > 100) throw new Error('Invalid secrets inventory size');
  const items = data.items.map((value): SecretMetadata => {
    const row = value as Partial<SecretMetadata> | null;
    if (
      !row ||
      typeof row.CstUUID !== 'string' ||
      !row.CstUUID ||
      typeof row.CstName !== 'string'
    ) {
      throw new Error('Invalid secret metadata');
    }
    // Project only display metadata; do not retain arbitrary API fields in the snapshot.
    return {
      CstUUID: row.CstUUID,
      CstName: row.CstName,
      CstStatus: Number(row.CstStatus),
      CstVaultVersion:
        row.CstVaultVersion != null &&
        Number.isSafeInteger(Number(row.CstVaultVersion)) &&
        Number(row.CstVaultVersion) >= 0
          ? Number(row.CstVaultVersion)
          : null,
      CstExpiresAt: typeof row.CstExpiresAt === 'string' ? row.CstExpiresAt : null,
      SecretAccountName: typeof row.SecretAccountName === 'string' ? row.SecretAccountName : '—',
      ValidityState: typeof row.ValidityState === 'string' ? row.ValidityState : null,
      ValueState: typeof row.ValueState === 'string' ? row.ValueState : null,
    };
  });
  return { items, total: data.total };
}
const VALIDITY: Record<string, string> = {
  expired: 'Expired',
  expiring: 'Expiring soon',
  pending: 'Pending storage',
  valid: 'Valid',
  none: 'No expiration',
};
const OPERATIONS: Record<string, string> = {
  failed: 'Failed',
  retry: 'Waiting to retry',
  running: 'Running',
  queued: 'Queued',
  success: 'Completed',
};
export function stateCounts(items: SecretMetadata[], field: 'ValidityState' | 'ValueState') {
  const labels = field === 'ValidityState' ? VALIDITY : OPERATIONS;
  const groups = [...Object.entries(labels), ['unknown', 'secretsDashboard.unavailableState']];
  return groups.map(([state, label]) => ({
    label,
    value: items.filter((item) =>
      state === 'unknown' ? !Object.hasOwn(labels, item[field] ?? '') : item[field] === state,
    ).length,
  }));
}
export function secretRecords(items: SecretMetadata[]): DashboardRecord[] {
  const priority = (row: SecretMetadata) =>
    row.ValueState === 'failed'
      ? 0
      : row.ValidityState === 'expired'
        ? 1
        : row.ValidityState === 'expiring'
          ? 2
          : row.ValueState === 'retry'
            ? 3
            : row.ValidityState === 'pending'
              ? 4
              : 5;
  return items
    .filter((row) => priority(row) < 5)
    .sort((a, b) => priority(a) - priority(b) || a.CstName.localeCompare(b.CstName))
    .slice(0, 6)
    .map((row) => ({
      name: row.CstName,
      meta: row.CstUUID,
      status:
        row.ValueState === 'failed'
          ? 'Failed'
          : row.ValueState === 'retry'
            ? 'Waiting to retry'
            : (VALIDITY[row.ValidityState ?? ''] ?? 'secretsDashboard.unavailableState'),
      tone: row.ValueState === 'failed' || row.ValidityState === 'expired' ? 'danger' : 'running',
      details: [
        { label: 'Account', value: row.SecretAccountName },
        {
          label: 'Validity',
          value: VALIDITY[row.ValidityState ?? ''] ?? 'secretsDashboard.unavailableState',
          translate: true,
        },
        {
          label: 'Status',
          value:
            row.CstStatus === 1
              ? 'Active'
              : row.CstStatus === 0
                ? 'Inactive'
                : 'secretsDashboard.unavailableState',
          translate: true,
        },
        {
          label: 'Operation status',
          value: OPERATIONS[row.ValueState ?? ''] ?? 'secretsDashboard.unavailableState',
          translate: true,
        },
        {
          label: 'Stored version',
          value: row.CstVaultVersion === null ? '—' : String(row.CstVaultVersion),
        },
        { label: 'Expires at', value: row.CstExpiresAt ?? '', format: 'datetime' },
      ],
    }));
}
