import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';
import { LINE_TARGET_EXEMPT, LINE_TARGET_LOOKUP } from '../phone-options';

const config = defineCrud({
  endpoint: 'voip/phone/pool-lines',
  uuidField: 'VhpUUID',
  pageTitle: 'Free lines',
  pageDescription:
    'Lines anyone of the tenant (or of the line customer) may take in PhoneWeb for a shift, for hot desking and contact-center positions. A taken line returns here when the person signs out.',
  createTitle: 'Open line for PhoneWeb',
  editTitle: 'Edit free line',
  dialogDescription: 'Lines dedicated to a person cannot be opened here.',
  emptyLabel: 'No free lines. PhoneWeb users only see the lines assigned to them.',
  deleteTitle: 'Remove free line',
  deleteMessage: 'Remove this line from the free lines? Whoever holds it now loses it at once.',
  savedMessage: 'Free line saved successfully.',
  deletedMessage: 'Free line removed.',
  deleteFailedMessage: 'Failed to remove the free line.',
  bulkDelete: false,
  serverSidePagination: true,
  initialValues: { status: 1, target: '', notes: '' },
  columns: [
    { id: 'line', label: 'Line', field: 'TargetLabel', uuidField: 'VhpUUID', kind: 'identity' },
    { id: 'notes', label: 'Notes', field: 'VhpNotes' },
    {
      id: 'holder',
      label: 'In use by',
      value: (row, translate) => String(row['ClaimedBy'] ?? translate('Free')),
    },
    { id: 'status', label: 'Status', field: 'VhpStatus', kind: 'status' },
  ],
  fields: [
    { key: 'status', source: 'VhpStatus', label: 'Status', type: 'status', span: 1 },
    {
      key: 'target',
      source: 'TargetUUID',
      label: 'Line',
      type: 'search-select',
      required: true,
      remoteLookup: LINE_TARGET_LOOKUP,
      quickCreate: false,
      quickCreateExemptReason: LINE_TARGET_EXEMPT,
      disabledWhen: ({ editing }) => editing,
      span: 2,
    },
    {
      key: 'notes',
      source: 'VhpNotes',
      label: 'Notes',
      placeholder: 'Example: reception position 3',
      span: 4,
    },
  ],
  payload: (values, editing) => ({
    ...(editing ? {} : { TargetUUID: values['target'] }),
    VhpNotes: values['notes'] || null,
    VhpStatus: Number(values['status']),
  }),
});

@Component({
  selector: 'app-voip-phone-pool-lines',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipPhonePoolLinesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
