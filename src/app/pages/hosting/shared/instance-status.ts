import type { ConfigurableCrudColumn } from '../../../shared/crud/configurable-crud/configurable-crud-page-base';

type InstanceStatus = { label: string; chipClass: string; icon: string };

const states: Record<string, InstanceStatus> = {
  running: {
    label: 'hostingInstanceStatus.running',
    chipClass: 'chip-success',
    icon: 'play_arrow',
  },
  stopped: { label: 'hostingInstanceStatus.stopped', chipClass: 'chip-skipped', icon: 'stop' },
  provisioning: {
    label: 'hostingInstanceStatus.provisioning',
    chipClass: 'chip-running',
    icon: 'sync',
  },
  queued: { label: 'hostingInstanceStatus.queued', chipClass: 'chip-warning', icon: 'schedule' },
  starting: {
    label: 'hostingInstanceStatus.starting',
    chipClass: 'chip-starting',
    icon: 'power_settings_new',
  },
  rebooting: {
    label: 'hostingInstanceStatus.rebooting',
    chipClass: 'chip-queued',
    icon: 'restart_alt',
  },
  stopping: {
    label: 'hostingInstanceStatus.stopping',
    chipClass: 'chip-stopping',
    icon: 'power_settings_new',
  },
  failed: {
    label: 'hostingInstanceStatus.failed',
    chipClass: 'chip-failed',
    icon: 'error_outline',
  },
  suspended: {
    label: 'hostingInstanceStatus.suspended',
    chipClass: 'chip-suspended',
    icon: 'pause_circle_outline',
  },
  deleting: {
    label: 'hostingInstanceStatus.deleting',
    chipClass: 'chip-deleting',
    icon: 'delete_outline',
  },
  deleted: {
    label: 'hostingInstanceStatus.deleted',
    chipClass: 'chip-skipped',
    icon: 'delete_outline',
  },
  unknown: {
    label: 'hostingInstanceStatus.unknown',
    chipClass: 'chip-skipped',
    icon: 'help_outline',
  },
};

// Provider spellings describe the same user-facing power states.
const aliases: Record<string, string> = {
  active: 'running',
  poweredon: 'running',
  powered_on: 'running',
  off: 'stopped',
  poweredoff: 'stopped',
  powered_off: 'stopped',
  shutoff: 'stopped',
  new: 'provisioning',
  creating: 'provisioning',
  pending: 'queued',
  powering_on: 'starting',
  powering_off: 'stopping',
  restarting: 'rebooting',
  error: 'failed',
  queue_failed: 'failed',
  frozen: 'suspended',
  paused: 'suspended',
  destroying: 'deleting',
  terminated: 'deleted',
};

// Preserve the existing billing-state precedence over provider observations.
const billingStates: Record<string, InstanceStatus> = {
  STOP_PENDING: {
    ...states['stopping'],
    label: 'hostingInstanceStatus.billingStopping',
    chipClass: 'chip-billing',
  },
  STOPPED: {
    ...states['stopped'],
    label: 'hostingInstanceStatus.billingStopped',
    chipClass: 'chip-billing',
    icon: 'pause_circle_outline',
  },
  START_PENDING: { ...states['starting'], label: 'hostingInstanceStatus.billingStarting' },
  DESTROY_PENDING: {
    ...states['deleting'],
    label: 'hostingInstanceStatus.billingDeleting',
    chipClass: 'chip-billing',
  },
};

export function instanceStatus(value: unknown, billingState?: unknown): InstanceStatus {
  const billing = String(billingState ?? '')
    .trim()
    .toUpperCase();
  if (Object.hasOwn(billingStates, billing)) return billingStates[billing];
  const raw = String(value ?? '').trim();
  const normalized = raw.toLowerCase();
  const key = Object.hasOwn(aliases, normalized) ? aliases[normalized] : normalized;
  if (Object.hasOwn(states, key)) return states[key];
  // Keep an unfamiliar provider state visible rather than misreporting it as stopped.
  return { ...states['unknown'], label: raw || states['unknown'].label };
}

export function instanceStatusColumn(field: string, billingField?: string): ConfigurableCrudColumn {
  const presentation = (row: Record<string, unknown>) =>
    instanceStatus(row[field], billingField ? row[billingField] : undefined);
  return {
    id: 'runtimeStatus',
    label: 'Situation',
    kind: 'status',
    field,
    className: 'runtime-status-col',
    value: (row, translate) => translate(presentation(row).label),
    chipClass: (_value, row) => `chip-soft ${presentation(row).chipClass}`,
    icon: (row) => presentation(row).icon,
  };
}
