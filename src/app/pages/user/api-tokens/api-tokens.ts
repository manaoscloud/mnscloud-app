import { ClipboardModule } from '@angular/cdk/clipboard';
import { Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudFilters,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
  ConfigurableCrudSaveContext,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { openCrudComponentDialog } from '../../../shared/dialog/crud-dialog.util';
import { bindDialogClosed } from '../../../shared/dialog/dialog-events.util';
import { SnackbarService } from '../../../services/snackbar.service';

const STATUS_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

const EXPIRATION_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'never', label: 'Never' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '180d', label: '180 days' },
  { value: '365d', label: '365 days' },
  { value: 'custom', label: 'Custom date' },
];

const PERMISSION_OPTIONS: readonly ConfigurableCrudOption[] = buildPermissionOptions([
  ['hosting.smtp.messages', 'Hosting SMTP messages'],
  ['hosting.smtp.providers', 'SMTP providers'],
  ['hosting.smtp.accounts', 'SMTP accounts'],
  ['hosting.smtp.routes', 'SMTP routes'],
  ['hosting.smtp.*', 'SMTP full module'],
  ['hosting.dns.*', 'DNS full module'],
  ['hosting.webhost.*', 'Web hosting full module'],
  ['hosting.vps.*', 'VPS full module'],
  ['erp.*', 'ERP full module'],
  ['billing.*', 'Billing full module'],
  ['voip.*', 'VoIP full module'],
  ['support.*', 'Support full module'],
  ['settings.themes', 'Themes'],
  ['cyber-security.*', 'Cyber security full module'],
  ['system.*', 'System full module'],
]);

const ROTATE_ACTION: ConfigurableCrudRowAction = {
  key: 'rotate',
  label: 'Rotate',
  icon: 'sync_lock',
  tooltip: 'Rotate API token',
};

type ApiTokenSecretDialogData = {
  token: string;
  name: string;
  prefix: string;
};

@Component({
  selector: 'app-api-token-secret-dialog',
  standalone: true,
  imports: [...CONFIGURABLE_CRUD_IMPORTS, ClipboardModule, MatDialogModule],
  template: `
    <div class="crud-dialog">
      <header class="dialog-header">
        <div>
          <h2>{{ 'API token generated' | transloco }}</h2>
          <p>{{ 'Copy and store this token now. It will not be shown again.' | transloco }}</p>
        </div>
      </header>

      <mat-dialog-content class="dialog-content">
        <div class="form-grid">
          <mat-form-field appearance="outline" class="span-2">
            <mat-label>{{ 'Name' | transloco }}</mat-label>
            <input matInput [value]="data.name" readonly />
          </mat-form-field>

          <mat-form-field appearance="outline" class="span-2">
            <mat-label>{{ 'Prefix' | transloco }}</mat-label>
            <input matInput [value]="data.prefix" readonly />
          </mat-form-field>

          <mat-form-field appearance="outline" class="span-4">
            <mat-label>{{ 'TokenApi' | transloco }}</mat-label>
            <textarea matInput rows="4" [value]="data.token" readonly></textarea>
          </mat-form-field>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions class="form-actions">
        <div class="secondary-actions">
          <button mat-stroked-button type="button" mat-dialog-close>
            {{ 'Close' | transloco }}
          </button>
        </div>
        <div class="primary-actions">
          <button
            mat-flat-button
            color="primary"
            type="button"
            [cdkCopyToClipboard]="data.token"
            (cdkCopyToClipboardCopied)="notifyCopied($event)"
          >
            <mat-icon>content_copy</mat-icon>
            {{ 'Copy token' | transloco }}
          </button>
        </div>
      </mat-dialog-actions>
    </div>
  `,
})
export class ApiTokenSecretDialogComponent {
  readonly data = inject<ApiTokenSecretDialogData>(MAT_DIALOG_DATA);
  private readonly snack = inject(SnackbarService);

  notifyCopied(copied: boolean): void {
    copied
      ? this.snack.success('API token copied.')
      : this.snack.error('Failed to copy API token.');
  }
}

const API_TOKEN_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'security/api-tokens',
  uuidField: 'uuid',
  pageTitle: 'API Tokens',
  pageDescription: 'Create, rotate and revoke API tokens for public integrations.',
  createTitle: 'New API token',
  editTitle: 'Edit API token',
  dialogDescription: 'Configure integration access, permissions and expiration.',
  searchPlaceholder: 'Name, prefix or permission',
  emptyLabel: 'No API tokens found.',
  deleteTitle: 'Revoke API token',
  deleteMessage: 'Are you sure you want to revoke this API token?',
  deleteSelectedTitle: 'Revoke selected API tokens',
  deleteSelectedMessage: 'Revoke {count} selected API tokens?',
  savedMessage: 'API token saved successfully.',
  deletedMessage: 'API token revoked successfully.',
  deleteFailedMessage: 'Failed to revoke API token.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  statusOptions: STATUS_OPTIONS,
  statusFilter: true,
  bulkDelete: false,
  rowActions: [ROTATE_ACTION],
  tabLabels: {
    authentication: 'Permissions',
    notes: 'Notes',
  },
  initialValues: {
    name: '',
    status: 1,
    expirationPreset: 'never',
    customExpirationDate: '',
    permissions: [],
    allowedIpsText: '',
    description: '',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'name', uuidField: 'uuid' },
    { id: 'prefix', label: 'Prefix', field: 'prefix', copyable: true },
    { id: 'scope', label: 'Scope', field: 'scope' },
    { id: 'permissions', label: 'Permissions', field: 'permissions' },
    { id: 'lastUsedAt', label: 'Last used', kind: 'datetime', field: 'lastUsedAt' },
    { id: 'expiresAt', label: 'Expires', kind: 'datetime', field: 'expiresAt' },
    { id: 'status', label: 'Status', kind: 'status', field: 'status', className: 'status-col' },
  ],
  fields: [
    {
      key: 'status',
      source: 'status',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    {
      key: 'name',
      source: 'name',
      payloadKey: 'name',
      label: 'Name',
      required: true,
      span: 1,
    },
    {
      key: 'expirationPreset',
      source: 'expiresAt',
      payloadKey: 'expirationPreset',
      label: 'Expiration',
      type: 'select',
      options: EXPIRATION_OPTIONS,
      span: 1,
      fromRecord: (value) => (value ? 'custom' : 'never'),
    },
    {
      key: 'customExpirationDate',
      source: 'expiresAt',
      payloadKey: 'expiresAt',
      label: 'Custom expiration date',
      type: 'date',
      span: 1,
      hiddenWhen: ({ values }) => values['expirationPreset'] !== 'custom',
      requiredWhen: ({ values }) => values['expirationPreset'] === 'custom',
      fromRecord: (value) => dateOnly(value),
    },
    {
      key: 'permissions',
      source: 'permissions',
      payloadKey: 'permissions',
      label: 'Permissions',
      type: 'search-select',
      tab: 'authentication',
      required: true,
      span: 4,
      multiple: true,
      placeholder: 'Search',
      options: PERMISSION_OPTIONS,
      fromRecord: (value) => permissionList(value),
    },
    {
      key: 'allowedIpsText',
      source: 'allowedIps',
      payloadKey: 'allowedIps',
      label: 'Allowed IPs',
      type: 'textarea',
      tab: 'authentication',
      rows: 4,
      span: 4,
      placeholder: '203.0.113.10\n198.51.100.20',
      fromRecord: (value) => listToLines(value),
    },
    {
      key: 'description',
      source: 'description',
      payloadKey: 'description',
      label: 'Description',
      type: 'textarea',
      tab: 'notes',
      rows: 4,
      span: 4,
    },
  ],
};

@Component({
  selector: 'app-user-api-tokens',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class UserApiTokensPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly route = inject(ActivatedRoute);
  private readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  private readonly isMaster = computed(() => this.scope() === 'master');
  private readonly endpoint = computed(() =>
    this.isMaster() ? 'system/security/api-tokens' : 'security/api-tokens',
  );

  constructor() {
    super(API_TOKEN_CONFIG);
  }

  protected override listEndpoint(): string {
    return this.endpoint();
  }

  protected override createEndpoint(): string {
    return this.endpoint();
  }

  protected override updateEndpoint(): string {
    return this.endpoint();
  }

  protected override deleteEndpointFor(_row: ConfigurableCrudRecord): string {
    return this.endpoint();
  }

  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    return await super.fetchItems(filters);
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      name: payload['name'],
      status: toStatus(payload['status']),
      expiresAt: expirationToDateTime(payload['expirationPreset'], payload['expiresAt']),
      permissions: permissionList(payload['permissions']),
      allowedIps: linesToList(payload['allowedIps']),
      description: payload['description'] || null,
    };
  }

  protected override async afterSave(
    context: ConfigurableCrudSaveContext<ConfigurableCrudRecord>,
  ): Promise<void> {
    const data = (context.response as { data?: { token?: string; item?: ConfigurableCrudRecord } })
      ?.data;
    if (!data?.token) return;
    this.openTokenDialog(data.token, data.item ?? context.payload);
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key !== 'rotate') return;
    const uuid = String(row['uuid'] ?? '');
    if (!uuid) return;
    const confirmed = await this.confirmAction(
      'Rotate API token',
      'The current token secret will stop working immediately. Generate a new one?',
      'Rotate',
    );
    if (!confirmed) return;

    this.mutating.set(true);
    try {
      const response = await this.api.post<{
        data?: { token?: string; item?: ConfigurableCrudRecord };
      }>(`${this.endpoint()}/${uuid}/rotate`, {});
      this.itemsResource.reload();
      const token = response?.data?.token;
      if (token) this.openTokenDialog(token, response?.data?.item ?? row);
      this.snack.success(this.t('API token rotated successfully.'));
    } catch (error) {
      this.snack.error(this.errorMessage(error) || this.t('Failed to rotate API token.'));
    } finally {
      this.mutating.set(false);
    }
  }

  private openTokenDialog(token: string, item: ConfigurableCrudRecord): void {
    const binding = openCrudComponentDialog(
      this.dialog,
      ApiTokenSecretDialogComponent,
      'crud-form-dialog',
      {
        data: {
          token,
          name: String(item['name'] ?? ''),
          prefix: String(item['prefix'] ?? ''),
        } satisfies ApiTokenSecretDialogData,
      },
    );
    bindDialogClosed(binding.ref, () => binding.stop(), this.destroyRef);
  }
}

function listToLines(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).join('\n');
  return String(value ?? '');
}

function linesToList(value: unknown): string[] {
  return String(value ?? '')
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toStatus(value: unknown): number {
  return value === true || value === 1 || value === '1' ? 1 : 0;
}

function permissionList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value ?? '')
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function expirationToDateTime(presetValue: unknown, customDateValue: unknown): string | null {
  const preset = String(presetValue ?? 'never');
  if (preset === 'never') return null;
  if (preset === 'custom') {
    const customDate = String(customDateValue ?? '').trim();
    return customDate ? `${customDate}T23:59:59Z` : null;
  }
  const days = Number(preset.replace(/d$/, ''));
  if (!Number.isFinite(days) || days <= 0) return null;
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(23, 59, 59, 0);
  return date.toISOString();
}

function dateOnly(value: unknown): string {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, 10) : '';
}

function buildPermissionOptions(resources: readonly (readonly [string, string])[]) {
  const actions = [
    ['read', 'Read'],
    ['write', 'Create and update'],
    ['delete', 'Delete'],
  ] as const;
  return [
    { value: '*', label: 'All resources and actions' },
    ...resources.flatMap(([resource, label]) =>
      actions.map(([action, actionLabel]) => ({
        value: `${resource}:${action}`,
        label: `${label} - ${actionLabel}`,
        searchText: `${resource} ${label} ${action} ${actionLabel}`,
      })),
    ),
  ];
}
