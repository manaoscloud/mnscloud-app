import { Component, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { ClinicBradescoSiadGuideDossierDialogComponent } from './guide-dossier-dialog';

const GUIDE_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'clinic/bradesco/siad/guides',
  uuidField: 'uuid',
  pageTitle: 'siad.guides.title',
  pageDescription: 'siad.guides.description',
  createTitle: 'siad.guides.createTitle',
  editTitle: 'siad.guides.editTitle',
  dialogDescription: 'siad.guides.dialogDescription',
  searchPlaceholder: 'Search',
  emptyLabel: 'siad.guides.empty',
  deleteTitle: 'siad.guides.deleteTitle',
  deleteMessage: 'siad.guides.deleteMessage',
  deleteSelectedTitle: 'siad.guides.deleteSelectedTitle',
  deleteSelectedMessage: 'siad.guides.deleteSelectedMessage',
  savedMessage: 'siad.guides.saved',
  deletedMessage: 'siad.guides.deleted',
  deleteFailedMessage: 'siad.guides.deleteFailed',
  statusMode: 'string',
  activeValue: 'ready',
  inactiveValue: 'draft',
  activeStatusValues: ['ready', 'queued', 'sending', 'accepted'],
  statusOptions: [
    { value: 'draft', label: 'siad.status.draft' },
    { value: 'ready', label: 'siad.status.ready' },
    { value: 'queued', label: 'siad.status.queued' },
    { value: 'sending', label: 'siad.status.sending' },
    { value: 'accepted', label: 'siad.status.accepted' },
    { value: 'rejected', label: 'siad.status.rejected' },
    { value: 'review', label: 'siad.status.review' },
  ],
  initialValues: {
    movementType: 'SADT',
    protocol: '',
    guideNumber: '',
    insuredNumber: '',
    eventDate: '',
  },
  columns: [
    {
      id: 'protocol',
      label: 'siad.field.protocol',
      kind: 'identity',
      field: 'protocol',
      uuidField: 'uuid',
    },
    { id: 'movementType', label: 'siad.field.movementType', field: 'movementType' },
    { id: 'guideNumber', label: 'siad.field.guideNumber', field: 'guideNumber' },
    { id: 'insuredNumber', label: 'siad.field.insuredNumber', field: 'insuredNumber' },
    { id: 'eventDate', label: 'siad.field.eventDate', field: 'eventDate', kind: 'date' },
    { id: 'documentCount', label: 'siad.field.documents', field: 'documentCount' },
    { id: 'status', label: 'Status', field: 'status', kind: 'status' },
  ],
  fields: [
    {
      key: 'movementType',
      label: 'siad.field.movementType',
      type: 'select',
      tab: 'record',
      span: 1,
      required: true,
      options: [
        { value: 'SADT', label: 'SADT' },
        { value: 'HP', label: 'HP' },
        { value: 'HM', label: 'HM' },
        { value: 'RG', label: 'RG' },
        { value: 'RT', label: 'RT' },
        { value: 'LOGJUR', label: 'LOGJUR' },
        { value: 'CONSULTA', label: 'CONSULTA' },
      ],
    },
    {
      key: 'protocol',
      label: 'siad.field.protocol',
      type: 'text',
      tab: 'record',
      span: 1,
      required: true,
    },
    {
      key: 'guideNumber',
      label: 'siad.field.guideNumber',
      type: 'text',
      tab: 'record',
      span: 1,
      required: true,
    },
    {
      key: 'insuredNumber',
      label: 'siad.field.insuredNumber',
      type: 'text',
      tab: 'record',
      span: 1,
      required: true,
    },
    {
      key: 'eventDate',
      label: 'siad.field.eventDate',
      type: 'date',
      tab: 'record',
      span: 1,
      required: true,
    },
    { key: 'batchNumber', label: 'siad.field.batchNumber', type: 'text', tab: 'record', span: 1 },
    { key: 'password', label: 'siad.field.guidePassword', type: 'text', tab: 'record', span: 1 },
    { key: 'installment', label: 'siad.field.installment', type: 'text', tab: 'record', span: 1 },
  ],
  rowActions: [
    {
      key: 'dossier',
      label: 'siad.dossier.title',
      icon: 'folder_open',
      tooltip: 'siad.dossier.actionHint',
    },
  ],
  canCreate: true,
  canEdit: true,
  canDelete: false,
  bulkDelete: false,
};

@Component({
  selector: 'app-clinic-bradesco-siad-guides',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
})
export class ClinicBradescoSiadGuidesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly dossierDialog = inject(MatDialog);

  constructor() {
    super(GUIDE_CONFIG);
  }

  override async handleRowAction(
    action: { key: string },
    row: ConfigurableCrudRecord,
  ): Promise<void> {
    if (action.key !== 'dossier') return;
    const guideUUID = String(row.uuid ?? '');
    if (!guideUUID) return;
    const ref = this.dossierDialog.open(ClinicBradescoSiadGuideDossierDialogComponent, {
      width: 'min(960px, calc(100vw - 1.5rem))',
      maxWidth: '99vw',
      maxHeight: '95dvh',
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'crud-form-dialog',
      data: { guideUUID },
    });
    await new Promise<void>((resolve) => ref.afterClosed().subscribe(() => resolve()));
    this.refreshList();
  }
}
