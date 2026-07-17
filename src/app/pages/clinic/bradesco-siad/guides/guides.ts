import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';

const GUIDE_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'clinic/bradesco/siad/guides',
  uuidField: 'uuid',
  pageTitle: 'Bradesco SIAD guides',
  pageDescription: 'Maintain private guide dossiers before submitting them to Bradesco SIAD.',
  createTitle: 'New SIAD guide', editTitle: 'Edit SIAD guide', dialogDescription: 'Maintain the guide identifiers used by Bradesco SIAD.',
  searchPlaceholder: 'Search', emptyLabel: 'No SIAD guides found.',
  deleteTitle: 'Delete SIAD guide', deleteMessage: 'Delete this SIAD guide?', deleteSelectedTitle: 'Delete selected SIAD guides', deleteSelectedMessage: 'Delete {count} selected SIAD guides?', savedMessage: 'SIAD guide saved successfully.', deletedMessage: 'SIAD guide deleted successfully.', deleteFailedMessage: 'Failed to delete SIAD guide.',
  statusMode: 'string', activeValue: 'ready', inactiveValue: 'draft', activeStatusValues: ['ready', 'queued', 'sending', 'accepted'],
  statusOptions: [
    { value: 'draft', label: 'Draft' }, { value: 'ready', label: 'Ready' }, { value: 'queued', label: 'Queued' }, { value: 'sending', label: 'Sending' }, { value: 'accepted', label: 'Accepted' }, { value: 'rejected', label: 'Rejected' }, { value: 'review', label: 'Review' },
  ],
  initialValues: { movementType: 'SADT', protocol: '', guideNumber: '', insuredNumber: '', eventDate: '' },
  columns: [
    { id: 'protocol', label: 'Protocol', kind: 'identity', field: 'protocol', uuidField: 'uuid' },
    { id: 'movementType', label: 'Movement type', field: 'movementType' }, { id: 'guideNumber', label: 'Guide number', field: 'guideNumber' }, { id: 'insuredNumber', label: 'Insured number', field: 'insuredNumber' }, { id: 'eventDate', label: 'Event date', field: 'eventDate', kind: 'date' }, { id: 'documentCount', label: 'Documents', field: 'documentCount' }, { id: 'status', label: 'Status', field: 'status', kind: 'status' },
  ],
  fields: [
    { key: 'movementType', label: 'Movement type', type: 'select', tab: 'record', span: 1, required: true, options: [{ value: 'SADT', label: 'SADT' }, { value: 'HP', label: 'HP' }, { value: 'HM', label: 'HM' }, { value: 'RG', label: 'RG' }, { value: 'RT', label: 'RT' }, { value: 'LOGJUR', label: 'LOGJUR' }, { value: 'CONSULTA', label: 'CONSULTA' }] },
    { key: 'protocol', label: 'Protocol', type: 'text', tab: 'record', span: 1, required: true }, { key: 'guideNumber', label: 'Guide number', type: 'text', tab: 'record', span: 1, required: true }, { key: 'insuredNumber', label: 'Insured number', type: 'text', tab: 'record', span: 1, required: true }, { key: 'eventDate', label: 'Event date', type: 'date', tab: 'record', span: 1, required: true },
    { key: 'batchNumber', label: 'Batch number', type: 'text', tab: 'record', span: 1 }, { key: 'password', label: 'Guide password', type: 'text', tab: 'record', span: 1 }, { key: 'installment', label: 'Installment', type: 'text', tab: 'record', span: 1 },
  ],
  canCreate: true, canEdit: true, canDelete: false, bulkDelete: false,
};

@Component({ selector: 'app-clinic-bradesco-siad-guides', standalone: true, imports: CONFIGURABLE_CRUD_IMPORTS, templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html' })
export class ClinicBradescoSiadGuidesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() { super(GUIDE_CONFIG); }
}
