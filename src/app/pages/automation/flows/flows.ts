import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { revisionDeletePayloads } from '../../../shared/crud/configurable-crud/revision-delete';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

export const AUTOMATION_SURFACE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'conversation', label: 'Conversations' },
  { value: 'voice', label: 'Voice' },
  { value: 'event', label: 'Events' },
];

export const AUTOMATION_FLOW_STATUS_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'archived', label: 'Archived' },
];

const OPEN_EDITOR: ConfigurableCrudRowAction = {
  key: 'open-editor',
  label: 'Open editor',
  icon: 'account_tree',
  inline: true,
};

/** Route of the visual editor of a flow. */
export function editorRoute(uuid: string): string[] {
  return ['/automation/flows', uuid, 'editor'];
}

/** Automation flows of the tenant; the graph itself is edited in the visual editor. */
export const AUTOMATION_FLOWS_CONFIG = defineCrud({
  endpoint: 'automation/flows',
  uuidField: 'AflUUID',
  pageTitle: 'automation.flows.title',
  pageDescription: 'automation.flows.description',
  createTitle: 'automation.flows.create',
  editTitle: 'automation.flows.edit',
  searchPlaceholder: 'automation.flows.search',
  emptyLabel: 'automation.flows.empty',
  serverSidePagination: true,
  statusFilter: false,
  rowActions: [OPEN_EDITOR],
  ...revisionDeletePayloads('AflUUID', 'AflRevision'),
  initialValues: {
    name: '',
    description: '',
    surface: 'conversation',
    priority: 100,
    revision: null,
  },
  listFilters: [
    {
      key: 'status',
      label: 'Status',
      paramKey: 'status',
      type: 'select',
      span: 1,
      options: AUTOMATION_FLOW_STATUS_OPTIONS,
    },
    {
      key: 'surface',
      label: 'automation.flows.surface',
      paramKey: 'surface',
      type: 'select',
      span: 1,
      options: AUTOMATION_SURFACE_OPTIONS,
    },
  ],
  columns: [
    { id: 'name', label: 'Name', field: 'AflName', uuidField: 'AflUUID', kind: 'identity' },
    {
      id: 'surface',
      label: 'automation.flows.surface',
      field: 'AflSurface',
      options: AUTOMATION_SURFACE_OPTIONS,
    },
    {
      id: 'status',
      label: 'Status',
      field: 'AflStatus',
      kind: 'status',
      options: AUTOMATION_FLOW_STATUS_OPTIONS,
    },
    {
      id: 'published',
      label: 'automation.flows.publishedVersion',
      field: 'AflPublishedVersion',
      kind: 'number',
    },
    { id: 'runs', label: 'automation.flows.activeRuns', field: 'RunsActive', kind: 'number' },
    { id: 'updated', label: 'Updated at', field: 'AflDateUpdated', kind: 'datetime' },
  ],
  fields: [
    { key: 'name', source: 'AflName', label: 'Name', required: true, span: 1 },
    {
      key: 'surface',
      source: 'AflSurface',
      label: 'automation.flows.surface',
      type: 'select',
      options: AUTOMATION_SURFACE_OPTIONS,
      required: true,
      span: 1,
      help: 'automation.flows.surfaceHelp',
    },
    {
      key: 'priority',
      source: 'AflPriority',
      label: 'Priority',
      type: 'number',
      span: 1,
      help: 'automation.flows.priorityHelp',
    },
    // business-description: what the flow does, shown in the list of flows.
    {
      key: 'description',
      source: 'AflDescription',
      label: 'Description',
      type: 'textarea',
      span: 4,
      rows: 4,
    },
    { key: 'revision', source: 'AflRevision', label: 'documents.revision', hidden: true },
  ],
});

@Component({
  selector: 'app-automation-flows',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class AutomationFlowsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly router = inject(Router);

  constructor() {
    super(AUTOMATION_FLOWS_CONFIG);
  }

  override handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key !== OPEN_EDITOR.key) return;
    const uuid = this.recordUUID(row);
    if (uuid) return void this.router.navigate(editorRoute(uuid));
  }
}
