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
import { resaleAccountRowActions } from '../../../shared/crud/configurable-crud/account-resale-actions';

// Commercial accounts shared by Sales and POS: the internal account of the reseller (automatic)
// and one account per retail customer Registry workspace. Catalog pages open in account scope.
const config = defineCrud({
  endpoint: 'sale/accounts',
  uuidField: 'CmaUUID',
  pageTitle: 'commerceAccount.title',
  pageDescription: 'commerceAccount.description',
  createTitle: 'commerceAccount.create',
  editTitle: 'commerceAccount.edit',
  serverSidePagination: true,
  bulkDelete: false,
  ...revisionDeletePayloads('CmaUUID', 'CmaRevision'),
  canDeleteRow: (row) => row['CmaKind'] === 'customer',
  initialValues: { workspaceUUID: null, name: '', description: '', status: 1 },
  payload: (values, editing) => {
    const payload: Record<string, unknown> = {
      name: values['name'],
      description: String(values['description'] ?? '').trim() || null,
      status: Number(values['status'] ?? 1) === 0 ? 0 : 1,
    };
    if (editing) payload['revision'] = String(values['revision'] ?? '');
    else payload['workspaceUUID'] = values['workspaceUUID'];
    return payload;
  },
  fields: [
    {
      key: 'status',
      source: 'CmaStatus',
      label: 'Status',
      type: 'status',
      span: 1,
      disabledWhen: ({ editing, values }) => editing && Number(values['CmaIsLegacy']) === 1,
    },
    { key: 'name', source: 'CmaName', label: 'Name', required: true, span: 1 },
    {
      key: 'workspaceUUID',
      source: 'RegWorkspaceRwkUUID',
      label: 'commerceAccount.workspace',
      type: 'search-select',
      span: 2,
      help: 'commerceAccount.workspaceHelp',
      requiredWhen: ({ editing }) => !editing,
      disabledWhen: ({ editing }) => editing,
      remoteLookup: {
        endpoint: 'registry/workspaces?status=1',
        uuidField: 'RwkUUID',
        labelField: 'RwkName',
        descriptionField: 'CustomerName',
        selectedLabelField: 'WorkspaceName',
      },
    },
    { key: 'description', source: 'CmaDescription', label: 'Description', type: 'textarea', span: 2 },
    { key: 'revision', source: 'CmaRevision', label: 'documents.revision', hiddenWhen: () => true },
  ],
  columns: [
    { id: 'name', field: 'CmaName', label: 'Name', kind: 'identity' },
    { id: 'customer', field: 'CustomerName', label: 'Customer' },
    { id: 'workspace', field: 'WorkspaceName', label: 'commerceAccount.workspace' },
    { id: 'status', field: 'CmaStatus', label: 'Status', kind: 'status' },
  ],
});

const SCOPED_PAGES = [
  ['product', 'nav.sale.product', 'shopping_bag', 'tenant.sale.products.read'],
  ['quotation', 'nav.sale.quotation', 'request_quote', 'tenant.sale.quotations.read'],
  ['price-list', 'nav.sale.price-list', 'price_change', 'tenant.sale.price-lists.read'],
  ['category', 'nav.sale.category', 'sell', 'tenant.sale.categories.read'],
  ['brand', 'nav.sale.brand', 'branding_watermark', 'tenant.sale.brands.read'],
  ['unit', 'nav.sale.unit', 'straighten', 'tenant.sale.units.read'],
] as const;

@Component({
  selector: 'app-sale-accounts',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class SaleAccountPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    const router = inject(Router);
    const auth = inject(AuthService);
    const allowed = (permission: string) =>
      hasEffectivePermission(auth.user()?.permissions ?? [], permission);
    const canManage = () => allowed('tenant.commerce.accounts.all');
    super({
      ...config,
      canCreate: canManage() && allowed('tenant.commerce.accounts.write'),
      canEdit: allowed('tenant.commerce.accounts.write'),
      canDelete: canManage() && allowed('tenant.commerce.accounts.delete'),
      rowActions: [
        ...SCOPED_PAGES.map(([path, label, icon, permission]) => ({
          key: path,
          label,
          icon,
          visible: (row: ConfigurableCrudRecord) =>
            Number(row['ServiceAvailable']) === 1 && allowed(permission),
          run: async (row: ConfigurableCrudRecord) => {
            await router.navigate(['/sale', path], {
              queryParams: row['CmaKind'] === 'customer' ? { accountUUID: row['CmaUUID'] } : {},
            });
          },
        })),
        ...resaleAccountRowActions({
          module: 'sale',
          uuidField: 'CmaUUID',
          revisionField: 'CmaRevision',
          portalField: 'CmaPortalEnabled',
          kindField: 'CmaKind',
          memberUuidField: 'CmmUUID',
          memberStatusField: 'CmmStatus',
          publicationLabel: 'commerceAccount.title',
          publicationTitle: 'commerceAccount.title',
          publicationDescription: 'commerceAccount.description',
          portalEnabledLabel: 'commerceAccount.title',
          assignLabel: 'commerceAccount.assignOperator',
          assignTitle: 'commerceAccount.assignOperator',
          operatorsLabel: 'commerceAccount.operators',
          operatorsTitle: 'commerceAccount.operators',
          operatorsDescription: 'commerceAccount.operatorsDescription',
          canManage,
          publication: false,
        }),
      ],
    });
  }
}
