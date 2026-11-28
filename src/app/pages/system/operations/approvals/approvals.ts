import { ClipboardModule } from '@angular/cdk/clipboard';
import {
  Component,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';

import { ApiService } from '../../../../services/api.service';
import { DateTimeFormatService } from '../../../../services/date-time-format.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';
import { openCrudComponentDialog } from '../../../../shared/dialog/crud-dialog.util';
import { bindDialogClosed } from '../../../../shared/dialog/dialog-events.util';
import { focusFirstInvalidField } from '../../../../shared/forms/field-validation';

export type ApprovalDialogMode = 'detail' | 'approve' | 'reject';

export const APPROVAL_STATUS_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'executed', label: 'Executed' },
  { value: 'failed', label: 'Failed' },
  { value: 'expired', label: 'Expired' },
];

export function approvalStatusChipClass(value: unknown): string {
  switch (String(value ?? '').trim().toLowerCase()) {
    case 'executed':
    case 'approved':
    case 'success':
      return 'chip-success';
    case 'pending':
      return 'chip-queued';
    case 'rejected':
    case 'failed':
    case 'error':
      return 'chip-failed';
    case 'expired':
    default:
      return 'chip-skipped';
  }
}

export function isPendingApproval(row: ConfigurableCrudRecord | null | undefined): boolean {
  return String(row?.['status'] ?? '').trim().toLowerCase() === 'pending';
}

export function formatApprovalTarget(row: ConfigurableCrudRecord | null | undefined): string {
  const method = String(row?.['method'] ?? '').trim().toUpperCase();
  const path = String(row?.['path'] ?? '').trim();
  return [method, path].filter(Boolean).join(' ') || '-';
}

export function firstReasonLine(reason: unknown): string {
  const text = String(reason ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed) return trimmed;
  }
  return '-';
}

export function formatApprovalJsonBody(body: unknown): string {
  if (body === null || body === undefined || body === '') return '-';
  if (typeof body === 'string') {
    const trimmed = body.trim();
    if (!trimmed) return '-';
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return trimmed;
    }
  }
  try {
    return JSON.stringify(body, null, 2);
  } catch {
    return String(body);
  }
}

export function approvalExpiryOrDecisionAt(row: ConfigurableCrudRecord | null | undefined): string {
  for (const key of ['decidedAt', 'executedAt', 'expiresAt'] as const) {
    const value = String(row?.[key] ?? '').trim();
    if (value) return value;
  }
  return '';
}

export function sortApprovalsNewestFirst<T extends ConfigurableCrudRecord>(rows: readonly T[]): T[] {
  const epochOf = (value: unknown): number => {
    if (value === null || value === undefined || value === '') return 0;
    const ms = new Date(String(value)).getTime();
    return Number.isFinite(ms) ? ms : 0;
  };
  return [...rows].sort((left, right) => {
    const diff = epochOf(right['createdAt']) - epochOf(left['createdAt']);
    if (diff !== 0) return diff;
    const leftId = Number(left['id'] ?? 0);
    const rightId = Number(right['id'] ?? 0);
    if (Number.isFinite(leftId) && Number.isFinite(rightId) && rightId !== leftId) {
      return rightId - leftId;
    }
    return String(right['uuid'] ?? '').localeCompare(String(left['uuid'] ?? ''));
  });
}

export function extractApprovalItem(
  response: unknown,
  fallback: ConfigurableCrudRecord,
): ConfigurableCrudRecord {
  const envelope = response as {
    data?: { item?: ConfigurableCrudRecord } | ConfigurableCrudRecord;
    item?: ConfigurableCrudRecord;
  } | null;
  const data = envelope?.data;
  const candidate =
    data && typeof data === 'object' && 'item' in data && data.item && typeof data.item === 'object'
      ? (data.item as ConfigurableCrudRecord)
      : data && typeof data === 'object' && !Array.isArray(data)
        ? (data as ConfigurableCrudRecord)
        : envelope?.item && typeof envelope.item === 'object'
          ? envelope.item
          : null;
  return candidate ? { ...fallback, ...candidate } : fallback;
}

const VIEW_ACTION: ConfigurableCrudRowAction = {
  key: 'view-details',
  label: 'View details',
  icon: 'visibility',
  tooltip: 'Inspect the full request, JSON body, SHA-256 and decision.',
  inline: true,
};

const APPROVE_ACTION: ConfigurableCrudRowAction = {
  key: 'approve',
  label: 'Approve',
  icon: 'check_circle',
  tooltip: 'Approve and execute this pending request.',
  inline: true,
  visible: (row) => isPendingApproval(row),
};

const REJECT_ACTION: ConfigurableCrudRowAction = {
  key: 'reject',
  label: 'Reject',
  icon: 'cancel',
  tooltip: 'Reject this pending request with a required note.',
  visible: (row) => isPendingApproval(row),
};

export const APPROVALS_CONFIG: ConfigurableCrudConfig = defineCrud({
  endpoint: 'system/ops/approvals',
  uuidField: 'uuid',
  pageTitle: 'Approval requests',
  pageDescription:
    'Platform operations that require a master review before running. Review the request target, JSON payload, SHA-256 digest and reason before approving or rejecting.',
  createTitle: 'Approval request',
  editTitle: 'Approval request',
  dialogDescription:
    'Review the full request payload, SHA-256 digest and reason before recording a decision.',
  searchPlaceholder: 'Search approval requests',
  emptyLabel: 'No approval requests found.',
  savedMessage: 'Approval decision recorded.',
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  serverSidePagination: true,
  initialPageSize: 20,
  statusMode: 'string',
  activeValue: 'executed',
  inactiveValue: 'rejected',
  activeStatusValues: ['executed', 'approved'],
  statusOptions: APPROVAL_STATUS_OPTIONS,
  initialStatus: 'pending',
  statusFilter: true,
  initialValues: {},
  fields: [],
  columns: [
    {
      id: 'status',
      label: 'Status',
      field: 'status',
      kind: 'status',
      className: 'status-col',
      options: APPROVAL_STATUS_OPTIONS,
      chipClass: (value) => approvalStatusChipClass(value),
    },
    {
      id: 'title',
      label: 'Title',
      field: 'title',
      kind: 'identity',
      uuidField: 'uuid',
      rowAction: 'view-details',
      translateValue: false,
    },
    {
      id: 'request',
      label: 'Method and path',
      value: (row) => formatApprovalTarget(row),
      translateValue: false,
      copyable: true,
    },
    {
      id: 'requested',
      label: 'Requested',
      field: 'createdAt',
      kind: 'datetime',
    },
    {
      id: 'expiresOrDecided',
      label: 'Expires / decided',
      field: 'expiresOrDecidedAt',
      kind: 'datetime',
    },
  ],
  rowActions: [VIEW_ACTION, APPROVE_ACTION, REJECT_ACTION],
});

export type ApprovalDetailDialogData = {
  item: ConfigurableCrudRecord;
  initialMode: ApprovalDialogMode;
  onUpdated: () => void;
};

@Component({
  selector: 'app-system-operations-approvals',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class SystemOperationsApprovalsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    const route = inject(ActivatedRoute, { optional: true });
    super(APPROVALS_CONFIG);
    const linkedUUID = (
      route?.snapshot.queryParamMap.get('uuid') ??
      route?.snapshot.queryParamMap.get('approval') ??
      ''
    ).trim();
    if (linkedUUID) {
      afterNextRender(() => {
        if (!this.destroyRef.destroyed) {
          void this.openApprovalByUUID(linkedUUID, { uuid: linkedUUID }, 'detail');
        }
      });
    }
  }

  protected override async fetchItems(
    filters: Parameters<ConfigurableCrudPageBase<ConfigurableCrudRecord>['fetchItems']>[0],
    abortSignal?: AbortSignal,
  ): Promise<ConfigurableCrudRecord[]> {
    const rows = await super.fetchItems(filters, abortSignal);
    return sortApprovalsNewestFirst(rows).map((row) => ({
      ...row,
      expiresOrDecidedAt: approvalExpiryOrDecisionAt(row),
    }));
  }

  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: ConfigurableCrudRecord,
  ): Promise<void> {
    const uuid = String(row['uuid'] ?? '').trim();
    if (!uuid) return;
    if (action.key === 'view-details') {
      await this.openApprovalByUUID(uuid, row, 'detail');
      return;
    }
    if (action.key === 'approve') {
      await this.openApprovalByUUID(uuid, row, 'approve');
      return;
    }
    if (action.key === 'reject') {
      await this.openApprovalByUUID(uuid, row, 'reject');
    }
  }

  private async openApprovalByUUID(
    uuid: string,
    fallback: ConfigurableCrudRecord,
    initialMode: ApprovalDialogMode,
  ): Promise<void> {
    let item = fallback;
    try {
      const response = await this.api.get<unknown>(
        `system/ops/approvals/${encodeURIComponent(uuid)}`,
      );
      item = extractApprovalItem(response, fallback);
    } catch {
      if (!fallback['title'] && !fallback['path']) {
        this.snack.error(this.t('Failed to load approval request details.'));
        return;
      }
    }

    const mode: ApprovalDialogMode =
      initialMode !== 'detail' && !isPendingApproval(item) ? 'detail' : initialMode;

    const binding = openCrudComponentDialog(
      this.dialog,
      SystemApprovalDetailDialogComponent,
      'crud-form-dialog',
      {
        data: {
          item,
          initialMode: mode,
          onUpdated: () => this.refreshList(),
        } satisfies ApprovalDetailDialogData,
      },
    );
    bindDialogClosed(binding.ref, () => binding.stop(), this.destroyRef);
  }
}

@Component({
  selector: 'app-system-approval-detail-dialog',
  standalone: true,
  imports: [...CONFIGURABLE_CRUD_IMPORTS, ClipboardModule, MatDialogModule],
  templateUrl: './approvals.html',
  styleUrls: ['./approvals.scss'],
})
export class SystemApprovalDetailDialogComponent {
  private readonly data = inject<ApprovalDetailDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<SystemApprovalDetailDialogComponent>);
  private readonly api = inject(ApiService);
  private readonly snack = inject(SnackbarService);
  private readonly dateTime = inject(DateTimeFormatService);

  readonly item = signal<ConfigurableCrudRecord>(this.data.item);
  readonly mode = signal<ApprovalDialogMode>(this.data.initialMode);
  readonly note = signal('');
  readonly noteInvalid = signal(false);
  readonly submitting = signal(false);

  readonly pending = computed(() => isPendingApproval(this.item()));
  readonly statusValue = computed(() => String(this.item()['status'] ?? 'pending').trim());
  readonly statusLabel = computed(() => {
    const current = this.statusValue().toLowerCase();
    const match = APPROVAL_STATUS_OPTIONS.find(
      (option) => String(option.value).toLowerCase() === current,
    );
    return match?.label ?? (this.statusValue() || '-');
  });
  readonly statusClass = computed(() => approvalStatusChipClass(this.item()['status']));

  readonly dialogTitle = computed(() => {
    if (this.mode() === 'approve') return 'Approve request';
    if (this.mode() === 'reject') return 'Reject request';
    return String(this.item()['title'] ?? '').trim() || 'Approval request';
  });

  readonly dialogSubtitle = computed(() => {
    if (this.mode() === 'approve') {
      return 'Confirm the HTTP method, path and reason below before approving and executing this request.';
    }
    if (this.mode() === 'reject') {
      return 'Confirm the HTTP method, path and reason below and enter the rejection note.';
    }
    return 'Review the full request payload, SHA-256 digest and reason before recording a decision.';
  });

  readonly targetText = computed(() => formatApprovalTarget(this.item()));
  readonly reasonFirstLine = computed(() => firstReasonLine(this.item()['reason']));
  readonly reasonText = computed(() => String(this.item()['reason'] ?? '').trim() || '-');
  readonly titleText = computed(() => String(this.item()['title'] ?? '').trim() || '-');
  readonly taskSlugText = computed(() => String(this.item()['taskSlug'] ?? '').trim() || '-');
  readonly requesterText = computed(() => String(this.item()['requesterLabel'] ?? '').trim() || '-');
  readonly methodText = computed(() => String(this.item()['method'] ?? '').trim().toUpperCase() || '-');
  readonly pathText = computed(() => String(this.item()['path'] ?? '').trim() || '-');
  readonly bodySha256Text = computed(() => String(this.item()['bodySha256'] ?? '').trim() || '-');
  readonly formattedBody = computed(() => formatApprovalJsonBody(this.item()['body']));

  readonly createdAtText = computed(
    () => this.dateTime.formatDateTime(this.dateInput(this.item()['createdAt'])) || '-',
  );
  readonly expiresAtText = computed(
    () => this.dateTime.formatDateTime(this.dateInput(this.item()['expiresAt'])) || '-',
  );
  readonly decidedAtText = computed(
    () => this.dateTime.formatDateTime(this.dateInput(this.item()['decidedAt'])) || '-',
  );
  readonly executedAtText = computed(
    () => this.dateTime.formatDateTime(this.dateInput(this.item()['executedAt'])) || '-',
  );
  readonly decisionUserText = computed(
    () => String(this.item()['decisionUserName'] ?? '').trim() || '-',
  );
  readonly decisionNoteText = computed(
    () => String(this.item()['decisionNote'] ?? '').trim() || '-',
  );
  readonly resultStatusText = computed(
    () => String(this.item()['resultStatus'] ?? '').trim() || '-',
  );
  readonly resultSummaryText = computed(
    () => String(this.item()['resultSummary'] ?? '').trim() || '-',
  );
  readonly hasExecutionResult = computed(() => {
    const status = String(this.item()['status'] ?? '').toLowerCase();
    return (
      status === 'executed' ||
      status === 'failed' ||
      Boolean(String(this.item()['resultStatus'] ?? '').trim()) ||
      Boolean(String(this.item()['resultSummary'] ?? '').trim()) ||
      Boolean(String(this.item()['executedAt'] ?? '').trim())
    );
  });
  readonly resultChipClass = computed(() =>
    approvalStatusChipClass(this.item()['resultStatus'] || this.item()['status']),
  );

  startApprove(): void {
    if (!this.pending() || this.submitting()) return;
    this.noteInvalid.set(false);
    this.mode.set('approve');
  }

  startReject(): void {
    if (!this.pending() || this.submitting()) return;
    this.noteInvalid.set(false);
    this.mode.set('reject');
  }

  cancelDecision(): void {
    if (this.submitting()) return;
    this.noteInvalid.set(false);
    this.mode.set('detail');
  }

  close(): void {
    if (this.submitting()) return;
    this.dialogRef.close();
  }

  onNoteInput(value: string): void {
    this.note.set(value);
    if (this.noteInvalid() && value.trim()) {
      this.noteInvalid.set(false);
    }
  }

  notifyCopied(copied: boolean): void {
    copied ? this.snack.success('Data copied.') : this.snack.error('Failed to copy data.');
  }

  async submitDecision(): Promise<void> {
    if (this.submitting() || !this.pending()) return;
    const currentMode = this.mode();
    if (currentMode !== 'approve' && currentMode !== 'reject') return;

    const trimmedNote = this.note().trim();
    if (currentMode === 'reject' && !trimmedNote) {
      this.noteInvalid.set(true);
      this.snack.error('A note is required to reject an approval request.');
      focusFirstInvalidField(() => [document], ['decisionNote']);
      return;
    }

    const uuid = String(this.item()['uuid'] ?? '').trim();
    if (!uuid) return;

    this.submitting.set(true);
    try {
      const actionPath = `system/ops/approvals/${encodeURIComponent(uuid)}/${currentMode}`;
      const payload =
        currentMode === 'reject'
          ? { note: trimmedNote }
          : trimmedNote
            ? { note: trimmedNote }
            : {};
      const response = await this.api.post<unknown>(actionPath, payload);
      let updated = extractApprovalItem(response, this.item());
      try {
        const refreshed = await this.api.get<unknown>(
          `system/ops/approvals/${encodeURIComponent(uuid)}`,
        );
        updated = extractApprovalItem(refreshed, updated);
      } catch {
        // Keep the mutation response when the follow-up read fails.
      }
      this.item.set(updated);
      this.mode.set('detail');
      this.note.set('');
      this.noteInvalid.set(false);
      this.data.onUpdated();

      if (currentMode === 'reject') {
        this.snack.success('Approval request rejected.');
      } else {
        const finalStatus = String(updated['status'] ?? '').toLowerCase();
        const resultStatus = String(updated['resultStatus'] ?? '').toLowerCase();
        if (finalStatus === 'failed' || resultStatus === 'failed' || resultStatus === 'error') {
          this.snack.error('Approval execution failed.');
        } else {
          this.snack.success('Approval executed successfully.');
        }
      }
    } catch (error) {
      const maybe = error as { error?: { error?: string; message?: string }; message?: string };
      const message =
        maybe?.error?.error ?? maybe?.error?.message ?? maybe?.message ?? 'Operation failed.';
      this.snack.error(message);
    } finally {
      this.submitting.set(false);
    }
  }

  private dateInput(value: unknown): Date | string | number | null {
    if (value instanceof Date) return value;
    if (typeof value === 'string' || typeof value === 'number') return value;
    return null;
  }
}
