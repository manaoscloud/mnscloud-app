import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { revisionDeletePayloads } from '../../../shared/crud/configurable-crud/revision-delete';
import {
  AUTH_MODE_OPTIONS,
  CONTRACT_ACCOUNT_LOOKUP,
  ENVIRONMENT_OPTIONS,
  PROVIDER_KIND_OPTIONS,
} from '../contracts.common';

export const CONTRACT_PROVIDERS_CONFIG = defineCrud({
  endpoint: 'contracts/providers/bindings',
  uuidField: 'CtbUUID',
  pageTitle: 'contracts.providers',
  pageDescription: 'contracts.providersDescription',
  createTitle: 'contracts.newProvider',
  editTitle: 'contracts.editProvider',
  serverSidePagination: true,
  bulkDelete: false,
  initialValues: {
    ContractAccountCtaUUID: '',
    provider: 'clicksign',
    authMode: 'byo',
    environment: 'sandbox',
    name: '',
    apiKey: '',
    apiSecret: '',
    webhookSecret: '',
    externalAccountId: '',
    isActive: 1,
  },
  ...revisionDeletePayloads('CtbUUID', 'CtbRevision'),
  listFilters: [
    {
      key: 'accountUuid',
      label: 'contracts.account',
      type: 'search-select',
      span: 1,
      remoteLookup: CONTRACT_ACCOUNT_LOOKUP,
    },
    {
      key: 'provider',
      label: 'contracts.provider',
      type: 'select',
      span: 1,
      options: PROVIDER_KIND_OPTIONS,
    },
  ],
  fields: [
    { key: 'isActive', source: 'CtbIsActive', label: 'Status', type: 'status' },
    {
      key: 'accountUuid',
      source: 'ContractAccountCtaUUID',
      label: 'contracts.account',
      type: 'search-select',
      remoteLookup: CONTRACT_ACCOUNT_LOOKUP,
    },
    { key: 'name', source: 'CtbName', label: 'contracts.providerBindingName', required: true },
    {
      key: 'provider',
      source: 'CtbProvider',
      label: 'contracts.provider',
      type: 'select',
      required: true,
      options: PROVIDER_KIND_OPTIONS,
    },
    {
      key: 'authMode',
      source: 'CtbAuthMode',
      label: 'contracts.providerAuthMode',
      type: 'select',
      options: AUTH_MODE_OPTIONS,
    },
    {
      key: 'environment',
      source: 'CtbEnvironment',
      label: 'contracts.providerEnvironment',
      type: 'select',
      options: ENVIRONMENT_OPTIONS,
    },
    { key: 'externalAccountId', source: 'CtbExternalAccountId', label: 'contracts.providerExternalAccountId' },
    { key: 'apiKey', source: 'CtbApiKeyEncrypted', label: 'contracts.providerApiKey', type: 'password' },
    { key: 'apiSecret', source: 'CtbApiSecretEncrypted', label: 'contracts.providerApiSecret', type: 'password' },
    { key: 'webhookSecret', source: 'CtbWebhookSecret', label: 'contracts.providerWebhookSecret', type: 'password' },
    { key: 'webhookToken', source: 'CtbWebhookToken', label: 'contracts.providerWebhookToken', disabledWhen: () => true },
    { key: 'revision', source: 'CtbRevision', label: 'contracts.revision', hiddenWhen: () => true },
  ],
  columns: [
    { id: 'name', field: 'CtbName', label: 'contracts.providerBindingName', kind: 'identity' },
    { id: 'provider', field: 'CtbProvider', label: 'contracts.provider' },
    { id: 'authMode', field: 'CtbAuthMode', label: 'contracts.providerAuthMode' },
    { id: 'environment', field: 'CtbEnvironment', label: 'contracts.providerEnvironment' },
    { id: 'webhookToken', field: 'CtbWebhookToken', label: 'contracts.providerWebhookToken' },
    { id: 'isActive', field: 'CtbIsActive', label: 'Status', kind: 'status' },
  ],
});

@Component({
  selector: 'app-contract-providers',
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
  imports: CONFIGURABLE_CRUD_IMPORTS,
  standalone: true,
})
export class ContractProvidersPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(CONTRACT_PROVIDERS_CONFIG);
  }
}
