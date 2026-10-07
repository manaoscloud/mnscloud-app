import { crmPayload } from '../crm-input';
import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { crmActions } from '../crm-actions';
const config = defineCrud({
  endpoint: 'crm/pipelines',
  uuidField: 'CpiUUID',
  pageTitle: 'crm.title.pipelines',
  initialValues: {
    CpiName: '',
    CpiStatus: 1,
  },
  fields: [
    {
      key: 'CpiStatus',
      source: 'CpiStatus',
      label: 'crm.field.Status',
      span: 1,
      required: true,
      type: 'status',
    },
    {
      key: 'CpiName',
      source: 'CpiName',
      label: 'crm.field.Name',
      span: 2,
      required: true,
      type: 'text',
    },
    { key: 'CpiRevision', source: 'CpiRevision', label: 'crm.field.Revision', hidden: true },
  ],
  columns: [
    {
      id: 'CpiName',
      field: 'CpiName',
      label: 'crm.field.Name',
      kind: 'identity',
    },
    {
      id: 'CpiStatus',
      field: 'CpiStatus',
      label: 'crm.field.Status',
      kind: 'status',
    },
  ],
  listFilters: [],
  serverSidePagination: true,
  // CRM deletion is individually audited; see app.md, CRM form baseline.
  bulkDelete: false,
  quickCreateLabelField: 'CpiName',
  payload: (values, editing) =>
    crmPayload(values, editing, 'CpiRevision', ['CpiStatus', 'CpiRevision'], []),
  rowActions: crmActions('pipelines'),
  filterActions: [{ key: 'setup', label: 'crm.setup', icon: 'playlist_add' }],
});
@Component({
  selector: 'app-crm-pipelines',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class CrmPipelinePage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
  override async handleFilterAction(
    _action: import('../../../shared/crud/configurable-crud/configurable-crud-page-base').ConfigurableCrudFilterAction,
  ) {
    try {
      await this.api.post('crm/setup', {});
      this.refreshList();
      this.snack.success(this.transloco.translate('crm.recorded'));
    } catch {
      this.snack.error(this.transloco.translate('crm.failed'));
    }
  }
}
