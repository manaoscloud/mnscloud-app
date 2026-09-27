import { Component } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';

const SEVERITY_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'critical', label: 'Critical' },
  { value: 'error', label: 'Error or higher' },
  { value: 'warning', label: 'Warning or higher' },
  { value: 'info', label: 'All levels' },
];

const DELIVERY_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: '', label: 'Never sent' },
  { value: 'pending', label: 'Queued' },
  { value: 'running', label: 'Sending' },
  { value: 'sent', label: 'Sent' },
  { value: 'failed', label: 'Failed' },
  { value: 'skipped', label: 'Skipped' },
];

const RULE_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'system/support/notification-rules',
  uuidField: 'SnrUUID',
  pageTitle: 'Notification rules',
  pageDescription:
    'Email platform alerts (for example OpenVault sealed or Agent offline) when Activity Log events match a rule.',
  createTitle: 'New notification rule',
  editTitle: 'Edit notification rule',
  dialogDescription: 'Choose which events trigger the email, the minimum level and the recipients.',
  searchPlaceholder: 'Name or event pattern',
  emptyLabel: 'No notification rules found.',
  deleteTitle: 'Delete notification rule',
  deleteMessage: 'Are you sure you want to delete this notification rule?',
  deleteSelectedTitle: 'Delete selected notification rules',
  deleteSelectedMessage: 'Delete {count} selected notification rules?',
  savedMessage: 'Notification rule saved successfully.',
  deletedMessage: 'Notification rule deleted successfully.',
  deleteFailedMessage: 'Failed to delete notification rule.',
  bulkDelete: false,
  rowActions: [{ key: 'send-test', label: 'Send test email', icon: 'forward_to_inbox' }],
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  statusFilter: true,
  initialValues: {
    enabled: 1,
    name: '',
    eventPattern: 'openvault.runtime.*',
    severity: 'critical',
    emails: '',
    throttleSeconds: 900,
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'SnrName', uuidField: 'SnrUUID' },
    { id: 'eventPattern', label: 'Event pattern', field: 'SnrEventPattern' },
    {
      id: 'severity',
      label: 'Minimum level',
      kind: 'status',
      field: 'SnrSeverity',
      options: SEVERITY_OPTIONS,
      chipClass: (value) =>
        value === 'critical' || value === 'error' ? 'chip-failed' : 'chip-running',
    },
    { id: 'emails', label: 'Recipients', field: 'SnrEmails' },
    { id: 'lastSentAt', label: 'Last sent', kind: 'datetime', field: 'LastSentAt' },
    {
      id: 'lastDelivery',
      label: 'Last delivery',
      kind: 'status',
      field: 'LastDeliveryStatus',
      options: DELIVERY_OPTIONS,
      chipClass: (value) =>
        value === 'sent'
          ? 'chip-success'
          : value === 'failed'
            ? 'chip-failed'
            : ['pending', 'running'].includes(String(value))
              ? 'chip-running'
              : 'chip-skipped',
    },
    { id: 'status', label: 'Status', kind: 'status', field: 'SnrEnabled', className: 'status-col' },
  ],
  fields: [
    {
      key: 'enabled',
      source: 'SnrEnabled',
      payloadKey: 'enabled',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    { key: 'name', source: 'SnrName', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    {
      key: 'eventPattern',
      source: 'SnrEventPattern',
      payloadKey: 'eventPattern',
      label: 'Event pattern',
      placeholder: 'openvault.runtime.*',
      hint: 'Activity Log action; * matches any text (openvault.runtime.*, agent.health.*, *).',
      required: true,
      span: 1,
    },
    {
      key: 'severity',
      source: 'SnrSeverity',
      payloadKey: 'severity',
      label: 'Minimum level',
      type: 'search-select',
      options: SEVERITY_OPTIONS,
      required: true,
      span: 1,
    },
    {
      key: 'emails',
      source: 'SnrEmails',
      payloadKey: 'emails',
      label: 'Recipient emails',
      placeholder: 'ops@example.com, oncall@example.com',
      hint: 'Up to 10 emails separated by commas.',
      type: 'textarea',
      rows: 2,
      required: true,
      span: 4,
    },
    {
      key: 'throttleSeconds',
      source: 'SnrThrottleSeconds',
      payloadKey: 'throttleSeconds',
      label: 'Repeat interval (seconds)',
      hint: 'Suppresses repeats of the same event for the same resource (0 = never).',
      type: 'number',
      span: 1,
    },
  ],
};

@Component({
  selector: 'app-monitoring-notification-rules',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class MonitoringNotificationRulesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(RULE_CONFIG);
  }

  override async handleRowAction(action: { key: string }, row: ConfigurableCrudRecord) {
    if (action.key !== 'send-test') return;
    try {
      await this.api.post(`${RULE_CONFIG.endpoint}/${this.recordUUID(row)}/test`, {});
      this.snack.success('Test email queued; it arrives within about a minute.');
      setTimeout(() => this.refreshList(), 45000);
    } catch (error) {
      this.snack.error(this.errorMessage(error) || 'Failed to queue the test email.');
    }
  }
}
