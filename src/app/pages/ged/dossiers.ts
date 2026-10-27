import { revisionDeletePayloads } from '../../shared/crud/configurable-crud/revision-delete';
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
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';
import { registryDocuments } from '../registry/documents';

@Component({
  selector: 'app-ged-dossiers',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class GedDossiersPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    const api = inject(ApiService);
    const dialog = inject(MatDialog);
    const auth = inject(AuthService);
    super(
      defineCrud({
        endpoint: 'ged/dossiers',
        uuidField: 'GdsUUID',
        pageTitle: 'ged.dossiers',
        pageDescription: 'ged.description',
        createTitle: 'ged.newDossier',
        editTitle: 'ged.editDossier',
        serverSidePagination: true,
        bulkDelete: true,
        initialValues: { name: '', description: '', physicalLocation: '', status: 1 },
        ...revisionDeletePayloads('GdsUUID', 'GdsRevision'),
        fields: [
          { key: 'status', source: 'GdsStatus', label: 'Status', type: 'status', span: 1 },
          { key: 'name', source: 'GdsName', label: 'Name', required: true, span: 1 },
          {
            key: 'physicalLocation',
            source: 'GdsPhysicalLocation',
            label: 'ged.physicalLocation',
            span: 1,
          },
          {
            key: 'description',
            source: 'GdsDescription',
            label: 'Description',
            type: 'textarea',
            span: 1,
          },
          {
            key: 'revision',
            source: 'GdsRevision',
            label: 'documents.revision',
            hiddenWhen: () => true,
          },
        ],
        columns: [
          { id: 'name', field: 'GdsName', label: 'Name', kind: 'identity' },
          { id: 'location', field: 'GdsPhysicalLocation', label: 'ged.physicalLocation' },
          { id: 'status', field: 'GdsStatus', label: 'Status', kind: 'status' },
        ],
        relatedCollections: [
          registryDocuments(
            'ged/dossiers',
            api,
            dialog,
            () =>
              hasEffectivePermission(
                auth.user()?.permissions ?? [],
                'tenant.registry.documents.review',
              ),
            () =>
              hasEffectivePermission(
                auth.user()?.permissions ?? [],
                'tenant.registry.documents.ai',
              ),
          ),
        ],
      }),
    );
  }
}
