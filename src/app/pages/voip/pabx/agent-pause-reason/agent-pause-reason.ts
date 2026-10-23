import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';

const config = defineCrud({
  endpoint: 'voip/pabx/agent-pause-reasons',
  uuidField: 'VpzUUID',
  pageTitle: 'Agent pause reasons',
  pageDescription: 'Define the reasons and productive classification of contact-center pauses.',
  createTitle: 'New pause reason',
  editTitle: 'Edit pause reason',
  dialogDescription: 'Set a name, optional maximum duration and productive classification.',
  serverSidePagination: true,
  quickCreateLabelField: 'VpzName',
  initialValues: { VpzName: '', VpzStatus: 1, VpzProductive: 0, VpzMaxMinutes: null },
  fields: [
    { key: 'VpzStatus', source: 'VpzStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'VpzName', source: 'VpzName', label: 'Name', required: true, span: 1 },
    {
      key: 'VpzMaxMinutes',
      source: 'VpzMaxMinutes',
      label: 'Maximum minutes',
      type: 'number',
      span: 1,
    },
    {
      key: 'VpzProductive',
      source: 'VpzProductive',
      label: 'Productive pause',
      type: 'select',
      options: [
        { value: 0, label: 'No' },
        { value: 1, label: 'Yes' },
      ],
      translateOptions: true,
      span: 1,
    },
  ],
  columns: [
    { id: 'name', field: 'VpzName', label: 'Name', kind: 'identity' },
    { id: 'minutes', field: 'VpzMaxMinutes', label: 'Maximum minutes', kind: 'number' },
    {
      id: 'productive',
      field: 'VpzProductive',
      label: 'Productive pause',
      kind: 'text',
      value: (row, t) => t(Number(row['VpzProductive']) === 1 ? 'Yes' : 'No'),
    },
    { id: 'status', field: 'VpzStatus', label: 'Status', kind: 'status' },
  ],
});

@Component({
  selector: 'app-agent-pause-reason',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipPabxAgentPauseReasonPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
