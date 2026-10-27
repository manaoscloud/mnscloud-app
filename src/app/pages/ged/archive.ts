import { Component, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { hasEffectivePermission } from '../../core/guards/permission.guard';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { DOCUMENT_REVIEW_OPTIONS, documentCollection } from '../registry/documents';

@Component({
  selector: 'app-ged-archive',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class GedArchivePage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    const api = inject(ApiService),
      dialog = inject(MatDialog),
      auth = inject(AuthService);
    const canReview = () =>
      hasEffectivePermission(auth.user()?.permissions ?? [], 'tenant.registry.documents.review');
    const canAssist = () =>
      hasEffectivePermission(auth.user()?.permissions ?? [], 'tenant.registry.documents.ai');
    const config = documentCollection('ged/archive', api, dialog, canReview, canAssist);
    const owned = (row: ConfigurableCrudRecord) =>
      documentCollection(
        `ged/dossiers/${row['GedDossierGdsUUID']}/documents`,
        api,
        dialog,
        canReview,
        canAssist,
      );
    super({
      ...config,
      pageTitle: 'ged.archive',
      pageDescription: 'ged.archiveDescription',
      canCreate: false,
      canEdit: false,
      canDelete: false,
      bulkDelete: false,
      statusFilter: false,
      listFilters: [
        { key: 'GedAccountGacUUID', label: 'ged.account', type: 'search-select', span: 1,
          remoteLookup: { endpoint: 'ged/accounts', uuidField: 'GacUUID', labelField: 'GacName' } },
        {
          key: 'review',
          label: 'documents.review',
          type: 'select',
          span: 1,
          options: DOCUMENT_REVIEW_OPTIONS,
        },
      ],
      columns: [
        ...config.columns,
        { id: 'account', field: 'GacName', label: 'ged.account' },
        { id: 'dossier', field: 'GdsName', label: 'ged.dossiers' },
        {
          id: 'location',
          field: 'GdsPhysicalLocation',
          label: 'ged.physicalLocation',
        },
      ],
      rowActions: [
        {
          key: 'versions',
          label: 'documents.versions',
          icon: 'history',
          collection: (row) =>
            owned(row).rowActions!.find((a) => a.key === 'versions')!.collection!(row),
        },
        {
          key: 'review',
          label: 'documents.review',
          icon: 'fact_check',
          visible: canReview,
          form: (row) => owned(row).rowActions!.find((a) => a.key === 'review')!.form!(row),
        },
      ],
    });
  }
}
