import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';

const YES_NO_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
];

const SCOPE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'TENANT', label: 'Tenant' },
  { value: 'MASTER', label: 'Master' },
];

const RECORD_TYPE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'A', label: 'A' },
  { value: 'AAAA', label: 'AAAA' },
  { value: 'CAA', label: 'CAA' },
  { value: 'CNAME', label: 'CNAME' },
  { value: 'MX', label: 'MX' },
  { value: 'NS', label: 'NS' },
  { value: 'SRV', label: 'SRV' },
  { value: 'TXT', label: 'TXT' },
];

const HOSTING_DNS_TEMPLATE_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'hosting/dns/templates',
  uuidField: 'HdtUUID',
  pageTitle: 'DNS Templates',
  pageDescription: 'Manage reusable DNS zone templates and baseline records.',
  createTitle: 'New DNS template',
  editTitle: 'Edit DNS template',
  dialogDescription: 'Configure the template used to create desired DNS records for new domains.',
  searchPlaceholder: 'Name or code',
  emptyLabel: 'No DNS templates found.',
  deleteTitle: 'Delete DNS template',
  deleteMessage: 'Are you sure you want to delete this DNS template?',
  deleteSelectedTitle: 'Delete selected DNS templates',
  deleteSelectedMessage: 'Delete {count} selected DNS templates?',
  savedMessage: 'DNS template saved successfully.',
  deletedMessage: 'DNS template deleted successfully.',
  deleteFailedMessage: 'Failed to delete DNS template.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  bulkDelete: false,
  statusFilter: true,
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'HdtName', uuidField: 'HdtUUID' },
    { id: 'code', label: 'Code', field: 'HdtCode' },
    { id: 'scope', label: 'Scope', field: 'HdtScope', lookupKey: 'scope' },
    { id: 'default', label: 'Default', kind: 'boolean', field: 'HdtIsDefault' },
    { id: 'status', label: 'Status', kind: 'status', field: 'HdtStatus', className: 'status-col' },
  ],
  fields: [
    {
      key: 'status',
      source: 'HdtStatus',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    {
      key: 'isDefault',
      source: 'HdtIsDefault',
      payloadKey: 'isDefault',
      label: 'Default template',
      type: 'search-select',
      options: YES_NO_OPTIONS,
      span: 1,
    },
    {
      key: 'name',
      source: 'HdtName',
      payloadKey: 'name',
      label: 'Name',
      required: true,
      span: 1,
    },
    {
      key: 'code',
      source: 'HdtCode',
      payloadKey: 'code',
      label: 'Code',
      placeholder: 'standard-web-mail',
      required: true,
      span: 1,
    },
    {
      key: 'description',
      source: 'HdtDescription',
      payloadKey: 'description',
      label: 'Description',
      span: 3,
    },
    {
      key: 'notes',
      source: 'HdtNotes',
      payloadKey: 'notes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
  initialValues: {
    status: 1,
    scope: 'TENANT',
    isDefault: 0,
    name: '',
    code: '',
    description: '',
    notes: '',
  },
  relatedCollections: [
    {
      key: 'records',
      label: 'DNS records',
      emptyLabel: 'No DNS records found.',
      addLabel: 'Add record',
      savedMessage: 'DNS template record saved successfully.',
      deletedMessage: 'DNS template record deleted successfully.',
      endpoint: (parentUUID) => `hosting/dns/templates/${parentUUID}/records`,
      deleteEndpoint: (parentUUID, row) =>
        `hosting/dns/templates/${parentUUID}/records/${row['HtrUUID']}`,
      uuidField: 'HtrUUID',
      initialValues: {
        hostTemplate: '@',
        type: 'A',
        valueTemplate: '',
        priority: null,
        weight: null,
        port: null,
        ttl: 3600,
        sortOrder: 100,
        required: 1,
        status: 1,
      },
      fields: [
        {
          key: 'status',
          source: 'HtrStatus',
          payloadKey: 'status',
          label: 'Status',
          type: 'status',
          span: 1,
        },
        {
          key: 'type',
          source: 'HtrType',
          payloadKey: 'type',
          label: 'Type',
          type: 'search-select',
          options: RECORD_TYPE_OPTIONS,
          span: 1,
        },
        {
          key: 'hostTemplate',
          source: 'HtrHostTemplate',
          payloadKey: 'hostTemplate',
          label: 'Host',
          required: true,
          span: 1,
        },
        {
          key: 'valueTemplate',
          source: 'HtrValueTemplate',
          payloadKey: 'valueTemplate',
          label: 'Value',
          required: true,
          span: 1,
        },
        {
          key: 'priority',
          source: 'HtrPriority',
          payloadKey: 'priority',
          label: 'Priority',
          type: 'number',
          span: 1,
        },
        {
          key: 'weight',
          source: 'HtrWeight',
          payloadKey: 'weight',
          label: 'Weight',
          type: 'number',
          span: 1,
        },
        {
          key: 'port',
          source: 'HtrPort',
          payloadKey: 'port',
          label: 'Port',
          type: 'number',
          span: 1,
        },
        { key: 'ttl', source: 'HtrTTL', payloadKey: 'ttl', label: 'TTL', type: 'number', span: 1 },
        {
          key: 'sortOrder',
          source: 'HtrSortOrder',
          payloadKey: 'sortOrder',
          label: 'Order',
          type: 'number',
          span: 1,
        },
        {
          key: 'required',
          source: 'HtrRequired',
          payloadKey: 'required',
          label: 'Required',
          type: 'search-select',
          options: YES_NO_OPTIONS,
          span: 1,
        },
      ],
      columns: [
        { id: 'host', label: 'Host', field: 'HtrHostTemplate' },
        { id: 'type', label: 'Type', field: 'HtrType' },
        { id: 'value', label: 'Value', field: 'HtrValueTemplate' },
        { id: 'ttl', label: 'TTL', field: 'HtrTTL', kind: 'number' },
      ],
    },
  ],
};

@Component({
  selector: 'app-hosting-dns-templates',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingDnsTemplatesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly route = inject(ActivatedRoute);
  private readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  private readonly isMaster = computed(() => this.scope() === 'master');

  constructor() {
    super(HOSTING_DNS_TEMPLATE_CONFIG);
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      scope: this.isMaster() ? 'MASTER' : 'TENANT',
    };
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'scope') return SCOPE_OPTIONS;
    if (key === 'type') return RECORD_TYPE_OPTIONS;
    return [];
  }
}
