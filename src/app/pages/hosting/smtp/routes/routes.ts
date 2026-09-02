import { Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
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
import { openCrudComponentDialog } from '../../../../shared/dialog/crud-dialog.util';

type SmtpAccount = {
  HsaUUID: string;
  HsaName: string;
  HspName?: string;
  HspProvider?: string;
};

type SmtpEventType = {
  code: string;
  label: string;
  description: string;
};

type SmtpEventTypeResponse = {
  status: string;
  data: {
    items: SmtpEventType[];
  };
};

type SmtpRouteTestDialogData = {
  eventType: string;
  subject: string;
  html: string;
};

type SmtpRouteTestPayload = {
  to: string;
  subject: string;
  html: string;
};

const TEST_ACTION: ConfigurableCrudRowAction = {
  key: 'test',
  label: 'Test SMTP',
  icon: 'outgoing_mail',
  tooltip: 'Test SMTP',
};

@Component({
  selector: 'app-hosting-smtp-route-test-dialog',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  template: `
    <div class="crud-dialog">
      <header class="dialog-header">
        <div>
          <h2>{{ 'Test SMTP route' | transloco }}</h2>
          <p>{{ 'Send a transactional test using the selected route.' | transloco }}</p>
        </div>
      </header>

      <div class="dialog-body">
        <div class="form-grid">
          <mat-form-field appearance="outline" class="span-2">
            <mat-label>{{ 'Recipient' | transloco }}</mat-label>
            <input
              matInput
              type="email"
              autocomplete="email"
              [value]="to()"
              (input)="to.set($any($event.target).value)"
              required
            />
          </mat-form-field>

          <mat-form-field appearance="outline" class="span-2">
            <mat-label>{{ 'Subject' | transloco }}</mat-label>
            <input
              matInput
              [value]="subject()"
              (input)="subject.set($any($event.target).value)"
              required
            />
          </mat-form-field>

          <mat-form-field appearance="outline" class="span-4">
            <mat-label>{{ 'HTML' | transloco }}</mat-label>
            <textarea
              matInput
              rows="8"
              [value]="html()"
              (input)="html.set($any($event.target).value)"
              required
            ></textarea>
          </mat-form-field>
        </div>
      </div>

      <mat-dialog-actions class="form-actions">
        <div class="secondary-actions">
          <button mat-stroked-button type="button" (click)="cancel()">
            {{ 'Cancel' | transloco }}
          </button>
        </div>
        <div class="primary-actions">
          <div class="save-split-action is-single-action">
            <button
              mat-flat-button
              color="primary"
              type="button"
              class="save-main-button"
              [disabled]="!canSubmit()"
              (click)="submit()"
            >
              <mat-icon>outgoing_mail</mat-icon>
              {{ 'Send test' | transloco }}
            </button>
          </div>
        </div>
      </mat-dialog-actions>
    </div>
  `,
})
export class HostingSmtpRouteTestDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<HostingSmtpRouteTestDialogComponent>);
  private readonly data = inject<SmtpRouteTestDialogData>(MAT_DIALOG_DATA);

  readonly to = signal('');
  readonly subject = signal(this.data.subject);
  readonly html = signal(this.data.html);
  readonly canSubmit = computed(
    () =>
      Boolean(this.to().trim()) && Boolean(this.subject().trim()) && Boolean(this.html().trim()),
  );

  cancel(): void {
    this.dialogRef.close(null);
  }

  submit(): void {
    if (!this.canSubmit()) return;
    this.dialogRef.close({
      to: this.to().trim(),
      subject: this.subject().trim(),
      html: this.html().trim(),
    } satisfies SmtpRouteTestPayload);
  }
}

const ROUTE_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'hosting/smtp/routes',
  uuidField: 'HsrUUID',
  pageTitle: 'SMTP Routes',
  pageDescription: 'Map event types to SMTP accounts and overrides.',
  createTitle: 'New SMTP route',
  editTitle: 'Edit SMTP route',
  dialogDescription: 'Configure event routing and optional sender overrides.',
  searchPlaceholder: 'Event, account or sender',
  emptyLabel: 'No SMTP routes found.',
  deleteTitle: 'Delete SMTP route',
  deleteMessage: 'Are you sure you want to delete this SMTP route?',
  deleteSelectedTitle: 'Delete selected SMTP routes',
  deleteSelectedMessage: 'Delete {count} selected SMTP routes?',
  savedMessage: 'SMTP route saved successfully.',
  deletedMessage: 'SMTP route deleted successfully.',
  deleteFailedMessage: 'Failed to delete SMTP route.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  bulkDelete: true,
  statusFilter: true,
  rowActions: [TEST_ACTION],
  listFilters: [
    {
      key: 'accountUuid',
      label: 'Account',
      paramKey: 'accountUuid',
      type: 'search-select',
      placeholder: 'Search',
      emptyLabel: 'No records found.',
    },
  ],
  tabLabels: {
    routing: 'Sender',
  },
  initialValues: {
    eventType: 'general',
    accountUuid: '',
    status: 1,
    fromName: '',
    fromEmail: '',
  },
  columns: [
    { id: 'event', label: 'Event', kind: 'related', field: 'HsrEventType', lookupKey: 'eventType' },
    {
      id: 'account',
      label: 'Account',
      kind: 'related',
      field: 'HsaName',
      uuidField: 'HostingSmtpAccountHsaUUID',
    },
    { id: 'from', label: 'From', field: 'HsrFromEmail' },
    {
      id: 'status',
      label: 'Status',
      kind: 'status',
      field: 'HsrIsActive',
      className: 'status-col',
    },
  ],
  fields: [
    {
      key: 'status',
      source: 'HsrIsActive',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    {
      key: 'accountUuid',
      source: 'HostingSmtpAccountHsaUUID',
      payloadKey: 'accountUuid',
      label: 'Account',
      type: 'search-select',
      required: true,
      span: 1,
    },
    {
      key: 'eventType',
      source: 'HsrEventType',
      payloadKey: 'eventType',
      label: 'Event',
      type: 'search-select',
      required: true,
      span: 1,
    },
    {
      key: 'fromName',
      source: 'HsrFromName',
      payloadKey: 'fromName',
      label: 'From name',
      tab: 'routing',
      span: 2,
    },
    {
      key: 'fromEmail',
      source: 'HsrFromEmail',
      payloadKey: 'fromEmail',
      label: 'From email',
      type: 'email',
      tab: 'routing',
      span: 2,
    },
  ],
};

@Component({
  selector: 'app-hosting-smtp-routes',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingSmtpRoutesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly route = inject(ActivatedRoute);
  private readonly accounts = signal<SmtpAccount[]>([]);
  private readonly eventTypes = signal<SmtpEventType[]>([]);
  private readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  private readonly isMaster = computed(() => this.scope() === 'master');
  private readonly rootEndpoint = computed(() =>
    this.isMaster() ? 'system/hosting/smtp' : 'hosting/smtp',
  );
  private readonly endpoint = computed(() => `${this.rootEndpoint()}/routes`);
  private readonly accountOptions = computed<ConfigurableCrudOption[]>(() =>
    this.accounts().map((account) => ({
      value: account.HsaUUID,
      label: account.HsaName,
      description: account.HspName ?? account.HspProvider,
      searchText: `${account.HsaName} ${account.HspName ?? ''} ${account.HspProvider ?? ''} ${account.HsaUUID}`,
    })),
  );
  private readonly eventTypeOptions = computed<ConfigurableCrudOption[]>(() =>
    this.eventTypes().map((event) => ({
      value: event.code,
      label: event.label,
      description: event.description,
      searchText: `${event.code} ${event.label} ${event.description}`,
    })),
  );

  constructor() {
    super(ROUTE_CONFIG);
    void this.fetchLookups();
  }

  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    if (!this.accounts().length || !this.eventTypes().length) await this.fetchLookups();
    return super.fetchItems(filters);
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

  protected override bulkDeleteEndpoint(): string {
    return `${this.endpoint()}/bulk`;
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'accountUuid') return this.accountOptions();
    if (key === 'eventType') return this.eventTypeOptions();
    return [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      eventType: payload['eventType'],
      accountUuid: payload['accountUuid'],
      fromName: payload['fromName'],
      fromEmail: payload['fromEmail'],
      isActive: truthyNumber(payload['status']) === 1,
    };
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key !== 'test') return;
    const uuid = String(row['HsrUUID'] ?? '');
    if (!uuid) return;
    const eventType = String(row['HsrEventType'] ?? 'general');
    const binding = openCrudComponentDialog(
      this.dialog,
      HostingSmtpRouteTestDialogComponent,
      'crud-form-dialog',
      {
        data: {
          eventType,
          subject: `MNSCloud SMTP route test: ${eventType}`,
          html: `<p>This is a test email sent from the ${eventType} SMTP route.</p>`,
        } satisfies SmtpRouteTestDialogData,
      },
    );
    const payload = (await firstValueFrom(
      binding.ref.afterClosed(),
    )) as SmtpRouteTestPayload | null;
    binding.stop();
    if (!payload) return;
    this.mutating.set(true);
    try {
      await this.api.post(`${this.endpoint()}/${uuid}/test`, payload);
      this.snack.success(this.t('SMTP route test email sent.'));
    } catch (error) {
      this.snack.error(this.errorMessage(error) || this.t('Failed to send SMTP route test email.'));
    } finally {
      this.mutating.set(false);
    }
  }

  private async fetchLookups(): Promise<void> {
    try {
      const [accounts, eventTypesResponse] = await Promise.all([
        this.api.get<{ data?: { items?: SmtpAccount[] } }>(
          `${this.rootEndpoint()}/accounts?limit=500&offset=0`,
        ),
        this.api.get<SmtpEventTypeResponse>(`${this.rootEndpoint()}/event-types`),
      ]);
      this.accounts.set(accounts?.data?.items ?? []);
      this.eventTypes.set(eventTypesResponse?.data?.items ?? []);
    } catch (error) {
      this.accounts.set([]);
      this.eventTypes.set([]);
      this.snack.error(this.errorMessage(error) || this.t('Failed to load SMTP routes.'));
    }
  }
}

function truthyNumber(value: unknown): number {
  return value === true || value === 1 || value === '1' ? 1 : 0;
}
