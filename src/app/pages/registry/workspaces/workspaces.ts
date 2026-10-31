import { resaleAccountFields } from '../../../shared/crud/configurable-crud/account-resale-actions';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { hasEffectivePermission } from '../../../core/guards/permission.guard';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { revisionDeletePayloads } from '../../../shared/crud/configurable-crud/revision-delete';

const config = defineCrud({
  endpoint: 'registry/workspaces',
  uuidField: 'RwkUUID',
  pageTitle: 'registryWorkspace.title',
  pageDescription: 'registryWorkspace.description',
  serverSidePagination: true,
  bulkDelete: true,
  ...revisionDeletePayloads('RwkUUID', 'RwkRevision'),
  canDeleteRow: (row) => Boolean(row['RegCustomerRcuUUID']),
  initialValues: { name: '', notes: '', RegCustomerRcuUUID: null, status: 1 },
  fields: resaleAccountFields({
    statusField: 'RwkStatus',
    nameField: 'RwkName',
    descField: 'RwkDescription',
    revField: 'RwkRevision',
    customerKey: 'RegCustomerRcuUUID',
    requireCustomer: true,
    statusDisabledWhen: ({ editing, values }) => editing && !values['RegCustomerRcuUUID'],
  }),
  columns: [
    { id: 'name', field: 'RwkName', label: 'Name', kind: 'identity' },
    { id: 'customer', field: 'CustomerName', label: 'Customer' },
    { id: 'status', field: 'RwkStatus', label: 'Status', kind: 'status' },
  ],
});
@Component({
  selector: 'app-workspaces',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class RegWorkspacePage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    const router = inject(Router);
    const auth = inject(AuthService);
    const allowed = (action: string) =>
      hasEffectivePermission(
        auth.user()?.permissions ?? [],
        `tenant.registry.workspaces.${action}`,
      );
    super({
      ...config,
      canCreate: allowed('all') && allowed('write'),
      canEdit: allowed('all') && allowed('write'),
      canDelete: allowed('all') && allowed('delete'),
      rowActions: [
        ['companies', 'Companies', 'apartment'],
        ['employees', 'Employees', 'badge'],
        ['departments', 'Departments', 'groups'],
        ['positions', 'Positions', 'work'],
        ['cost-centers', 'Cost centers', 'account_tree'],
      ].map(([path, label, icon]) => ({
        key: path,
        label,
        icon,
        visible: (row) =>
          Number(row['RwkStatus']) === 1 &&
          hasEffectivePermission(auth.user()?.permissions ?? [], `tenant.registry.${path}.read`),
        run: async (row) => {
          await router.navigate(['/registry', path], {
            queryParams: { workspaceUUID: row['RwkUUID'] },
          });
        },
      })),
    });
  }
}
