import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudOption,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { optionLabel, PUNCH_TYPES } from '../hr-time';
import { openDataViewerDialog } from '../../../shared/data-viewer-dialog/data-viewer-dialog';
import {
  HR_COMPANY_COLUMN,
  HR_REVISION_FIELD,
  HR_YES_NO,
  HrPageOps,
  confirmedPost,
  showHrSecret,
  hrCompanyField,
} from '../hr-crud-shared';

const ENDPOINT = 'hr/time-clock-kiosks';

const STATUSES: readonly ConfigurableCrudOption[] = [
  { value: 'pending', label: 'Waiting for a device' },
  { value: 'awaiting_activation', label: 'Activation code issued' },
  { value: 'active', label: 'Active' },
  { value: 'revoked', label: 'Revoked' },
];

const ACTIVATE: ConfigurableCrudRowAction = {
  key: 'activationCode',
  label: 'Activation code',
  icon: 'qr_code_2',
  tooltip: 'Activation code',
  visible: (row) => ['pending', 'awaiting_activation'].includes(String(row['Status'] ?? '')),
};

const REJECTIONS: ConfigurableCrudRowAction = {
  key: 'rejections',
  label: 'Refused offline marks',
  icon: 'report_gmailerrorred',
  tooltip: 'Refused offline marks',
  visible: (row) => Number(row['RejectionsLastWeek'] ?? 0) > 0,
};

const REJECTION_REASONS: Record<string, string> = {
  INVALID_PIN: 'Wrong code or PIN',
  PIN_LOCKED: 'PIN locked',
  PIN_NOT_SET: 'No time clock PIN',
  ACCESS_DENIED: 'Access blocked',
};

/** The device checks in every 5 minutes; 10 minutes without it means no connection. */
export function kioskConnection(row: ConfigurableCrudRecord, now = Date.now()): string {
  if (String(row['Status'] ?? '') !== 'active') return '—';
  const last = Date.parse(String(row['LastUsedAt'] ?? ''));
  return Number.isFinite(last) && now - last <= 10 * 60 * 1000 ? 'Online' : 'No connection';
}

const REVOKE: ConfigurableCrudRowAction = {
  key: 'revoke',
  label: 'Revoke',
  icon: 'block',
  tooltip: 'Revoke',
  visible: (row) => String(row['Status'] ?? '') !== 'revoked',
};

type ActivationCode = { ActivationCode?: string; ActivationExpiresAt?: string };

// Shared time clocks of the Pulse kiosk mode (K2): HR creates a time clock, generates a one-time
// activation code (shown once, valid 15 minutes) and types it in Pulse on the device; employees
// then punch there with their access code, personal PIN and a live photo. Revoking stops the device
// at once; its marks stay in the ledger.
const config = defineCrud({
  endpoint: ENDPOINT,
  uuidField: 'KioskUUID',
  pageTitle: 'Time clocks',
  pageDescription:
    'Shared devices where several employees punch in Pulse with their access code, PIN and a live photo.',
  createTitle: 'New time clock',
  editTitle: 'Edit time clock',
  searchPlaceholder: 'Name or ID',
  emptyLabel: 'No time clocks found.',
  bulkDelete: false,
  statusFilter: false,
  initialValues: {
    name: '',
    companyUUID: '',
    photoRequired: true,
    emailReceipt: true,
    notes: '',
    revision: null,
  },
  rowActions: [ACTIVATE, REJECTIONS, REVOKE],
  columns: [
    {
      id: 'name',
      label: 'Name',
      field: 'Name',
      uuidField: 'KioskUUID',
      kind: 'identity',
      translateValue: false,
    },
    { id: 'status', label: 'Status', field: 'Status', options: STATUSES },
    { id: 'connection', label: 'Connection', value: (row, t) => t(kioskConnection(row)) },
    { id: 'lastUsed', label: 'Last used', field: 'LastUsedAt', kind: 'datetime' },
    {
      id: 'rejections',
      label: 'Refused in 7 days',
      field: 'RejectionsLastWeek',
      kind: 'number',
    },
    { id: 'punches', label: 'Punches in 24 h', field: 'PunchesLastDay', kind: 'number' },
    {
      id: 'photo',
      label: 'Photo at punch',
      value: (row, t) => t(row['PhotoRequired'] ? 'Required' : 'Not asked'),
    },
    HR_COMPANY_COLUMN,
  ],
  fields: [
    {
      key: 'name',
      label: 'Name',
      help: 'Where the device stands, for example Main reception.',
      source: 'Name',
      required: true,
      type: 'text',
      span: 1,
    },
    hrCompanyField('Empty: every employee of the account can punch on this time clock.'),
    {
      key: 'photoRequired',
      source: 'PhotoRequired',
      label: 'Photo at punch',
      type: 'select',
      options: HR_YES_NO,
      span: 1,
      help: 'Yes: each punch on this time clock is confirmed only with a live photo from the front camera.',
    },
    {
      key: 'emailReceipt',
      source: 'EmailReceipt',
      label: 'Receipt by e-mail',
      type: 'select',
      options: HR_YES_NO,
      span: 1,
      help: 'Offer to send the punch receipt to the e-mail of the employee in the registry.',
    },
    {
      key: 'notes',
      source: 'Notes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
    HR_REVISION_FIELD,
  ],
  payload: (values) => ({
    name: values['name'],
    companyUUID: values['companyUUID'] || null,
    photoRequired: values['photoRequired'] !== false,
    emailReceipt: values['emailReceipt'] !== false,
    notes: values['notes'] || null,
    revision: values['revision'] ?? null,
  }),
});

@Component({
  selector: 'app-hr-time-clock-kiosks',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HrTimeClockKiosksPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly ops: HrPageOps = {
    confirm: (title, message, label) => this.confirmAction(title, message, label),
    post: (path, body) => this.api.post(path, body),
    success: (message) => this.snack.success(this.t(message)),
    failure: (error, fallback) => this.snack.error(this.t(this.errorMessage(error) || fallback)),
    refresh: () => this.refreshList(),
  };

  constructor() {
    super(config);
  }

  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: ConfigurableCrudRecord,
  ): Promise<void> {
    const uuid = this.recordUUID(row);
    if (!uuid) return;
    if (action.key === ACTIVATE.key) {
      await this.activationCode(uuid, row);
      return;
    }
    if (action.key === REJECTIONS.key) {
      await this.rejections(uuid, row);
      return;
    }
    if (action.key !== REVOKE.key) return;
    await confirmedPost(
      this.ops,
      'Revoke',
      'Revoke this time clock? The device stops recording punches at once. Recorded punches stay.',
      `${ENDPOINT}/${uuid}/revoke`,
      { revision: row['Revision'] ?? null },
      'Time clock revoked.',
      'Failed to revoke the time clock.',
    );
  }

  /** Offline marks refused at delivery: HR checks with the employee and records the mark if due. */
  private async rejections(uuid: string, row: ConfigurableCrudRecord): Promise<void> {
    try {
      const response = await this.api.get<{ data?: { items?: Record<string, unknown>[] } }>(
        `${ENDPOINT}/${uuid}/rejections?limit=200`,
      );
      const rows = (response?.data?.items ?? []).map((item) => ({
        ...item,
        Reason: this.t(
          REJECTION_REASONS[String(item['Reason'] ?? '')] ?? String(item['Reason'] ?? ''),
        ),
        EmployeeName: item['EmployeeName'] ?? this.t('Unknown code'),
        Type: this.t(optionLabel(PUNCH_TYPES, item['Type'])),
      }));
      openDataViewerDialog(this.dialog, {
        title: 'Refused offline marks',
        description:
          'Marks taken on this time clock without connection that the server refused at delivery. They are not in the time punches: check with the employee and, if the mark is due, use a missing mark request or a time adjustment.',
        details: [{ label: 'Time clock', value: String(row['Name'] ?? ''), translate: false }],
        sections: [
          {
            title: 'Refused offline marks',
            table: {
              columns: [
                { key: 'OccurredAt', label: 'Mark time', kind: 'datetime' },
                { key: 'LoginCode', label: 'Login code', translate: false },
                { key: 'EmployeeName', label: 'Employee', translate: false },
                { key: 'Type', label: 'Mark', translate: false },
                { key: 'Reason', label: 'Reason', translate: false },
              ],
              rows,
              emptyLabel: 'No refused offline marks.',
            },
          },
        ],
      });
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    }
  }

  private async activationCode(uuid: string, row: ConfigurableCrudRecord): Promise<void> {
    try {
      const response = await this.api.post<{ data?: { item?: ActivationCode } }>(
        `${ENDPOINT}/${uuid}/activation-code`,
        {},
      );
      const item = response?.data?.item ?? {};
      this.refreshList();
      showHrSecret(
        this.dialog,
        'Activation code',
        'On the device, open Pulse, tap "Use this device as the company time clock" and type this code. It works once and expires in 15 minutes; a new code replaces it.',
        [
          { label: 'Time clock', value: String(row['Name'] ?? ''), translate: false },
          { label: 'Expires at', value: item.ActivationExpiresAt ?? '', kind: 'datetime' },
        ],
        item.ActivationCode ?? '',
      );
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error) || 'Failed to create the activation code.'));
    }
  }
}
