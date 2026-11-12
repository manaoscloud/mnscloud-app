import { Component, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { RUN_LIVE_STATES } from '../automation-adapter';
import { openRunDetail } from './run-detail';

export const AUTOMATION_RUN_STATE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'queued', label: 'Queued' },
  { value: 'running', label: 'Running' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'handed_off', label: 'Handed off to the team' },
];

export const AUTOMATION_RUN_MODE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'live', label: 'Live' },
  { value: 'test', label: 'Test' },
];

const FLOW_LOOKUP = {
  endpoint: 'automation/flows',
  uuidField: 'AflUUID',
  labelField: 'AflName',
  selectedLabelField: 'AflName',
  searchParam: 'search',
};

const DETAILS: ConfigurableCrudRowAction = {
  key: 'details',
  label: 'View details',
  icon: 'timeline',
  inline: true,
};

const CANCEL: ConfigurableCrudRowAction = {
  key: 'cancel',
  label: 'Cancel run',
  icon: 'cancel',
  visible: (row) => RUN_LIVE_STATES.includes(String(row['AfrState'])),
  request: {
    method: 'post',
    endpoint: (row) => `automation/runs/${row['AfrUUID']}/cancel`,
    successMessage: 'automation.runs.cancelled',
    confirm: {
      title: 'automation.runs.cancelTitle',
      message: 'automation.runs.cancelMessage',
      confirmLabel: 'Cancel run',
    },
  },
};

/** Executions of the flows: read-only list; the detail shows the step timeline. */
export const AUTOMATION_RUNS_CONFIG = defineCrud({
  endpoint: 'automation/runs',
  uuidField: 'AfrUUID',
  pageTitle: 'automation.runs.title',
  pageDescription: 'automation.runs.description',
  searchPlaceholder: 'automation.runs.search',
  emptyLabel: 'automation.runs.empty',
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  rowActions: [DETAILS, CANCEL],
  listFilters: [
    {
      key: 'flowUUID',
      label: 'automation.runs.flow',
      paramKey: 'flowUUID',
      type: 'search-select',
      span: 1,
      remoteLookup: FLOW_LOOKUP,
    },
    {
      key: 'state',
      label: 'Status',
      paramKey: 'state',
      type: 'select',
      span: 1,
      options: AUTOMATION_RUN_STATE_OPTIONS,
    },
  ],
  columns: [
    {
      id: 'flow',
      label: 'automation.runs.flow',
      field: 'AflName',
      uuidField: 'AfrUUID',
      kind: 'identity',
    },
    {
      id: 'mode',
      label: 'automation.runs.mode',
      field: 'AfrMode',
      options: AUTOMATION_RUN_MODE_OPTIONS,
    },
    { id: 'trigger', label: 'automation.runs.trigger', field: 'AfrTriggerType' },
    {
      id: 'state',
      label: 'Status',
      field: 'AfrState',
      kind: 'status',
      options: AUTOMATION_RUN_STATE_OPTIONS,
    },
    { id: 'steps', label: 'automation.runs.steps', field: 'AfrStepCount', kind: 'number' },
    { id: 'started', label: 'automation.runs.startedAt', field: 'AfrStartedAt', kind: 'datetime' },
    { id: 'ended', label: 'automation.runs.endedAt', field: 'AfrEndedAt', kind: 'datetime' },
  ],
  fields: [],
});

@Component({
  selector: 'app-automation-runs',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class AutomationRunsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly matDialog = inject(MatDialog);

  constructor() {
    super(AUTOMATION_RUNS_CONFIG);
  }

  override handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key !== DETAILS.key) return;
    const uuid = this.recordUUID(row);
    if (uuid) openRunDetail(this.matDialog, uuid, () => this.itemsResource.reload());
  }
}
