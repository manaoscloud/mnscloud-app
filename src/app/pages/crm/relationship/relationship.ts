import { injectCrmMemoryScope } from '../crm-context';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../services/auth.service';
import { hasEffectivePermission } from '../../../core/guards/permission.guard';
import { Component, DestroyRef, computed, inject, resource, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ApiService } from '../../../services/api.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { DetailPageComponent } from '../../../shared/pages/detail-page';
import {
  GlobalTableComponent,
  defineGlobalTable,
} from '../../../shared/crud/configurable-crud/global-table';
import { openRecordForm } from '../../../shared/crud/configurable-crud/open-record-form';
import { openQuickCreate } from '../../../shared/crud/configurable-crud/configurable-crud-quick-create-host';
import { openDataViewerDialog } from '../../../shared/data-viewer-dialog/data-viewer-dialog';
import type { ConfigurableCrudRecord } from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { assistedConversion } from '../prospecting-forms';
import { CRM_OPTIONS } from '../crm-options';

// crud-template-exempt: focused resource detail uses DetailPageComponent; its timeline uses the remote global table.
@Component({
  selector: 'app-crm-relationship',
  standalone: true,
  imports: [DetailPageComponent, GlobalTableComponent, MatButtonModule, TranslocoPipe, RouterLink],
  template: `
    <mns-detail-page
      [title]="'crm.prospect.relationship' | transloco"
      [description]="'crm.prospect.relationshipHelp' | transloco"
      [identity]="identity()"
      [recordId]="uuid()"
      [loading]="record.isLoading()"
      (refresh)="refresh()"
    >
      @if (record.error()) {
        <p role="alert">{{ 'crm.failed' | transloco }}</p>
      }
      @if (record.hasValue() && record.value(); as row) {
        <mns-global-table [config]="details" [rows]="[row]" />
        <p>{{ row['need'] }}</p>
        @if (row['opportunityUUID']; as linkedOpportunity) {
          <a
            mat-stroked-button
            [routerLink]="['/crm/relationships/opportunities', linkedOpportunity]"
            >{{ 'crm.title.opportunities' | transloco }}</a
          >
        }
        @if (row['leadUUID']; as linkedLead) {
          <a mat-stroked-button [routerLink]="['/crm/relationships/leads', linkedLead]">{{
            'crm.title.leads' | transloco
          }}</a>
        }
        @if (canWrite()) {
          <button mat-stroked-button (click)="edit()">{{ 'Edit' | transloco }}</button>
          <button mat-stroked-button (click)="createActivity()">
            {{ 'crm.prospect.newActivity' | transloco }}
          </button>
          @if (resourceName() === 'opportunities') {
            <button mat-stroked-button (click)="createProposal()">
              {{ 'crm.prospect.newProposal' | transloco }}
            </button>
          }
          @if (resourceName() === 'leads' && row['state'] === 'qualified') {
            <button mat-stroked-button (click)="convert()">{{ 'crm.convert' | transloco }}</button>
          }
        }
        <button
          mat-stroked-button
          [disabled]="assisting()"
          (click)="assist('crm.prospect_summary')"
        >
          {{ 'crm.prospect.summary' | transloco }}
        </button>
        <button mat-stroked-button [disabled]="assisting()" (click)="assist('crm.next_action')">
          {{ 'crm.prospect.nextAction' | transloco }}
        </button>
        <h2>{{ 'crm.prospect.timeline' | transloco }}</h2>
        <mns-global-table [config]="timeline()" [remote]="true" />
      }
    </mns-detail-page>
  `,
})
export class CrmRelationshipPage {
  private readonly memoryScope = injectCrmMemoryScope();
  private readonly auth = inject(AuthService);
  readonly canWrite = computed(() =>
    hasEffectivePermission(this.auth.user()?.permissions ?? [], 'tenant.crm.write'),
  );
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  private readonly i18n = inject(TranslocoService);
  private readonly snack = inject(SnackbarService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  readonly resourceName = computed(() => this.params().get('resource') ?? '');
  readonly uuid = computed(() => this.params().get('uuid') ?? '');
  private readonly endpoint = computed(
    () => `crm/relationships/${this.resourceName()}/${encodeURIComponent(this.uuid())}`,
  );
  readonly assisting = signal(false);
  private readonly generation = signal(0);
  readonly record = resource({
    params: () => ({ endpoint: this.endpoint(), scope: this.memoryScope() }),
    defaultValue: null as ConfigurableCrudRecord | null,
    loader: async ({ params }): Promise<ConfigurableCrudRecord | null> => {
      if (!['leads', 'opportunities'].includes(this.resourceName()))
        throw new Error('CRM_INVALID_RESOURCE');
      return (await this.api.get<{ data: ConfigurableCrudRecord }>(params.endpoint)).data;
    },
  });
  readonly identity = computed(() =>
    this.record.hasValue() ? String(this.record.value()?.['name'] ?? '') : '',
  );
  readonly details = defineGlobalTable({
    key: 'crm-relationship',
    emptyLabel: 'No records found.',
    uuidField: 'uuid',
    pagination: false,
    columns: [
      { id: 'name', field: 'name', label: 'Name', kind: 'identity' },
      { id: 'workspace', field: 'workspaceName', label: 'crm.field.Workspace' },
      { id: 'owner', field: 'ownerName', label: 'crm.field.AssignedUserUsrUUID' },
      {
        id: 'state',
        field: 'state',
        label: 'crm.field.State',
        options: [...CRM_OPTIONS.leadStates, ...CRM_OPTIONS.stageKinds],
      },
      { id: 'next', field: 'nextContactAt', label: 'crm.field.NextContactAt', kind: 'datetime' },
      { id: 'account', field: 'accountName', label: 'crm.title.accounts' },
      { id: 'contact', field: 'contactName', label: 'crm.title.contacts' },
      { id: 'email', field: 'contactEmail', label: 'Email' },
      { id: 'phone', field: 'contactPhone', label: 'crm.field.Phone', kind: 'phone' },
    ],
  });
  readonly timeline = computed(() => {
    this.generation();
    this.memoryScope();
    return defineGlobalTable({
      key: 'crm-timeline',
      emptyLabel: 'No records found.',
      endpoint: `${this.endpoint()}/timeline`,
      uuidField: 'key',
      serverSidePagination: true,
      initialPageSize: 25,
      pageSizeOptions: [25, 50, 100, 200],
      columns: [
        {
          id: 'title',
          field: 'title',
          label: 'Name',
          kind: 'identity',
          uuidField: 'uuid',
          rowAction: 'notes',
        },
        { id: 'date', field: 'occurredAt', label: 'Date', kind: 'datetime' },
        {
          id: 'resource',
          field: 'resource',
          label: 'crm.prospect.resource',
          options: ['leads', 'opportunities', 'activities', 'proposals', 'handoffs'].map(
            (value) => ({ value, label: `crm.title.${value}` }),
          ),
        },
        { id: 'actor', field: 'actorName', label: 'crm.field.AssignedUserUsrUUID' },
        { id: 'notes', field: 'notes', label: 'Notes', rowAction: 'notes' },
      ],
      rowActions: [
        {
          key: 'notes',
          label: 'crm.prospect.viewNotes',
          icon: 'visibility',
          run: (row) => {
            openDataViewerDialog(this.dialog, {
              title: 'crm.prospect.timeline',
              sections: [{ title: 'Notes', message: row['notes'] ?? row['title'] }],
            });
          },
        },
      ],
    });
  });
  refresh() {
    this.record.reload();
    this.generation.update((n) => n + 1);
  }
  async edit() {
    const { config } =
      this.resourceName() === 'leads'
        ? await import('../leads/leads')
        : await import('../opportunities/opportunities');
    await openRecordForm(this.dialog, {
      ...config,
      requestApi: this.api,
      editRecordUUID: this.uuid(),
    });
    this.refresh();
  }
  async createActivity() {
    await openQuickCreate(this.dialog, {
      loadComponent: () => import('../activities/activities').then((m) => m.CrmActivityPage),
      requestApi: this.api,
      initialValues: {
        [this.resourceName() === 'leads' ? 'CrmLeadCleUUID' : 'CrmOpportunityCopUUID']: this.uuid(),
      },
    });
    this.refresh();
  }
  async createProposal() {
    await openQuickCreate(this.dialog, {
      loadComponent: () => import('../proposals/proposals').then((m) => m.CrmProposalPage),
      requestApi: this.api,
      initialValues: { CrmOpportunityCopUUID: this.uuid() },
    });
    this.refresh();
  }
  async convert() {
    const row = this.record.value();
    if (!row) return;
    await openRecordForm(this.dialog, {
      ...assistedConversion({
        CleUUID: this.uuid(),
        CleName: row['name'],
        CleRevision: row['revision'],
        CrmWorkspaceCwsUUID: row['workspaceUUID'],
      }),
      requestApi: this.api,
    });
    this.refresh();
  }
  async assist(feature: 'crm.prospect_summary' | 'crm.next_action') {
    if (this.assisting()) return;
    this.assisting.set(true);
    const endpoint = this.endpoint();
    const scope = this.memoryScope();
    try {
      const language = this.i18n.getActiveLang();
      const response = await this.api.post<{
        data: {
          summary: string;
          nextAction: string;
          qualificationGaps: string[];
          sourceKeys: string[];
        };
      }>(`${this.endpoint()}/assist`, {
        feature,
        language: ['pt-BR', 'en-US', 'es-ES'].includes(language) ? language : 'en-US',
      });
      if (this.destroyRef.destroyed || endpoint !== this.endpoint() || scope !== this.memoryScope())
        return;
      const data = response.data;
      if (
        typeof data.summary !== 'string' ||
        data.summary.length > 2000 ||
        typeof data.nextAction !== 'string' ||
        data.nextAction.length > 1000 ||
        !Array.isArray(data.qualificationGaps) ||
        data.qualificationGaps.length > 6 ||
        !data.qualificationGaps.every((v) => typeof v === 'string' && v.length <= 1000) ||
        !Array.isArray(data.sourceKeys) ||
        data.sourceKeys.length > 20 ||
        !data.sourceKeys.every((v) => typeof v === 'string' && v.length <= 160)
      )
        throw new Error('CRM_INVALID_RESPONSE');
      openDataViewerDialog(this.dialog, {
        title: 'crm.prospect.suggestion',
        description: 'crm.prospect.manualReview',
        sections: [
          { title: 'crm.prospect.summary', message: data.summary },
          { title: 'crm.prospect.nextAction', message: data.nextAction },
          { title: 'crm.prospect.gaps', message: data.qualificationGaps.join('\n') },
          { title: 'crm.prospect.sources', message: data.sourceKeys.join('\n') },
        ],
      });
    } catch {
      this.snack.error(this.i18n.translate('crm.prospect.aiUnavailable'));
    } finally {
      this.assisting.set(false);
    }
  }
}
