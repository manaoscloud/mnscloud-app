import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudFilterAction,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';
import { openDataViewerDialog } from '../../shared/data-viewer-dialog/data-viewer-dialog';

export const GED_AUDIT_ACTION_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'document.created', label: 'ged.audit.actions.document.created' },
  { value: 'document.updated', label: 'ged.audit.actions.document.updated' },
  { value: 'document.deleted', label: 'ged.audit.actions.document.deleted' },
  { value: 'document.reviewed', label: 'ged.audit.actions.document.reviewed' },
  { value: 'version.ready', label: 'ged.audit.actions.version.ready' },
  { value: 'version.rejected', label: 'ged.audit.actions.version.rejected' },
  { value: 'version.cancelled', label: 'ged.audit.actions.version.cancelled' },
  { value: 'version.downloaded', label: 'ged.audit.actions.version.downloaded' },
  { value: 'version.portal-downloaded', label: 'ged.audit.actions.version.portal-downloaded' },
  { value: 'version.ai-assisted', label: 'ged.audit.actions.version.ai-assisted' },
  { value: 'version.purged', label: 'ged.audit.actions.version.purged' },
  { value: 'account.portal-changed', label: 'ged.audit.actions.account.portal-changed' },
  { value: 'account.member-added', label: 'ged.audit.actions.account.member-added' },
  { value: 'account.member-removed', label: 'ged.audit.actions.account.member-removed' },
];

export const GED_AUDIT_ACTOR_KIND_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'staff', label: 'ged.audit.actorKinds.staff' },
  { value: 'portal', label: 'ged.audit.actorKinds.portal' },
  { value: 'system', label: 'ged.audit.actorKinds.system' },
];

export function gedAuditActionLabel(
  action: unknown,
  t: (key: string) => string,
): string {
  const code = typeof action === 'string' ? action.trim() : '';
  const option = GED_AUDIT_ACTION_OPTIONS.find((item) => item.value === code);
  return option ? t(option.label) : code || '-';
}

export function gedAuditActorKindLabel(
  kind: unknown,
  t: (key: string) => string,
): string {
  const code = typeof kind === 'string' ? kind.trim() : '';
  const option = GED_AUDIT_ACTOR_KIND_OPTIONS.find((item) => item.value === code);
  return option ? t(option.label) : code || '-';
}

export function gedAuditActorText(row: ConfigurableCrudRecord): string {
  const name = row['RdaActorName'] ?? row['ActorName'];
  return typeof name === 'string' && name.trim() ? name.trim() : '-';
}

export function gedAuditShortHash(hash: unknown): string {
  const text = typeof hash === 'string' ? hash.trim() : '';
  return text ? text.slice(0, 12) : '-';
}

const VERIFY_ACTION: ConfigurableCrudFilterAction = {
  key: 'verify',
  label: 'ged.audit.verifyIntegrity',
  icon: 'verified_user',
};

@Component({
  selector: 'app-ged-audit',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class GedAuditPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(
      defineCrud({
        endpoint: 'ged/audit',
        uuidField: 'RdaUUID',
        pageTitle: 'ged.audit.title',
        pageDescription: 'ged.audit.description',
        canCreate: false,
        canEdit: false,
        canDelete: false,
        bulkDelete: false,
        statusFilter: false,
        serverSidePagination: true,
        filterActions: [VERIFY_ACTION],
        listFilters: [
          {
            key: 'accountUUID',
            paramKey: 'accountUUID',
            label: 'ged.account',
            type: 'search-select',
            span: 1,
            remoteLookup: { endpoint: 'ged/accounts', uuidField: 'GacUUID', labelField: 'GacName' },
          },
          {
            key: 'action',
            paramKey: 'action',
            label: 'Action',
            type: 'select',
            span: 1,
            translateOptions: true,
            options: GED_AUDIT_ACTION_OPTIONS,
          },
        ],
        columns: [
          { id: 'date', field: 'RdaDateCreated', label: 'Date', kind: 'datetime' },
          {
            id: 'action',
            field: 'RdaAction',
            label: 'Action',
            options: GED_AUDIT_ACTION_OPTIONS,
            value: (row, t) => gedAuditActionLabel(row['RdaAction'], t),
          },
          {
            id: 'actorKind',
            field: 'RdaActorKind',
            label: 'ged.audit.actorKind',
            options: GED_AUDIT_ACTOR_KIND_OPTIONS,
            value: (row, t) => gedAuditActorKindLabel(row['RdaActorKind'], t),
          },
          {
            id: 'actor',
            field: 'RdaActorName',
            label: 'ged.audit.actor',
            value: (row) => gedAuditActorText(row),
          },
          { id: 'ip', field: 'RdaActorIp', label: 'IP' },
          { id: 'account', field: 'GacName', label: 'ged.account' },
          { id: 'document', field: 'RdcTitle', label: 'Document' },
          { id: 'version', field: 'RdvVersion', label: 'documents.version', kind: 'number' },
          {
            id: 'hash',
            field: 'RdaEventHash',
            label: 'ged.audit.shortHash',
            copyable: true,
            value: (row) => gedAuditShortHash(row['RdaEventHash']),
          },
        ],
        fields: [],
      }),
    );
  }

  override async handleFilterAction(action: ConfigurableCrudFilterAction): Promise<void> {
    if (action.key !== VERIFY_ACTION.key) return;
    try {
      const response = await this.api.get<{
        data?: { checked?: number; valid?: number | boolean; firstInvalidUUID?: string | null };
      }>('ged/audit/verify');
      const data = response?.data ?? {};
      const checked = Number(data.checked ?? 0);
      const valid = data.valid === true || Number(data.valid) === 1;
      const firstInvalidUUID =
        typeof data.firstInvalidUUID === 'string' && data.firstInvalidUUID.trim()
          ? data.firstInvalidUUID.trim()
          : null;
      if (valid) {
        this.snack.success('ged.audit.verifyValidToast', 4000, { checked });
      } else {
        this.snack.error('ged.audit.verifyInvalidToast', 6000, {
          uuid: firstInvalidUUID ?? '-',
        });
      }
      openDataViewerDialog(this.dialog, {
        title: 'ged.audit.verifyIntegrity',
        description: 'ged.audit.verifyDescription',
        status: {
          label: 'Status',
          value: valid ? 'ged.audit.chainValid' : 'ged.audit.chainInvalid',
          tone: valid ? 'success' : 'danger',
        },
        details: [
          {
            label: 'ged.audit.checkedEvents',
            value: String(checked),
          },
          ...(firstInvalidUUID
            ? [
                {
                  label: 'ged.audit.firstInvalidEvent',
                  value: firstInvalidUUID,
                  monospace: true,
                  translate: false,
                },
              ]
            : []),
        ],
      });
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    }
  }
}
