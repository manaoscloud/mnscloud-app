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
        initialValues: {
          GedAccountGacUUID: null,
          name: '',
          description: '',
          physicalLocation: '',
          status: 1,
        },
        ...revisionDeletePayloads('GdsUUID', 'GdsRevision'),
        fields: [
          {
            key: 'GedAccountGacUUID',
            source: 'GedAccountGacUUID',
            label: 'ged.account',
            type: 'search-select',
            required: true,
            span: 1,
            disabledWhen: ({ editing }) => editing,
            remoteLookup: {
              endpoint: 'ged/accounts?status=1',
              uuidField: 'GacUUID',
              labelField: 'GacName',
              selectedLabelField: 'GacName',
            },
          },
          { key: 'status', source: 'GdsStatus', label: 'Status', type: 'status', span: 1 },
          { key: 'name', source: 'GdsName', label: 'Name', required: true, span: 1 },
          {
            key: 'physicalLocation',
            source: 'GdsPhysicalLocation',
            label: 'ged.physicalLocation',
            span: 1,
          },
          // business-description: subject of the dossier, part of its identity.
          {
            key: 'description',
            source: 'GdsDescription',
            label: 'Description',
            type: 'textarea',
            span: 4,
          },
          {
            key: 'revision',
            source: 'GdsRevision',
            label: 'documents.revision',
            hiddenWhen: () => true,
          },
        ],
        columns: [
          { id: 'account', field: 'GacName', label: 'ged.account' },
          { id: 'name', field: 'GdsName', label: 'Name', kind: 'identity' },
          { id: 'location', field: 'GdsPhysicalLocation', label: 'ged.physicalLocation' },
          { id: 'status', field: 'GdsStatus', label: 'Status', kind: 'status' },
        ],
        listFilters: [
          {
            key: 'GedAccountGacUUID',
            label: 'ged.account',
            type: 'search-select',
            span: 1,
            remoteLookup: { endpoint: 'ged/accounts', uuidField: 'GacUUID', labelField: 'GacName' },
          },
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
