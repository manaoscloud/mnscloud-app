import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { revisionDeletePayloads } from '../../../shared/crud/configurable-crud/revision-delete';
import {
  CONTRACT_ACCOUNT_LOOKUP,
  DOCUMENT_LOOKUP,
  ENVELOPE_STATUS_OPTIONS,
  ROUTING_TYPE_OPTIONS,
} from '../contracts.common';

export const CONTRACT_ENVELOPES_CONFIG = defineCrud({
  endpoint: 'contracts/envelopes',
  uuidField: 'CteUUID',
  pageTitle: 'contracts.envelopes',
  pageDescription: 'contracts.envelopesDescription',
  createTitle: 'contracts.newEnvelope',
  editTitle: 'contracts.editEnvelope',
  serverSidePagination: true,
  bulkDelete: true,
  initialValues: {
    ContractDocumentCtdUUID: '',
    title: '',
    providerKind: 'mnscloud_native',
    requireTimestamp: 0,
    routingType: 'sequential',
    expiresAt: null,
    originalSha256: '',
    originalStoragePath: '',
    verificationCode: '',
    status: 'draft',
  },
  ...revisionDeletePayloads('CteUUID', 'CteRevision'),
  listFilters: [
    { key: 'accountUUID', label: 'contracts.account', type: 'search-select', span: 1, remoteLookup: CONTRACT_ACCOUNT_LOOKUP },
    { key: 'documentUUID', label: 'contracts.document', type: 'search-select', span: 1, remoteLookup: DOCUMENT_LOOKUP },
    { key: 'status', label: 'contracts.envelopeStatus', type: 'select', span: 1, options: ENVELOPE_STATUS_OPTIONS },
  ],
  fields: [
    { key: 'status', source: 'CteStatus', label: 'Status', type: 'select', span: 1, options: ENVELOPE_STATUS_OPTIONS },
    {
      key: 'documentUUID',
      source: 'ContractDocumentCtdUUID',
      label: 'contracts.document',
      type: 'search-select',
      required: true,
      span: 1,
      remoteLookup: DOCUMENT_LOOKUP,
      quickCreate: false,
      quickCreateExemptReason: 'Contract documents are generated or imported through the document lifecycle workflow, not created from an inline modal.',
    },
    { key: 'title', source: 'CteTitle', label: 'contracts.envelopeTitle', required: true, span: 1 },
    { key: 'routingType', source: 'CteRoutingType', label: 'contracts.routingType', type: 'select', span: 1, options: ROUTING_TYPE_OPTIONS },
    { key: 'requireTimestamp', source: 'CteRequireTimestamp', label: 'contracts.requireTimestamp', type: 'status', span: 1 },
    { key: 'verificationCode', source: 'CteVerificationCode', label: 'contracts.verificationCode', span: 1, disabledWhen: () => true },
    { key: 'expiresAt', source: 'CteExpiresAt', label: 'contracts.expiresAt', type: 'date', span: 1 },
    { key: 'originalSha256', source: 'CteOriginalSha256', label: 'contracts.originalSha256', span: 1, disabledWhen: () => true },
    { key: 'signedSha256', source: 'CteSignedSha256', label: 'contracts.signedSha256', span: 1, disabledWhen: () => true },
    { key: 'revision', source: 'CteRevision', label: 'contracts.revision', hiddenWhen: () => true },
  ],
  columns: [
    { id: 'verificationCode', field: 'CteVerificationCode', label: 'contracts.verificationCode', kind: 'identity' },
    { id: 'title', field: 'CteTitle', label: 'contracts.envelopeTitle' },
    { id: 'documentTitle', field: 'DocumentTitle', label: 'contracts.document' },
    { id: 'status', field: 'CteStatus', label: 'contracts.envelopeStatus' },
    { id: 'signerCount', field: 'SignerCount', label: 'contracts.signers' },
    { id: 'signedCount', field: 'SignedCount', label: 'contracts.signed' },
    { id: 'dateCreated', field: 'CteDateCreated', label: 'contracts.dateCreated' },
  ],
});

@Component({
  selector: 'app-contract-envelopes',
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
  imports: CONFIGURABLE_CRUD_IMPORTS,
  standalone: true,
})
export class ContractEnvelopesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(CONTRACT_ENVELOPES_CONFIG);
  }
}
