import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';
import { AuthService } from '../../../services/auth.service';
import { hasEffectivePermission } from '../../../core/guards/permission.guard';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { revisionDeletePayloads } from '../../../shared/crud/configurable-crud/revision-delete';
import { ConfigurableCrudCollectionDialog } from '../../../shared/crud/configurable-crud/configurable-crud-collection-dialog';
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
  initialValues: { workspaceUUID: null, name: '', notes: '', status: 1 },
  payload: (values, editing) => {
    const payload: Record<string, unknown> = {
      name: values['name'],
      notes: String(values['notes'] ?? '').trim() || null,
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
    {
      key: 'notes',
      source: 'CmaNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
    },
    { key: 'revision', source: 'CmaRevision', label: 'documents.revision', hiddenWhen: () => true },
  ],
  columns: [
    { id: 'name', field: 'CmaName', label: 'Name', kind: 'identity' },
    { id: 'customer', field: 'CustomerName', label: 'Customer' },
    { id: 'workspace', field: 'WorkspaceName', label: 'commerceAccount.workspace' },
    {
      id: 'portal',
      field: 'CmaPortalEnabled',
      label: 'commerceAccount.portalEnabled',
      kind: 'boolean',
    },
    { id: 'status', field: 'CmaStatus', label: 'Status', kind: 'status' },
  ],
});

/** Operators of a customer shop and the Portal login each one opens the web POS with. */
function operatorsConfig(row: ConfigurableCrudRecord, canManage: boolean) {
  return defineCrud({
    endpoint: `sale/accounts/${row['CmaUUID']}/members`,
    uuidField: 'CmmUUID',
    pageTitle: 'commerceAccount.operators',
    pageDescription: 'commerceAccount.portalUserHelp',
    editTitle: 'commerceAccount.linkPortalUser',
    canCreate: false,
    canDelete: false,
    canEdit: canManage,
    bulkDelete: false,
    initialValues: { portalUserUUID: null },
    fields: [
      {
        key: 'portalUserUUID',
        source: 'RegCustomerUserRcsUUID',
        label: 'commerceAccount.portalUser',
        type: 'search-select',
        help: 'commerceAccount.portalUserHelp',
        span: 1,
        remoteLookup: {
          endpoint: `sale/accounts/${row['CmaUUID']}/portal-users`,
          uuidField: 'RcsUUID',
          labelField: 'RcsUsername',
          descriptionField: 'CustomerName',
          selectedLabelField: 'PortalUsername',
        },
        quickCreate: false,
        quickCreateExemptReason:
          'Portal logins are managed in Registry > Customers by the shop customer.',
      },
    ],
    columns: [
      { id: 'user', field: 'MemberName', label: 'User', kind: 'identity' },
      {
        id: 'portalUser',
        field: 'PortalUsername',
        label: 'commerceAccount.portalUser',
        value: (member, translate) =>
          String(member['PortalUsername'] ?? '').trim() ||
          translate('commerceAccount.noPortalUser'),
      },
      { id: 'status', field: 'CmmStatus', label: 'Status', kind: 'status' },
    ],
  });
}

// Canonical pages opened in the account's scope: Sales catalog and the shop's shared resources.
const SCOPED_PAGES = [
  ['sale/product', 'nav.sale.product', 'shopping_bag', 'tenant.sale.products.read'],
  ['sale/quotation', 'nav.sale.quotation', 'request_quote', 'tenant.sale.quotations.read'],
  ['sale/price-list', 'nav.sale.price-list', 'price_change', 'tenant.sale.price-lists.read'],
  ['sale/category', 'nav.sale.category', 'sell', 'tenant.sale.categories.read'],
  ['sale/brand', 'nav.sale.brand', 'branding_watermark', 'tenant.sale.brands.read'],
  ['sale/unit', 'nav.sale.unit', 'straighten', 'tenant.sale.units.read'],
  ['stock/locations', 'nav.stock.locations', 'warehouse', 'tenant.stock.locations.read'],
  ['stock/movements', 'nav.stock.movements', 'swap_vert', 'tenant.stock.movements.read'],
  [
    'financial/receivables',
    'nav.financial.receivables',
    'receipt_long',
    'tenant.financial.receivables.read',
  ],
  ['financial/payables', 'nav.financial.payables', 'payments', 'tenant.financial.payables.read'],
  [
    'financial/payment-charges',
    'nav.financial.payment-charges',
    'qr_code_2',
    'tenant.financial.payment-charges.read',
  ],
  [
    'financial/gateway-accounts',
    'nav.financial.gateway-accounts',
    'credit_card',
    'tenant.financial.gateway-accounts.read',
  ],
  ['fiscal/issuers', 'nav.fiscal.issuers', 'receipt_long', 'tenant.fiscal.issuers.read'],
  ['fiscal/documents', 'nav.fiscal.documents', 'description', 'tenant.fiscal.documents.read'],
  ['accounting/events', 'nav.accounting.events', 'list_alt', 'tenant.accounting.events.read'],
  ['point-of-sale/terminals', 'nav.pos.terminals', 'point_of_sale', 'tenant.pos.terminals.read'],
  [
    'point-of-sale/sessions',
    'nav.pos.sessions',
    'account_balance_wallet',
    'tenant.pos.sessions.read',
  ],
  ['point-of-sale/sales', 'nav.pos.sales', 'receipt_long', 'tenant.pos.sales.read'],
  ['point-of-sale/devices', 'nav.pos.devices', 'phonelink_lock', 'tenant.pos.devices.read'],
  ['point-of-sale/audit', 'nav.pos.audit', 'policy', 'tenant.pos.audit-events.read'],
] as const;

/**
 * Operators of a customer shop. Editing a member links (or unlinks) the Customer Portal login that
 * opens the web POS as that operator: `PUT sale/accounts/:uuid/members/:userUUID/portal-user`.
 */
@Component({
  selector: 'app-sale-account-operators-dialog',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class SaleAccountOperatorsDialog extends ConfigurableCrudCollectionDialog {
  override async saveItem(_saveAndNew = false): Promise<void> {
    const current = this.editingRecord();
    if (!current || this.saving()) return;
    this.saving.set(true);
    try {
      const portalUserUUID = String(this.formValues()['portalUserUUID'] ?? '').trim() || null;
      await this.api.put(`${this.config.endpoint}/${current['UserUsrUUID']}/portal-user`, {
        portalUserUUID,
      });
      this.snack.success(this.t('commerceAccount.portalUserSaved'));
      this.itemsResource.reload();
      this.closeDialog();
    } catch (error) {
      // The message (for example "already linked") is shown while the dialog stays open.
      this.snack.error(this.t(this.errorMessage(error)));
    } finally {
      this.saving.set(false);
    }
  }
}

@Component({
  selector: 'app-sale-accounts',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class SaleAccountPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly canManageAccounts: () => boolean;

  constructor() {
    const router = inject(Router);
    const auth = inject(AuthService);
    const allowed = (permission: string) =>
      hasEffectivePermission(auth.user()?.permissions ?? [], permission);
    const canManage = () => allowed('tenant.commerce.accounts.all');
    const canPublish = (row: ConfigurableCrudRecord, enabled: boolean) =>
      canManage() &&
      row['CmaKind'] === 'customer' &&
      (Number(row['CmaPortalEnabled']) === 1) === !enabled;
    const publication = (enabled: boolean) => ({
      key: enabled ? 'portalPublish' : 'portalUnpublish',
      label: enabled ? 'commerceAccount.publish' : 'commerceAccount.unpublish',
      icon: enabled ? 'public' : 'public_off',
      visible: (row: ConfigurableCrudRecord) => canPublish(row, enabled),
      request: {
        method: 'put' as const,
        endpoint: (row: ConfigurableCrudRecord) => `sale/accounts/${row['CmaUUID']}/portal`,
        body: (row: ConfigurableCrudRecord) => ({
          enabled,
          revision: String(row['CmaRevision'] ?? ''),
        }),
        successMessage: enabled ? 'commerceAccount.published' : 'commerceAccount.unpublished',
      },
    });
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
            await router.navigate([`/${path}`], {
              queryParams:
                row['CmaKind'] === 'customer'
                  ? { accountUUID: row['CmaUUID'], workspaceUUID: row['RegWorkspaceRwkUUID'] }
                  : {},
            });
          },
        })),
        publication(true),
        publication(false),
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
    this.canManageAccounts = canManage;
  }

  /** Customer shops edit the Portal login of each operator; internal accounts only list them. */
  override async runRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key !== 'operators' || row['CmaKind'] !== 'customer') {
      return super.runRowAction(action, row);
    }
    const binding = openCrudTemplateDialog(
      this.dialog,
      SaleAccountOperatorsDialog,
      ['crud-form-dialog', 'crud-collection-dialog'],
      {
        data: {
          ...operatorsConfig(row, this.canManageAccounts()),
          requestApi: this.api,
          collectionDialog: true,
          formOnly: false,
        },
      },
    );
    await firstValueFrom(binding.ref.afterClosed()).finally(binding.stop);
    this.refreshList();
  }
}
