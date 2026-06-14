import {
  Component,
  DestroyRef,
  TemplateRef,
  afterNextRender,
  computed,
  effect,
  inject,
  resource,
  signal,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';

import { FormField, form as createForm, minLength, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { AppI18nService } from '../../../services/app-i18n.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../shared/refresh-button/refresh-button';
import {
  CyberSecurityTrustedNode,
  CyberSecurityTrustedNodesService,
} from '../trusted-nodes/cyber-security-trusted-nodes.service';
import {
  CyberSecurityNetworkPolicy,
  CyberSecurityNetworkPolicyPayload,
  CyberSecurityNetworkPoliciesService,
} from './cyber-security-network-policies.service';

type CyberSecurityNetworkPoliciesSnapshot = {
  policies: CyberSecurityNetworkPolicy[];
  trustedNodes: CyberSecurityTrustedNode[];
};

@Component({
  selector: 'app-cyber-security-network-policies',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    FormField,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    MatTabsModule,
    TranslocoPipe,
    MatTooltipModule,
  ],
  templateUrl: './network-policies.html',
  styleUrls: ['./network-policies.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CyberSecurityNetworkPoliciesPage {
  private readonly policiesApi = inject(CyberSecurityNetworkPoliciesService);
  private readonly trustedNodesApi = inject(CyberSecurityTrustedNodesService);
  private readonly dialog = inject(MatDialog);
  private readonly i18n = inject(AppI18nService);
  private readonly snack = inject(SnackbarService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly listLimit = 1000;

  readonly saving = signal(false);
  private readonly mutating = signal(false);
  readonly editing = signal<CyberSecurityNetworkPolicy | null>(null);
  readonly trustedNodeSearch = signal('');
  readonly searchInput = signal('');
  readonly search = signal('');
  readonly selectedPolicyUUIDs = signal<Set<string>>(new Set());
  private readonly networkPoliciesResource = resource({
    params: () => this.search(),
    defaultValue: { policies: [], trustedNodes: [] } as CyberSecurityNetworkPoliciesSnapshot,
    loader: ({ params }) => this.loadNetworkPoliciesSnapshot(params),
  });

  readonly loading = computed(() => this.networkPoliciesResource.isLoading() || this.mutating());
  readonly trustedNodes = computed(() => this.networkPoliciesResource.value().trustedNodes);

  readonly filteredTrustedNodes = computed(() => {
    const search = this.trustedNodeSearch().trim().toLowerCase();
    if (!search) return this.trustedNodes();
    return this.trustedNodes().filter((node) =>
      `${node.name ?? ''} ${node.nodeUUID ?? ''} ${node.hostname ?? ''} ${node.nodeType ?? ''}`
        .toLowerCase()
        .includes(search),
    );
  });

  readonly dataSource = new MatTableDataSource<CyberSecurityNetworkPolicy>([]);
  readonly displayedColumns = [
    'select',
    'name',
    'endpointGroup',
    'action',
    'mode',
    'rateLimit',
    'node',
    'status',
    'actions',
  ];

  readonly formModel = signal(this.defaultFormValue());
  readonly form = createForm(this.formModel, (path) => {
    required(path.name);
    minLength(path.name, 2);
    required(path.endpointGroup);
    required(path.action);
    required(path.scope);
    required(path.mode);
    required(path.priority);
    required(path.nodeType);
    required(path.networks);
    required(path.methods);
  });

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly networkPolicyFormDialog = viewChild<TemplateRef<unknown>>('networkPolicyFormDialog');

  private networkPolicyDialogBinding: CrudDialogBinding | null = null;
  private lastLoadError = '';

  private readonly syncNetworkPolicies = effect(() => {
    this.dataSource.data = this.networkPoliciesResource.value().policies;
    queueMicrotask(() => this.reconcileSelection());
  });

  private readonly reportLoadError = effect(() => {
    const error = this.networkPoliciesResource.error();
    if (!error) {
      this.lastLoadError = '';
      return;
    }

    const message = this.extractErrorMessage(error, 'Failed to load network policies.');
    if (message !== this.lastLoadError) {
      this.lastLoadError = message;
      this.snack.error(message);
    }
  });

  private readonly setupTable = afterNextRender(() => {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'name':
          return data.name ?? '';
        case 'endpointGroup':
          return data.endpointGroup ?? '';
        case 'action':
          return data.action ?? '';
        case 'mode':
          return data.mode ?? '';
        case 'rateLimit':
          return Number(data.rateLimitPerMinute ?? 0);
        case 'node':
          return data.trustedNodeName || this.trustedNodeLabel(data.trustedNodeUUID);
        case 'status':
          return this.isActive(data) ? 'ACTIVE' : 'INACTIVE';
        default:
          return '';
      }
    };
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.closeNetworkPolicyDialog());
  }

  applySearchFilters() {
    const nextSearch = this.searchInput().trim();
    if (nextSearch === this.search()) {
      this.networkPoliciesResource.reload();
    } else {
      this.search.set(nextSearch);
    }
  }

  clearSearchFilters() {
    this.searchInput.set('');
    if (this.search()) {
      this.search.set('');
    } else {
      this.networkPoliciesResource.reload();
    }
  }

  clearTrustedNodeSearch(open: boolean) {
    if (!open) this.trustedNodeSearch.set('');
  }

  refreshList() {
    this.networkPoliciesResource.reload();
  }

  startCreate() {
    this.editing.set(null);
    this.formModel.set(this.defaultFormValue());
    this.openNetworkPolicyDialog();
  }

  startEdit(policy: CyberSecurityNetworkPolicy) {
    this.editing.set(policy);
    this.fillForm(policy);
    this.openNetworkPolicyDialog();
  }

  async saveItem(saveAndNew = false) {
    if (!this.form().valid()) return;

    let payload: CyberSecurityNetworkPolicyPayload;
    try {
      payload = this.buildPayload();
    } catch (error: any) {
      this.snack.error(this.extractErrorMessage(error, 'Invalid form data.'));
      return;
    }

    const createMode = !this.editing();
    this.saving.set(true);

    try {
      const editing = this.editing();
      if (editing?.uuid) {
        await this.policiesApi.update(editing.uuid, payload);
        this.snack.success('Network policy updated successfully.');
      } else {
        await this.policiesApi.create(payload);
        this.snack.success('Network policy created successfully.');
      }

      this.networkPoliciesResource.reload();

      if (saveAndNew && createMode) {
        this.formModel.set(this.defaultFormValue());
        this.editing.set(null);
        return;
      }

      this.cancelForm();
    } catch (error: any) {
      this.snack.error(this.extractErrorMessage(error, 'Failed to save network policy.'));
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNewItem() {
    if (this.editing()) return;
    void this.saveItem(true);
  }

  cancelForm() {
    this.closeNetworkPolicyDialog();
    this.formModel.set(this.defaultFormValue());
    this.editing.set(null);
  }

  async deleteItem(policy: CyberSecurityNetworkPolicy) {
    if (!policy.uuid) return;
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: this.t('Delete network policy'),
        message: `${this.t('Are you sure you want to delete')} "${policy.name}"?`,
        confirmLabel: this.t('Delete'),
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.mutating.set(true);
    try {
      await this.policiesApi.remove(policy.uuid);
      this.snack.success('Network policy deleted successfully.');
      this.networkPoliciesResource.reload();
    } catch (error: any) {
      this.snack.error(this.extractErrorMessage(error, 'Failed to delete network policy.'));
    } finally {
      this.mutating.set(false);
    }
  }

  get selectedCount() {
    return this.selectedPolicyUUIDs().size;
  }

  visibleRows() {
    const filtered = this.dataSource.filter ? this.dataSource.filteredData : this.dataSource.data;
    const paginator = this.dataSource.paginator;
    if (!paginator) return filtered;
    const start = paginator.pageIndex * paginator.pageSize;
    return filtered.slice(start, start + paginator.pageSize);
  }

  isSelected(policy: CyberSecurityNetworkPolicy) {
    return !!policy.uuid && this.selectedPolicyUUIDs().has(policy.uuid);
  }

  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  togglePolicySelection(policy: CyberSecurityNetworkPolicy, checked: boolean) {
    if (!policy.uuid) return;
    this.selectedPolicyUUIDs.update((current) => {
      const next = new Set(current);
      if (checked) next.add(policy.uuid as string);
      else next.delete(policy.uuid as string);
      return next;
    });
  }

  toggleVisibleSelection(checked: boolean) {
    this.selectedPolicyUUIDs.update((current) => {
      const next = new Set(current);
      for (const row of this.visibleRows()) {
        if (!row.uuid) continue;
        if (checked) next.add(row.uuid);
        else next.delete(row.uuid);
      }
      return next;
    });
  }

  async deleteSelectedItems() {
    const ids = Array.from(this.selectedPolicyUUIDs());
    if (!ids.length) return;

    const labels = this.dataSource.data
      .filter((item) => ids.includes(item.uuid))
      .slice(0, 3)
      .map((item) => item.name);
    const suffix = labels.length ? ` (${labels.join(', ')}${ids.length > 3 ? ', ...' : ''})` : '';
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: this.t('Delete selected network policies'),
        message: `${this.t('Are you sure you want to delete selected network policy(ies)?')} ${ids.length}${suffix}`,
        confirmLabel: this.t('Delete selected'),
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.mutating.set(true);
    try {
      const response = await this.policiesApi.removeMany(ids);
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      const failed = new Set<string>(
        (response?.data?.failed ?? [])
          .map((item: any) => this.extractBulkFailureUUID(item))
          .filter((uuid: string | null): uuid is string => !!uuid),
      );
      this.dataSource.data = this.dataSource.data.filter((row) => !deleted.has(row.uuid));
      this.selectedPolicyUUIDs.set(failed);
      if (failed.size) {
        this.snack.error(
          `${failed.size} ${this.t('selected network policy(ies) could not be deleted.')}`,
        );
      } else {
        this.snack.success(
          `${deleted.size || ids.length} ${this.t('selected network policy(ies) deleted.')}`,
        );
      }
      this.networkPoliciesResource.reload();
    } catch (error: any) {
      this.snack.error(
        this.extractErrorMessage(error, 'Failed to delete selected network policies.'),
      );
    } finally {
      this.mutating.set(false);
    }
  }

  isActive(policy: CyberSecurityNetworkPolicy) {
    const value = String(policy.enabled ?? '').toLowerCase();
    return value === '1' || value === 'true' || value === 'active';
  }

  trustedNodeLabel(uuid: string | null | undefined) {
    if (!uuid) return 'Any trusted node';
    return this.trustedNodes().find((node) => node.uuid === uuid)?.name ?? uuid;
  }

  formatList(value: unknown) {
    if (Array.isArray(value)) return value.join(', ') || '-';
    if (typeof value === 'string' && value.trim()) return value;
    return '-';
  }

  private fillForm(policy: CyberSecurityNetworkPolicy) {
    this.formModel.set({
      name: policy.name ?? '',
      endpointGroup: policy.endpointGroup ?? 'freeswitch_xml_curl',
      action: policy.action ?? 'custom_rate_limit',
      scope: policy.scope ?? 'tenant',
      mode: policy.mode ?? 'monitor',
      priority: Number(policy.priority ?? 100),
      nodeType: policy.nodeType ?? 'freeswitch',
      trustedNodeUUID: policy.trustedNodeUUID ?? '',
      networks: this.pretty(policy.networks ?? []),
      methods: this.pretty(policy.methods ?? ['GET', 'POST']),
      rateLimitPerMinute: Number(policy.rateLimitPerMinute ?? 300),
      burst: Number(policy.burst ?? 120),
      reason: policy.reason ?? '',
      enabled: this.isActive(policy) ? 1 : 0,
    });
  }

  private buildPayload(): CyberSecurityNetworkPolicyPayload {
    const value = this.formModel();
    return {
      trustedNodeUUID: value.trustedNodeUUID || null,
      name: value.name.trim(),
      endpointGroup: value.endpointGroup.trim(),
      action: value.action,
      scope: value.scope,
      mode: value.mode,
      priority: Number(value.priority ?? 100),
      nodeType: value.nodeType,
      networks: this.parseJson(value.networks, 'Networks'),
      methods: this.parseJson(value.methods, 'Methods'),
      rateLimitPerMinute:
        value.rateLimitPerMinute === null || value.rateLimitPerMinute === undefined
          ? null
          : Number(value.rateLimitPerMinute),
      burst: value.burst === null || value.burst === undefined ? null : Number(value.burst),
      reason: value.reason.trim() || null,
      enabled: Number(value.enabled) ? 1 : 0,
    };
  }

  private defaultFormValue() {
    return {
      name: '',
      endpointGroup: 'freeswitch_xml_curl',
      action: 'custom_rate_limit',
      scope: 'tenant',
      mode: 'monitor',
      priority: 100,
      nodeType: 'freeswitch',
      trustedNodeUUID: '',
      networks: '[]',
      methods: '["GET","POST"]',
      rateLimitPerMinute: 300,
      burst: 120,
      reason: '',
      enabled: 1,
    };
  }

  private parseJson(value: string, label: string) {
    try {
      return JSON.parse(value || 'null');
    } catch {
      throw new Error(`${this.t(label)} ${this.t('must be valid JSON.')}`);
    }
  }

  private t(value: string) {
    return this.i18n.t(value);
  }

  private pretty(value: unknown) {
    return JSON.stringify(value ?? null, null, 2);
  }

  private async loadNetworkPoliciesSnapshot(
    search: string,
  ): Promise<CyberSecurityNetworkPoliciesSnapshot> {
    const [policies, trustedNodes] = await Promise.all([
      this.policiesApi.list(search, this.listLimit),
      this.trustedNodesApi.list('', this.listLimit),
    ]);
    const paginator = this.paginator();
    if (paginator) queueMicrotask(() => paginator.firstPage());
    return {
      policies: policies.items,
      trustedNodes: trustedNodes.items,
    };
  }

  private openNetworkPolicyDialog() {
    const networkPolicyFormDialog = this.networkPolicyFormDialog();
    if (!networkPolicyFormDialog || this.networkPolicyDialogBinding) return;
    this.networkPolicyDialogBinding = openCrudTemplateDialog(
      this.dialog,
      networkPolicyFormDialog,
      'crud-form-dialog',
      { onEscape: () => this.cancelForm() },
    );
    this.networkPolicyDialogBinding.ref.afterClosed().subscribe(() => {
      this.networkPolicyDialogBinding?.stop();
      this.networkPolicyDialogBinding = null;
    });
  }

  private closeNetworkPolicyDialog() {
    if (!this.networkPolicyDialogBinding) return;
    this.networkPolicyDialogBinding.ref.close();
    this.networkPolicyDialogBinding.stop();
    this.networkPolicyDialogBinding = null;
  }

  private extractErrorMessage(error: any, fallback: string) {
    return error?.error?.error || error?.error?.message || error?.message || fallback;
  }

  private extractBulkFailureUUID(item: any): string | null {
    if (!item || typeof item !== 'object') return null;
    if (typeof item.CyberSecurityNetworkPolicyUUID === 'string') {
      return item.CyberSecurityNetworkPolicyUUID;
    }
    if (typeof item.uuid === 'string') return item.uuid;
    const uuidKey = Object.keys(item).find((key) => key.endsWith('UUID'));
    return uuidKey && typeof item[uuidKey] === 'string' ? item[uuidKey] : null;
  }

  private reconcileSelection() {
    const available = new Set(this.dataSource.data.map((item) => item.uuid));
    this.selectedPolicyUUIDs.update((current) => {
      const next = new Set<string>();
      current.forEach((uuid) => {
        if (available.has(uuid)) next.add(uuid);
      });
      return next;
    });
  }
}
