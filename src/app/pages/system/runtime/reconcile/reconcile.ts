import { Component } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';

const STAGE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'inspect', label: 'Inspect' },
  { value: 'plan', label: 'Plan' },
  { value: 'apply', label: 'Apply' },
];

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'leased', label: 'Leased' },
  { value: 'running', label: 'Running' },
  { value: 'success', label: 'Success' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

const PRODUCT_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'mnscloud-db', label: 'Database (mnscloud-db)' },
];

const RESOURCE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'mariadb.server', label: 'MariaDB server (99-mnscloud.cnf)' },
];

const RESOLUTION_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: '', label: 'Preserve local changes' },
  { value: 'adopt-desired', label: 'Enforce desired values' },
];

const DEFAULT_DESIRED = JSON.stringify(
  { 'character-set-collations': 'utf8mb4=utf8mb4_unicode_ci' },
  null,
  2,
);

function result(row: ConfigurableCrudRecord): Record<string, unknown> {
  const value = row['result'];
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function stage(values: ConfigurableCrudRecord): string {
  return String(values['stage'] ?? '');
}

const config = defineCrud({
  endpoint: 'system/runtime/reconcile-jobs',
  uuidField: 'jobUUID',
  pageTitle: 'Runtime reconcile',
  pageDescription:
    'Agent-managed, non-secret configuration changes: inspect, plan with a reviewable digest, then apply with automatic verification and rollback.',
  createTitle: 'Queue runtime reconcile job',
  dialogDescription:
    'Plan before apply. Apply accepts only the digest of a successful plan for the same Agent, release and resource.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No runtime reconcile jobs found.',
  savedMessage: 'Runtime reconcile job queued.',
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  serverSidePagination: true,
  statusMode: 'string',
  activeValue: 'success',
  inactiveValue: 'failed',
  activeStatusValues: ['success'],
  statusOptions: STATUS_OPTIONS,
  initialValues: {
    agentUUID: '',
    product: 'mnscloud-db',
    resource: 'mariadb.server',
    releaseTag: '',
    stage: 'inspect',
    desired: DEFAULT_DESIRED,
    resolution: '',
    planDigest: '',
  },
  columns: [
    { id: 'created', label: 'Created', kind: 'datetime', field: 'createdAt' },
    { id: 'agent', label: 'Agent', field: 'agentName', translateValue: false },
    { id: 'resource', label: 'Resource', field: 'resource', translateValue: false },
    { id: 'stage', label: 'Stage', field: 'stage', options: STAGE_OPTIONS },
    { id: 'status', label: 'Status', kind: 'status', field: 'status', className: 'status-col' },
    {
      id: 'outcome',
      label: 'Result',
      value: (row, translate) => {
        const data = result(row);
        const outcome = String(data['status'] ?? data['outcome'] ?? '');
        return outcome ? translate(outcome) : String(row['errorCode'] ?? '-');
      },
    },
    {
      id: 'planDigest',
      label: 'Plan digest',
      // Short form keeps the actions column visible; "Apply this plan" uses the full digest.
      value: (row) => {
        const digest = String(result(row)['planDigest'] ?? row['planDigest'] ?? '');
        return digest ? `${digest.slice(0, 12)}…` : '-';
      },
      translateValue: false,
    },
  ],
  fields: [
    {
      key: 'agentUUID',
      payloadKey: 'agentUUID',
      label: 'Agent',
      type: 'search-select',
      required: true,
      remoteLookup: {
        endpoint: 'system/runtime/reconcile-agents',
        uuidField: 'agentUUID',
        labelField: 'agentName',
      },
      quickCreate: false,
      quickCreateExemptReason:
        'Agents enroll from the host installer; they cannot be created from a form.',
      span: 2,
    },
    {
      key: 'product',
      payloadKey: 'product',
      label: 'Module',
      type: 'select',
      options: PRODUCT_OPTIONS,
      required: true,
      span: 1,
    },
    {
      key: 'resource',
      payloadKey: 'resource',
      label: 'Resource',
      type: 'select',
      options: RESOURCE_OPTIONS,
      required: true,
      span: 1,
    },
    {
      key: 'releaseTag',
      payloadKey: 'releaseTag',
      label: 'Module release',
      placeholder: 'v0.1.345',
      required: true,
      span: 1,
    },
    {
      key: 'stage',
      payloadKey: 'stage',
      label: 'Stage',
      type: 'select',
      options: STAGE_OPTIONS,
      required: true,
      span: 1,
    },
    {
      key: 'resolution',
      payloadKey: 'resolution',
      label: 'Conflicts and local changes',
      type: 'select',
      options: RESOLUTION_OPTIONS,
      hiddenWhen: ({ values }) => stage(values) !== 'plan',
      span: 2,
    },
    {
      key: 'planDigest',
      payloadKey: 'planDigest',
      label: 'Plan digest',
      hiddenWhen: ({ values }) => stage(values) !== 'apply',
      requiredWhen: ({ values }) => stage(values) === 'apply',
      span: 4,
    },
    {
      key: 'desired',
      payloadKey: 'desired',
      label: 'Desired values (JSON)',
      type: 'textarea',
      format: 'json',
      hiddenWhen: ({ values }) => stage(values) !== 'plan',
      requiredWhen: ({ values }) => stage(values) === 'plan',
      span: 4,
      rows: 5,
    },
  ],
  rowActions: [
    {
      key: 'applyPlan',
      label: 'Apply this plan',
      icon: 'play_arrow',
      tooltip: 'Queue an apply job for this successful plan.',
      visible: (row) =>
        row['stage'] === 'plan' &&
        row['status'] === 'success' &&
        ['ready', 'unchanged'].includes(String(result(row)['status'] ?? '')),
      request: {
        method: 'post',
        endpoint: () => 'system/runtime/reconcile-jobs',
        body: (row) => ({
          agentUUID: row['agentUUID'],
          product: row['product'],
          releaseTag: row['releaseTag'],
          resource: row['resource'],
          stage: 'apply',
          planDigest: result(row)['planDigest'],
        }),
        successMessage: 'Runtime reconcile apply queued.',
        confirm: {
          title: 'Apply this plan',
          message:
            'The Agent writes the configuration, restarts the service once, verifies the live values and rolls back on failure.',
          confirmLabel: 'Apply',
        },
      },
    },
  ],
  payload: (values) => {
    const next: ConfigurableCrudRecord = {
      agentUUID: values['agentUUID'],
      product: values['product'],
      resource: values['resource'],
      releaseTag: String(values['releaseTag'] ?? '').trim(),
      stage: values['stage'],
    };
    if (values['stage'] === 'plan') {
      const raw = values['desired'];
      next['desired'] = typeof raw === 'string' ? JSON.parse(raw || '{}') : raw;
      if (values['resolution']) next['resolution'] = values['resolution'];
    }
    if (values['stage'] === 'apply') next['planDigest'] = String(values['planDigest'] ?? '').trim();
    return next;
  },
});

@Component({
  selector: 'app-system-runtime-reconcile',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class SystemRuntimeReconcilePage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
