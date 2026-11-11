import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { quickCreateFor } from '../../../shared/crud/configurable-crud/quick-create';
import { openDataViewerDialog } from '../../../shared/data-viewer-dialog/data-viewer-dialog';

const ENDPOINT = 'hr/time-clock-kiosks';

const COMPANY_LOOKUP = {
  endpoint: 'hr/companies',
  uuidField: 'RcoUUID',
  labelField: 'RcoName',
  selectedLabelField: 'CompanyName',
};

const YES_NO: readonly ConfigurableCrudOption[] = [
  { value: '1', label: 'Yes' },
  { value: '0', label: 'No' },
];

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
    photoRequired: '1',
    emailReceipt: '1',
    notes: '',
    revision: null,
  },
  rowActions: [ACTIVATE, REVOKE],
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
    {
      id: 'company',
      label: 'Company',
      value: (row, t) => (row['CompanyName'] ? String(row['CompanyName']) : t('All')),
    },
    {
      id: 'photo',
      label: 'Photo at punch',
      value: (row, t) => (row['PhotoRequired'] ? t('Required') : t('Not asked')),
    },
    { id: 'lastUsed', label: 'Last used', field: 'LastUsedAt', kind: 'datetime' },
    { id: 'punches', label: 'Punches in 24 h', field: 'PunchesLastDay', kind: 'number' },
  ],
  fields: [
    {
      key: 'name',
      source: 'Name',
      label: 'Name',
      type: 'text',
      required: true,
      span: 1,
      help: 'Where the device stands, for example Main reception.',
    },
    {
      key: 'companyUUID',
      source: 'CompanyUUID',
      label: 'Company',
      type: 'search-select',
      remoteLookup: COMPANY_LOOKUP,
      quickCreate: quickCreateFor('RegCompanyRcoUUID'),
      span: 1,
      help: 'Empty: every employee of the account can punch on this time clock.',
    },
    {
      key: 'photoRequired',
      source: 'PhotoRequired',
      label: 'Photo at punch',
      type: 'select',
      options: YES_NO,
      span: 1,
      help: 'Yes: each punch on this time clock is confirmed only with a live photo from the front camera.',
      fromRecord: (value) => (value === false ? '0' : '1'),
    },
    {
      key: 'emailReceipt',
      source: 'EmailReceipt',
      label: 'Receipt by e-mail',
      type: 'select',
      options: YES_NO,
      span: 1,
      help: 'Offer to send the punch receipt to the e-mail of the employee in the registry.',
      fromRecord: (value) => (value === false ? '0' : '1'),
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
    { key: 'revision', source: 'Revision', label: 'documents.revision', hiddenWhen: () => true },
  ],
  payload: (values) => ({
    name: values['name'],
    companyUUID: values['companyUUID'] || null,
    photoRequired: values['photoRequired'] !== '0',
    emailReceipt: values['emailReceipt'] !== '0',
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
    if (action.key !== REVOKE.key) return;
    const confirmed = await this.confirmAction(
      'Revoke',
      'Revoke this time clock? The device stops recording punches at once. Recorded punches stay.',
      'Revoke',
    );
    if (!confirmed) return;
    try {
      await this.api.post(`${ENDPOINT}/${uuid}/revoke`, { revision: row['Revision'] ?? null });
      this.snack.success(this.t('Time clock revoked.'));
      this.refreshList();
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error) || 'Failed to revoke the time clock.'));
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
      openDataViewerDialog(this.dialog, {
        title: 'Activation code',
        description:
          'On the device, open Pulse, tap "Use this device as the company time clock" and type this code. It works once and expires in 15 minutes; a new code replaces it.',
        details: [
          { label: 'Time clock', value: String(row['Name'] ?? ''), translate: false },
          { label: 'Expires at', value: item.ActivationExpiresAt ?? '', kind: 'datetime' },
        ],
        sections: [
          {
            title: 'Activation code',
            code: { value: item.ActivationCode ?? '', format: 'text', copy: true },
          },
        ],
      });
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error) || 'Failed to create the activation code.'));
    }
  }
}
