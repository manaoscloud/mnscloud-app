import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';

const config = defineCrud({
  endpoint: 'voip/pabx/agent-state-events',
  uuidField: 'VqeUUID',
  pageTitle: 'Agent state history',
  pageDescription: 'Review contact-center availability, pauses and state transitions.',
  canCreate: false,
  canEdit: false,
  canDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  fields: [],
  listFilters: [
    { key: 'start', paramKey: 'start', label: 'Start date', type: 'text', span: 1 },
    { key: 'end', paramKey: 'end', label: 'End date', type: 'text', span: 1 },
  ],
  columns: [
    { id: 'agent', field: 'AgentName', label: 'Agent', kind: 'identity' },
    { id: 'time', field: 'VqeDateCreated', label: 'Date', kind: 'datetime' },
    {
      id: 'from',
      field: 'VqeFromStatus',
      label: 'Previous status',
      kind: 'text',
      translateValue: true,
    },
    { id: 'to', field: 'VqeToStatus', label: 'Status', kind: 'text', translateValue: true },
    {
      id: 'next',
      field: 'VqeNextStatus',
      label: 'Next status',
      kind: 'text',
      translateValue: true,
    },
    { id: 'reason', field: 'VqePauseReason', label: 'Pause reason', kind: 'text' },
    { id: 'source', field: 'VqeSource', label: 'Source', kind: 'text', translateValue: true },
  ],
});

@Component({
  selector: 'app-agent-state-event',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipPabxAgentStateEventPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
