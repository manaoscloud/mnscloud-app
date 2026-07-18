import { Component } from '@angular/core';
import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';

const direction: ConfigurableCrudOption[] = [
  { value: 'both', label: 'Both' },
  { value: 'port_in', label: 'Port in' },
  { value: 'port_out', label: 'Port out' },
];
const categories: ConfigurableCrudOption[] = [
  'commercial',
  'quality',
  'cost',
  'contract',
  'operational',
  'other',
].map((value) => ({ value, label: value }));
const config: ConfigurableCrudConfig = {
  endpoint: 'voip/portability-reasons',
  uuidField: 'VprUUID',
  pageTitle: 'Portability reasons',
  pageDescription: 'Manage the reasons available to this tenant portability requests.',
  createTitle: 'New portability reason',
  editTitle: 'Edit portability reason',
  dialogDescription: 'Maintain the reason catalog used by this tenant portability requests.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No portability reasons found.',
  deleteTitle: 'Delete portability reason',
  deleteMessage: 'Delete this portability reason?',
  deleteSelectedTitle: 'Delete selected portability reasons',
  deleteSelectedMessage: 'Delete {count} selected portability reasons?',
  savedMessage: 'Portability reason saved successfully.',
  deletedMessage: 'Portability reason deleted successfully.',
  deleteFailedMessage: 'Failed to delete portability reason.',
  bulkDelete: false,
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  initialValues: {
    status: 1,
    code: '',
    name: '',
    description: '',
    direction: 'both',
    category: 'other',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'VprName', uuidField: 'VprUUID' },
    { id: 'code', label: 'Code', field: 'VprCode' },
    { id: 'direction', label: 'Direction', field: 'VprDirection' },
    { id: 'category', label: 'Category', field: 'VprCategory' },
    { id: 'status', label: 'Status', kind: 'status', field: 'VprStatus' },
  ],
  fields: [
    { key: 'status', source: 'VprStatus', type: 'status', label: 'Status', span: 1 },
    {
      key: 'direction',
      source: 'VprDirection',
      type: 'select',
      label: 'Direction',
      options: direction,
      required: true,
      span: 1,
    },
    { key: 'code', source: 'VprCode', label: 'Code', required: true, span: 1 },
    {
      key: 'name',
      source: 'VprName',
      label: 'Name',
      required: true,
      textCase: 'uppercase',
      span: 1,
    },
    {
      key: 'category',
      source: 'VprCategory',
      type: 'select',
      label: 'Category',
      options: categories,
      required: true,
      span: 1,
    },
    {
      key: 'description',
      source: 'VprDescription',
      type: 'textarea',
      label: 'Description',
      span: 1,
      rows: 4,
    },
  ],
};
@Component({
  selector: 'app-voip-portability-reasons',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipPortabilityReasonsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      status: Number(payload['status']),
    };
  }
}
