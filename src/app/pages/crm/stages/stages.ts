import { crmPayload, crmLocalDateTime } from '../crm-input';
import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { crmActions } from '../crm-actions';
const config = defineCrud({
  endpoint: 'crm/stages',
  uuidField: 'CstUUID',
  pageTitle: 'crm.title.stages',
  initialValues: {
    CstName: '',
    CrmPipelineCpiUUID: '',
    CstPosition: 10,
    CstKind: 'open',
    CstStatus: 1,
  },
  fields: [
    {
      key: 'CstName',
      source: 'CstName',
      label: 'crm.field.Name',
      span: 1,
      required: true,
      type: 'text',
    },
    {
      key: 'CrmPipelineCpiUUID',
      source: 'CrmPipelineCpiUUID',
      label: 'crm.title.pipelines',
      span: 1,
      required: true,
      type: 'search-select',
      remoteLookup: {
        endpoint: 'crm/pipelines',
        uuidField: 'CpiUUID',
        labelField: 'CpiName',
        selectedLabelField: 'CrmPipelineCpiUUIDName',
      },
    },
    {
      key: 'CstPosition',
      source: 'CstPosition',
      label: 'crm.field.Position',
      span: 1,
      required: true,
      type: 'number',
    },
    {
      key: 'CstKind',
      source: 'CstKind',
      label: 'crm.field.Kind',
      span: 1,
      required: true,
      type: 'select',
      translateOptions: true,
      options: [
        {
          value: 'open',
          label: 'crm.enum.open',
        },
        {
          value: 'won',
          label: 'crm.enum.won',
        },
        {
          value: 'lost',
          label: 'crm.enum.lost',
        },
      ],
    },
    {
      key: 'CstStatus',
      source: 'CstStatus',
      label: 'crm.field.Status',
      span: 1,
      required: true,
      type: 'status',
    },
    {
      key: 'CstRevision',
      source: 'CstRevision',
      label: 'crm.field.Revision',
      hidden: true,
    },
  ],
  columns: [
    {
      id: 'CrmPipelineCpiUUID',
      field: 'CrmPipelineCpiUUIDName',
      label: 'crm.title.pipelines',
      kind: 'text',
    },
    {
      id: 'CstName',
      field: 'CstName',
      label: 'crm.field.Name',
      kind: 'identity',
    },
    {
      id: 'CstKind',
      field: 'CstKind',
      label: 'crm.field.Kind',
      kind: 'text',
      options: [
        {
          value: 'open',
          label: 'crm.enum.open',
        },
        {
          value: 'won',
          label: 'crm.enum.won',
        },
        {
          value: 'lost',
          label: 'crm.enum.lost',
        },
      ],
    },
    {
      id: 'CstStatus',
      field: 'CstStatus',
      label: 'crm.field.Status',
      kind: 'status',
    },
  ],
  listFilters: [
    {
      key: 'CrmPipelineCpiUUID',
      paramKey: 'CrmPipelineCpiUUID',
      label: 'crm.title.pipelines',
      type: 'search-select',
      span: 1,
      remoteLookup: { endpoint: 'crm/pipelines', uuidField: 'CpiUUID', labelField: 'CpiName' },
    },
    {
      key: 'CstKind',
      paramKey: 'CstKind',
      label: 'crm.field.Kind',
      type: 'select',
      translateOptions: true,
      options: [
        {
          value: 'open',
          label: 'crm.enum.open',
        },
        {
          value: 'won',
          label: 'crm.enum.won',
        },
        {
          value: 'lost',
          label: 'crm.enum.lost',
        },
      ],
      span: 1,
    },
  ],
  serverSidePagination: true,
  bulkDelete: false,
  quickCreateLabelField: 'CstName',
  payload: (values, editing) =>
    crmPayload(values, editing, 'CstRevision', ['CstPosition', 'CstStatus', 'CstRevision'], []),
  rowActions: crmActions('stages'),
});
@Component({
  selector: 'app-crm-stages',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class CrmStagePage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
