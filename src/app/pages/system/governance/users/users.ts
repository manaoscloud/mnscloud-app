import { Component, inject, signal } from '@angular/core';
import { FormField, form as createForm, minLength, required } from '@angular/forms/signals';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudFilters,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { openDataViewerDialog } from '../../../../shared/data-viewer-dialog/data-viewer-dialog';
import {
  AccountAction,
  ApiListResponse,
  GovernanceAction,
  GovernanceUser,
  LegalHold,
} from './user-governance.models';

const STATUS_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

const VIEW_DETAILS_ACTION: ConfigurableCrudRowAction = {
  key: 'view-details',
  label: 'View details',
  icon: 'visibility',
  tooltip: 'View details',
};

const SUSPEND_ACTION: ConfigurableCrudRowAction = {
  key: 'suspend',
  label: 'Suspend',
  icon: 'block',
  tooltip: 'Suspend account',
};

const CLOSE_ACTION: ConfigurableCrudRowAction = {
  key: 'close',
  label: 'Close',
  icon: 'lock',
  tooltip: 'Close account',
};

const ANONYMIZE_ACTION: ConfigurableCrudRowAction = {
  key: 'anonymize',
  label: 'Anonymize',
  icon: 'person_off',
  tooltip: 'Anonymize account',
};

const LEGAL_HOLD_ACTION: ConfigurableCrudRowAction = {
  key: 'legal-hold',
  label: 'Legal hold',
  icon: 'gavel',
  tooltip: 'Create legal hold',
};

const RELEASE_HOLD_ACTION: ConfigurableCrudRowAction = {
  key: 'release-hold',
  label: 'Release legal hold',
  icon: 'lock_open',
  tooltip: 'Release legal hold',
};

const GOVERNANCE_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'system/governance/users',
  uuidField: 'uuid',
  pageTitle: 'User Governance',
  pageDescription:
    'Close, suspend, anonymize, and legally retain accounts without breaking platform history.',
  createTitle: 'User governance',
  editTitle: 'User governance',
  dialogDescription: 'Review account governance details.',
  searchPlaceholder: 'Name or e-mail',
  emptyLabel: 'No users found.',
  deleteTitle: 'Delete user',
  deleteMessage: 'Delete this user?',
  deleteSelectedTitle: 'Delete users',
  deleteSelectedMessage: 'Delete {count} users?',
  savedMessage: 'User governance action completed.',
  deletedMessage: 'User deleted.',
  deleteFailedMessage: 'Failed to delete user.',
  fields: [],
  columns: [
    {
      id: 'name',
      label: 'User',
      kind: 'identity',
      field: 'displayName',
      uuidField: 'uuid',
    },
    { id: 'email', label: 'E-mail', field: 'email' },
    { id: 'access', label: 'Access', field: 'accessCount' },
    {
      id: 'emailVerified',
      label: 'Email verified',
      field: 'emailVerifiedLabel',
      translateValue: true,
    },
    { id: 'legalHolds', label: 'Legal holds', field: 'activeLegalHoldCount' },
    { id: 'lastAction', label: 'Last action', field: 'lastAction' },
    { id: 'created', label: 'Created', kind: 'datetime', field: 'dateCreated' },
    { id: 'status', label: 'Status', kind: 'status', field: 'status', className: 'status-col' },
  ],
  initialValues: {},
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  statusOptions: STATUS_OPTIONS,
  statusFilter: true,
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  rowActions: [
    VIEW_DETAILS_ACTION,
    SUSPEND_ACTION,
    CLOSE_ACTION,
    ANONYMIZE_ACTION,
    LEGAL_HOLD_ACTION,
  ],
};

type GovernanceActionDialogData = {
  action: AccountAction;
  userName: string;
  holdUUID?: string | null;
};

type GovernanceActionDialogResult = {
  reason: string;
  legalBasis: string;
  reference: string;
};

type GovernanceActionFormModel = {
  reason: string;
  legalBasis: string;
  reference: string;
};

@Component({
  selector: 'app-governance-action-dialog',
  standalone: true,
  imports: [
    FormField,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslocoPipe,
  ],
  template: `
    <div class="crud-dialog">
      <header class="dialog-header">
        <div>
          <h2>{{ titleKey() | transloco }}</h2>
          <p>{{ helpKey() | transloco }}</p>
        </div>
      </header>

      <mat-dialog-content class="dialog-content">
        <form class="form-grid">
          <mat-form-field appearance="outline" class="span-4">
            <mat-label>{{ 'Reason' | transloco }}</mat-label>
            <textarea matInput rows="3" [formField]="actionForm.reason"></textarea>
          </mat-form-field>

          @if (data.action !== 'release-hold') {
            <mat-form-field appearance="outline" class="span-4">
              <mat-label>{{ 'Legal basis' | transloco }}</mat-label>
              <input matInput [formField]="actionForm.legalBasis" />
            </mat-form-field>
          }

          @if (data.action === 'legal-hold') {
            <mat-form-field appearance="outline" class="span-4">
              <mat-label>{{ 'Reference' | transloco }}</mat-label>
              <input matInput [formField]="actionForm.reference" />
            </mat-form-field>
          }
        </form>
      </mat-dialog-content>

      <mat-dialog-actions class="form-actions">
        <div class="secondary-actions">
          <button mat-stroked-button type="button" mat-dialog-close>
            {{ 'Cancel' | transloco }}
          </button>
        </div>
        <div class="primary-actions">
          <button
            mat-flat-button
            color="primary"
            type="button"
            [disabled]="!actionForm().valid() || saving()"
            (click)="confirm()"
          >
            <mat-icon>check</mat-icon>
            {{ 'Confirm' | transloco }}
          </button>
        </div>
      </mat-dialog-actions>
    </div>
  `,
})
export class GovernanceActionDialogComponent {
  readonly data = inject<GovernanceActionDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<GovernanceActionDialogComponent>);

  readonly saving = signal(false);

  readonly actionFormModel = signal<GovernanceActionFormModel>({
    reason: '',
    legalBasis: '',
    reference: '',
  });

  readonly actionForm = createForm(this.actionFormModel, (schema) => {
    required(schema.reason);
    minLength(schema.reason, 4);
  });

  titleKey(): string {
    if (this.data.action === 'legal-hold') return 'Create legal hold';
    if (this.data.action === 'release-hold') return 'Release legal hold';
    if (this.data.action === 'close') return 'Close account';
    if (this.data.action === 'anonymize') return 'Anonymize account';
    return 'Suspend account';
  }

  helpKey(): string {
    if (this.data.action === 'anonymize') {
      return 'This removes personal identifiers while preserving relational history. Active legal holds block this action.';
    }
    if (this.data.action === 'close') {
      return 'This closes the account, revokes sessions and keeps relational history for audit and legal purposes.';
    }
    if (this.data.action === 'legal-hold') {
      return 'This prevents future anonymization until the legal hold is released.';
    }
    if (this.data.action === 'release-hold') {
      return 'This releases the selected legal hold and allows future anonymization if no other hold remains active.';
    }
    return 'This blocks sign-in and revokes active sessions without removing relational history.';
  }

  confirm() {
    if (!this.actionForm().valid() || this.saving()) return;
    this.saving.set(true);
    const payload = this.actionFormModel();
    this.dialogRef.close({
      reason: payload.reason.trim(),
      legalBasis: payload.legalBasis.trim(),
      reference: payload.reference.trim(),
    } satisfies GovernanceActionDialogResult);
  }
}

@Component({
  selector: 'app-system-governance-users',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class SystemGovernanceUsersPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(GOVERNANCE_CONFIG);
  }

  override rowActions(row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    const actions: ConfigurableCrudRowAction[] = [
      VIEW_DETAILS_ACTION,
      SUSPEND_ACTION,
      CLOSE_ACTION,
      ANONYMIZE_ACTION,
      LEGAL_HOLD_ACTION,
    ];
    if (Number(row['activeLegalHoldCount'] ?? 0) > 0) {
      actions.push(RELEASE_HOLD_ACTION);
    }
    return actions;
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key === 'view-details') {
      await this.openDetails(row);
      return;
    }

    const accountAction = action.key as AccountAction;
    if (
      accountAction !== 'suspend' &&
      accountAction !== 'close' &&
      accountAction !== 'anonymize' &&
      accountAction !== 'legal-hold' &&
      accountAction !== 'release-hold'
    ) {
      return;
    }

    await this.runGovernanceAction(row, accountAction);
  }

  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.status !== null && filters.status !== undefined && filters.status !== '') {
      params.set('status', String(filters.status));
    }
    params.set('limit', '2000');
    const response = await this.api.get<ApiListResponse<GovernanceUser>>(
      `${this.listEndpoint()}?${params.toString()}`,
    );
    return (response.data?.items ?? []).map((row) => this.decorateRow(row));
  }

  private decorateRow(row: GovernanceUser): ConfigurableCrudRecord {
    const firstName = String(row.FirstName ?? '').trim();
    const lastName = String(row.LastName ?? '').trim();
    const displayName = [firstName, lastName].filter(Boolean).join(' ') || String(row.Email ?? '-');
    const closed = Boolean(row.DateDeleted);
    return {
      uuid: row.UserUUID,
      userUUID: row.UserUUID,
      firstName,
      lastName,
      displayName,
      email: row.Email ?? '',
      status: closed ? 0 : Number(row.Status ?? 0),
      statusLabel: closed ? 'Closed' : Number(row.Status ?? 0) === 1 ? 'Active' : 'Inactive',
      emailVerifiedAt: row.EmailVerifiedAt ?? null,
      emailVerifiedLabel: row.EmailVerifiedAt ? 'Yes' : 'No',
      dateDeleted: row.DateDeleted ?? null,
      dateCreated: row.DateCreated ?? null,
      accessCount: Number(row.AccessCount ?? 0),
      masterAccessCount: Number(row.MasterAccessCount ?? 0),
      activeLegalHoldCount: Number(row.ActiveLegalHoldCount ?? 0),
      lastAction: row.LastAction || '-',
      lastActionAt: row.LastActionAt ?? null,
    };
  }

  private async openDetails(row: ConfigurableCrudRecord) {
    const uuid = String(row['uuid'] ?? '');
    if (!uuid) return;

    this.mutating.set(true);
    try {
      const [actions, holds] = await Promise.all([
        this.fetchActions(uuid),
        this.fetchLegalHolds(uuid),
      ]);

      openDataViewerDialog(this.dialog, {
        title: String(row['displayName'] || 'User governance'),
        description: String(row['email'] || ''),
        status: {
          label: 'Status',
          value: String(row['statusLabel'] || '-'),
          tone: Number(row['status'] ?? 0) === 1 && !row['dateDeleted'] ? 'success' : 'neutral',
        },
        details: [
          { label: 'User UUID', value: uuid, monospace: true, wide: true },
          { label: 'E-mail', value: row['email'], wide: true },
          { label: 'Access', value: row['accessCount'] },
          { label: 'Email verified', value: row['emailVerifiedLabel'], translate: true },
          { label: 'Legal holds', value: row['activeLegalHoldCount'] },
          { label: 'Last action', value: row['lastAction'] },
          { label: 'Created', value: row['dateCreated'], kind: 'datetime' },
        ],
        sections: [
          {
            title: 'Activity',
            table: {
              emptyLabel: 'No governance actions found.',
              columns: [
                { key: 'action', label: 'Action' },
                { key: 'status', label: 'Status' },
                { key: 'reason', label: 'Reason' },
                { key: 'requestedBy', label: 'Requested by' },
                { key: 'created', label: 'Created', kind: 'datetime' },
              ],
              rows: actions.map((item) => ({
                action: item.UaaAction || '-',
                status: item.UaaStatus || '-',
                reason: item.UaaReason || '-',
                requestedBy: item.RequestedByEmail || '-',
                created: item.UaaDateCreated || null,
              })),
            },
          },
          {
            title: 'Legal holds',
            table: {
              emptyLabel: 'No legal holds found.',
              columns: [
                { key: 'id', label: 'ID' },
                { key: 'status', label: 'Status', translate: true },
                { key: 'reason', label: 'Reason' },
                { key: 'legalBasis', label: 'Legal basis' },
                { key: 'reference', label: 'Reference' },
                { key: 'created', label: 'Created', kind: 'datetime' },
                { key: 'released', label: 'Released', kind: 'datetime' },
              ],
              rows: holds.map((item) => ({
                id: item.UlhID || item.UlhUUID,
                status: Number(item.UlhStatus ?? 0) === 1 ? 'Active' : 'Released',
                reason: item.UlhReason || '-',
                legalBasis: item.UlhLegalBasis || '-',
                reference: item.UlhReference || '-',
                created: item.UlhDateCreated || null,
                released: item.UlhDateReleased || null,
              })),
            },
          },
        ],
      });
    } catch (error) {
      this.snack.error(this.errorMessage(error) || this.t('Failed to load user details.'));
    } finally {
      this.mutating.set(false);
    }
  }

  private async runGovernanceAction(row: ConfigurableCrudRecord, action: AccountAction) {
    const uuid = String(row['uuid'] ?? '');
    if (!uuid || this.mutating()) return;

    let holdUUID: string | null = null;
    if (action === 'release-hold') {
      const holds = await this.fetchLegalHolds(uuid);
      const active = holds.find((item) => Number(item.UlhStatus ?? 0) === 1);
      if (!active) {
        this.snack.warning(this.t('No active legal hold found for this user.'));
        return;
      }
      holdUUID = active.UlhUUID;
    }

    const dialogRef = this.dialog.open(GovernanceActionDialogComponent, {
      width: '720px',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100vh - 32px)',
      autoFocus: false,
      restoreFocus: false,
      panelClass: 'crud-dialog-panel',
      data: {
        action,
        userName: String(row['displayName'] ?? ''),
        holdUUID,
      } satisfies GovernanceActionDialogData,
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    if (!result || typeof result !== 'object') return;

    const payload = result as GovernanceActionDialogResult;
    const endpoint =
      action === 'legal-hold'
        ? `system/governance/users/${uuid}/legal-holds`
        : action === 'release-hold' && holdUUID
          ? `system/governance/users/${uuid}/legal-holds/${holdUUID}/release`
          : `system/governance/users/${uuid}/${action}`;
    const body =
      action === 'legal-hold'
        ? payload
        : { reason: payload.reason, legalBasis: payload.legalBasis };

    this.mutating.set(true);
    try {
      await this.api.post(endpoint, body);
      this.snack.success(this.t('User governance action completed.'));
      this.itemsResource.reload();
    } catch (error) {
      this.snack.error(this.errorMessage(error) || this.t('Failed to execute action.'));
    } finally {
      this.mutating.set(false);
    }
  }

  private async fetchActions(userUUID: string): Promise<GovernanceAction[]> {
    const response = await this.api.get<ApiListResponse<GovernanceAction>>(
      `system/governance/users/${userUUID}/actions?limit=100`,
    );
    return response.data?.items ?? [];
  }

  private async fetchLegalHolds(userUUID: string): Promise<LegalHold[]> {
    const response = await this.api.get<ApiListResponse<LegalHold>>(
      `system/governance/users/${userUUID}/legal-holds?limit=100`,
    );
    return response.data?.items ?? [];
  }
}
