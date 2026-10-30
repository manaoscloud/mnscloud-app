import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import type { ConfigurableCrudOption } from '../../../shared/crud/configurable-crud/configurable-crud-page-base';

export const STORAGE_MODULE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'hosting', label: 'Hosting' },
  { value: 'support', label: 'Support' },
  { value: 'voip', label: 'VoIP' },
  { value: 'voip-pabx', label: 'PABX' },
  { value: 'sales', label: 'Sales' },
  { value: 'financial', label: 'Financial' },
  { value: 'crm', label: 'CRM' },
  { value: 'clinic', label: 'Clinic' },
  { value: 'payment-gateways', label: 'Payment gateways' },
  { value: 'users', label: 'Users' },
  { value: 'registry', label: 'documents.title' },
  { value: 'infragis', label: 'InfraGIS' },
];

const CONSUMER_SCOPES: readonly ConfigurableCrudOption[] = [
  { value: 'platform', label: 'Platform' },
  { value: 'tenant', label: 'Selected environment' },
  { value: 'all-tenants', label: 'All environments' },
];

function optionLabel(options: readonly ConfigurableCrudOption[], value: unknown): string {
  return options.find((option) => option.value === value)?.label ?? 'Unknown';
}

export function storageGrantCollection(prefix: string, master: boolean, bucket: string) {
  return defineCrud({
    endpoint: `${prefix}/buckets/${bucket}/grants`,
    uuidField: 'HsgUUID',
    pageTitle: 'Bucket permissions',
    pageDescription: 'Choose which modules and environments may use this bucket.',
    createTitle: 'New bucket permission',
    editTitle: 'Edit bucket permission',
    dialogDescription: 'Authorize one module for the selected consumer scope.',
    deleteMessage: 'Remove this permission? Existing files remain in the bucket.',
    deleteSelectedMessage: 'Remove {count} permissions? Existing files remain in the bucket.',
    serverSidePagination: true,
    bulkDelete: true,
    initialValues: {
      module: '',
      consumerScope: master ? 'platform' : 'tenant',
      consumerUuid: '',
      isActive: 1,
    },
    deletePayload: (row) => ({ revision: String(row['HsgRevision']) }),
    bulkDeletePayload: (rows) => ({
      revisions: Object.fromEntries(
        rows.map((row) => [String(row['HsgUUID']), String(row['HsgRevision'])]),
      ),
    }),
    payload: (values, editing) => ({
      module: values['module'],
      consumerScope: values['consumerScope'],
      consumerUuid: values['consumerScope'] === 'tenant' ? values['consumerUuid'] : null,
      isActive: values['isActive'],
      ...(editing ? { revision: values['revision'] } : {}),
    }),
    fieldChange: (key, _value, current) =>
      key === 'consumerScope' ? { ...current, consumerUuid: '' } : current,
    fields: [
      {
        key: 'revision',
        source: 'HsgRevision',
        label: 'Revision',
        hidden: true,
        fromRecord: String,
      },
      {
        key: 'module',
        source: 'HsgModule',
        label: 'Module',
        type: 'select',
        options: STORAGE_MODULE_OPTIONS,
        required: true,
        span: 1,
      },
      {
        key: 'consumerScope',
        source: 'HsgConsumerScope',
        label: 'Consumer scope',
        type: 'select',
        options: master
          ? CONSUMER_SCOPES
          : CONSUMER_SCOPES.filter((option) => option.value === 'tenant'),
        required: true,
        span: 1,
      },
      {
        key: 'consumerUuid',
        source: 'ConsumerUserUsrUUID',
        label: 'Environment',
        type: 'search-select',
        span: 1,
        hiddenWhen: ({ values }) => values['consumerScope'] !== 'tenant',
        requiredWhen: ({ values }) => values['consumerScope'] === 'tenant',
        remoteLookup: {
          endpoint: `${prefix}/consumers`,
          uuidField: 'UserUUID',
          labelField: 'Name',
          selectedLabelField: 'ConsumerName',
        },
        quickCreate: false,
        quickCreateExemptReason:
          'Consumer environments are provisioned through account onboarding, not through bucket permissions.',
      },
      { key: 'isActive', source: 'HsgIsActive', label: 'Status', type: 'status', span: 1 },
    ],
    columns: [
      {
        id: 'module',
        label: 'Module',
        value: (row, translate) => translate(optionLabel(STORAGE_MODULE_OPTIONS, row['HsgModule'])),
      },
      {
        id: 'scope',
        label: 'Consumer scope',
        value: (row, translate) => translate(optionLabel(CONSUMER_SCOPES, row['HsgConsumerScope'])),
      },
      {
        id: 'consumer',
        label: 'Environment',
        kind: 'related',
        field: 'ConsumerName',
        uuidField: 'ConsumerUserUsrUUID',
      },
      { id: 'status', label: 'Status', kind: 'status', field: 'HsgIsActive' },
    ],
  });
}
