import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';
import { quickCreateFor } from '../../../../shared/crud/configurable-crud/quick-create';
import { STORAGE_MODULE_OPTIONS } from '../storage-module-config';

function bindingConfig(master: boolean) {
  const prefix = master ? 'system/hosting/storage' : 'hosting/storage';
  return defineCrud({
    endpoint: `${prefix}/bindings`,
    uuidField: 'HbiUUID',
    pageTitle: 'Module destinations',
    pageDescription: 'Select the bucket each module uses for new files in this environment.',
    createTitle: 'New module destination',
    editTitle: 'Edit module destination',
    dialogDescription: 'Choose a bucket explicitly offered to this module and environment.',
    deleteMessage: 'Remove this destination? Existing files keep their recorded bucket.',
    deleteSelectedMessage:
      'Remove {count} destinations? Existing files keep their recorded buckets.',
    serverSidePagination: true,
    bulkDelete: true,
    initialValues: { module: '', bucketUuid: '', isActive: 1 },
    deletePayload: (row) => ({ revision: String(row['HbiRevision']) }),
    bulkDeletePayload: (rows) => ({
      revisions: Object.fromEntries(
        rows.map((row) => [String(row['HbiUUID']), String(row['HbiRevision'])]),
      ),
    }),
    payload: (values, editing) => ({
      module: values['module'],
      bucketUuid: values['bucketUuid'],
      isActive: values['isActive'],
      ...(editing ? { revision: values['revision'] } : {}),
    }),
    fieldChange: (key, _value, current) =>
      key === 'module' ? { ...current, bucketUuid: '' } : current,
    fields: [
      {
        key: 'revision',
        source: 'HbiRevision',
        label: 'Revision',
        hidden: true,
        fromRecord: (value) => String(value),
      },
      {
        key: 'module',
        source: 'HbiModule',
        label: 'Module',
        type: 'select',
        options: STORAGE_MODULE_OPTIONS,
        required: true,
        span: 1,
      },
      {
        key: 'bucketUuid',
        source: 'HostingStorageBucketHsbUUID',
        label: 'Bucket',
        type: 'search-select',
        required: true,
        span: 1,
        remoteLookup: {
          endpoint: `${prefix}/bindings/buckets`,
          uuidField: 'HsbUUID',
          labelField: 'HsbName',
          selectedLabelField: 'BucketName',
          parameters: { module: 'module' },
        },
        quickCreate: quickCreateFor('HostingStorageBucketHsbUUID', {
          routeData: { scope: master ? 'master' : 'tenant' },
          initialValues: ({ values }) => ({ initialModule: values['module'] }),
        }),
      },
      { key: 'isActive', source: 'HbiIsActive', label: 'Status', type: 'status', span: 1 },
    ],
    columns: [
      {
        id: 'module',
        label: 'Module',
        value: (row, translate) =>
          translate(
            STORAGE_MODULE_OPTIONS.find((option) => option.value === row['HbiModule'])?.label ??
              'Unknown',
          ),
      },
      {
        id: 'bucket',
        label: 'Bucket',
        kind: 'related',
        field: 'BucketName',
        uuidField: 'HostingStorageBucketHsbUUID',
      },
      { id: 'status', field: 'HbiIsActive', label: 'Status', kind: 'status' },
    ],
  });
}

@Component({
  selector: 'app-hosting-storage-bindings',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingStorageBindingsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(bindingConfig(inject(ActivatedRoute).snapshot.data['scope'] === 'master'));
  }
}
