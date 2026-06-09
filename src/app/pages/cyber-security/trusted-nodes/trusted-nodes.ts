import {
  AfterViewInit,
  Component,
  OnDestroy,
  TemplateRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';
import { NgClass, DatePipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { fadeIn } from '../../../shared/animations/fade.animation';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  CyberSecurityTrustedNode,
  CyberSecurityTrustedNodePayload,
  CyberSecurityTrustedNodesService,
} from './cyber-security-trusted-nodes.service';

@Component({
  selector: 'app-cyber-security-trusted-nodes',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
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
    DatePipe,
    NgClass,
  ],
  templateUrl: './trusted-nodes.html',
  styleUrls: ['./trusted-nodes.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [fadeIn],
})
export class CyberSecurityTrustedNodesPage implements AfterViewInit, OnDestroy {
  private readonly trustedNodesApi = inject(CyberSecurityTrustedNodesService);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder);
  private readonly i18n = inject(AppI18nService);
  private readonly snack = inject(SnackbarService);
  private readonly listLimit = 1000;

  readonly saving = signal(false);
  private readonly mutating = signal(false);
  readonly editing = signal<CyberSecurityTrustedNode | null>(null);
  readonly searchInput = signal('');
  readonly search = signal('');
  readonly selectedTrustedNodeUUIDs = signal<Set<string>>(new Set());
  private readonly trustedNodesResource = resource({
    params: () => this.search(),
    defaultValue: [] as CyberSecurityTrustedNode[],
    loader: ({ params }) => this.loadTrustedNodes(params),
  });

  readonly loading = computed(() => this.trustedNodesResource.isLoading() || this.mutating());

  readonly dataSource = new MatTableDataSource<CyberSecurityTrustedNode>([]);
  readonly displayedColumns = [
    'select',
    'name',
    'nodeType',
    'networks',
    'groups',
    'status',
    'lastSeen',
    'actions',
  ];

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    nodeUUID: ['', [Validators.required]],
    nodeType: ['freeswitch', [Validators.required]],
    hostname: [''],
    allowedNetworks: ['[]', [Validators.required]],
    endpointGroups: ['[]', [Validators.required]],
    authMode: ['hmac', [Validators.required]],
    secret: [''],
    status: ['active', [Validators.required]],
    mode: ['monitor', [Validators.required]],
    notes: [''],
  });

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly trustedNodeFormDialog = viewChild<TemplateRef<unknown>>('trustedNodeFormDialog');

  private trustedNodeDialogBinding: CrudDialogBinding | null = null;
  private lastLoadError = '';

  private readonly syncTrustedNodes = effect(() => {
    this.dataSource.data = this.trustedNodesResource.value();
    queueMicrotask(() => this.reconcileSelection());
  });

  private readonly reportLoadError = effect(() => {
    const error = this.trustedNodesResource.error();
    if (!error) {
      this.lastLoadError = '';
      return;
    }

    const message = this.extractErrorMessage(error, 'Failed to load trusted nodes.');
    if (message !== this.lastLoadError) {
      this.lastLoadError = message;
      this.snack.error(message);
    }
  });

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'name':
          return data.name ?? '';
        case 'nodeType':
          return data.nodeType ?? '';
        case 'networks':
          return this.formatList(data.allowedNetworks);
        case 'groups':
          return this.formatList(data.endpointGroups);
        case 'status':
          return data.status ?? '';
        case 'lastSeen':
          return data.lastSeenAt ?? '';
        default:
          return '';
      }
    };
  }

  ngOnDestroy() {
    this.closeTrustedNodeDialog();
  }

  applySearchFilters() {
    const nextSearch = this.searchInput().trim();
    if (nextSearch === this.search()) {
      this.trustedNodesResource.reload();
    } else {
      this.search.set(nextSearch);
    }
  }

  clearSearchFilters() {
    this.searchInput.set('');
    if (this.search()) {
      this.search.set('');
    } else {
      this.trustedNodesResource.reload();
    }
  }

  refreshList() {
    this.trustedNodesResource.reload();
  }

  startCreate() {
    this.editing.set(null);
    this.form.reset({
      name: '',
      nodeUUID: '',
      nodeType: 'freeswitch',
      hostname: '',
      allowedNetworks: '[]',
      endpointGroups: '[]',
      authMode: 'hmac',
      secret: '',
      status: 'active',
      mode: 'monitor',
      notes: '',
    });
    this.openTrustedNodeDialog();
  }

  startEdit(trustedNode: CyberSecurityTrustedNode) {
    this.editing.set(trustedNode);
    this.fillForm(trustedNode);
    this.openTrustedNodeDialog();
  }

  async saveItem(saveAndNew = false) {
    if (this.form.invalid) return;

    let payload: CyberSecurityTrustedNodePayload;
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
        await this.trustedNodesApi.update(editing.uuid, payload);
        this.snack.success('Trusted node updated successfully.');
      } else {
        await this.trustedNodesApi.create(payload);
        this.snack.success('Trusted node created successfully.');
      }

      this.trustedNodesResource.reload();

      if (saveAndNew && createMode) {
        this.form.reset({
          name: '',
          nodeUUID: '',
          nodeType: 'freeswitch',
          hostname: '',
          allowedNetworks: '[]',
          endpointGroups: '[]',
          authMode: 'hmac',
          secret: '',
          status: 'active',
          mode: 'monitor',
          notes: '',
        });
        this.editing.set(null);
        return;
      }

      this.cancelForm();
    } catch (error: any) {
      this.snack.error(this.extractErrorMessage(error, 'Failed to save trusted node.'));
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNewItem() {
    if (this.editing()) return;
    void this.saveItem(true);
  }

  cancelForm() {
    this.closeTrustedNodeDialog();
    this.form.reset({
      name: '',
      nodeUUID: '',
      nodeType: 'freeswitch',
      hostname: '',
      allowedNetworks: '[]',
      endpointGroups: '[]',
      authMode: 'hmac',
      secret: '',
      status: 'active',
      mode: 'monitor',
      notes: '',
    });
    this.editing.set(null);
  }

  async deleteItem(trustedNode: CyberSecurityTrustedNode) {
    if (!trustedNode.uuid) return;
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: this.t('Revoke trusted node'),
        message: `${this.t('Are you sure you want to revoke')} "${trustedNode.name}"?`,
        confirmLabel: this.t('Revoke'),
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.mutating.set(true);
    try {
      await this.trustedNodesApi.remove(trustedNode.uuid);
      this.snack.success('Trusted node revoked successfully.');
      this.trustedNodesResource.reload();
    } catch (error: any) {
      this.snack.error(this.extractErrorMessage(error, 'Failed to revoke trusted node.'));
    } finally {
      this.mutating.set(false);
    }
  }

  get selectedCount() {
    return this.selectedTrustedNodeUUIDs().size;
  }

  visibleRows() {
    const filtered = this.dataSource.filter ? this.dataSource.filteredData : this.dataSource.data;
    const paginator = this.dataSource.paginator;
    if (!paginator) return filtered;
    const start = paginator.pageIndex * paginator.pageSize;
    return filtered.slice(start, start + paginator.pageSize);
  }

  isSelected(trustedNode: CyberSecurityTrustedNode) {
    return !!trustedNode.uuid && this.selectedTrustedNodeUUIDs().has(trustedNode.uuid);
  }

  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  toggleTrustedNodeSelection(trustedNode: CyberSecurityTrustedNode, checked: boolean) {
    if (!trustedNode.uuid) return;
    this.selectedTrustedNodeUUIDs.update((current) => {
      const next = new Set(current);
      if (checked) next.add(trustedNode.uuid as string);
      else next.delete(trustedNode.uuid as string);
      return next;
    });
  }

  toggleVisibleSelection(checked: boolean) {
    this.selectedTrustedNodeUUIDs.update((current) => {
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
    const ids = Array.from(this.selectedTrustedNodeUUIDs());
    if (!ids.length) return;

    const labels = this.dataSource.data
      .filter((item) => ids.includes(item.uuid))
      .slice(0, 3)
      .map((item) => item.name);
    const suffix = labels.length ? ` (${labels.join(', ')}${ids.length > 3 ? ', ...' : ''})` : '';
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: this.t('Revoke selected trusted nodes'),
        message: `${this.t('Are you sure you want to revoke selected trusted node(s)?')} ${ids.length}${suffix}`,
        confirmLabel: this.t('Revoke selected'),
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.mutating.set(true);
    try {
      const response = await this.trustedNodesApi.removeMany(ids);
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      const failed = new Set<string>(
        (response?.data?.failed ?? [])
          .map((item: any) => this.extractBulkFailureUUID(item))
          .filter((uuid: string | null): uuid is string => !!uuid),
      );
      this.dataSource.data = this.dataSource.data.filter((row) => !deleted.has(row.uuid));
      this.selectedTrustedNodeUUIDs.set(failed);
      if (failed.size) {
        this.snack.error(
          `${failed.size} ${this.t('selected trusted node(s) could not be revoked.')}`,
        );
      } else {
        this.snack.success(
          `${deleted.size || ids.length} ${this.t('selected trusted node(s) revoked.')}`,
        );
      }
      this.trustedNodesResource.reload();
    } catch (error: any) {
      this.snack.error(this.extractErrorMessage(error, 'Failed to revoke selected trusted nodes.'));
    } finally {
      this.mutating.set(false);
    }
  }

  formatList(value: unknown) {
    if (Array.isArray(value)) return value.join(', ') || '-';
    if (typeof value === 'string' && value.trim()) return value;
    return '-';
  }

  chipClass(status: string | null | undefined) {
    const normalized = String(status ?? '').toLowerCase();
    if (normalized === 'active') return 'chip-success';
    if (normalized === 'suspended') return 'chip-warning';
    if (normalized === 'revoked') return 'chip-danger';
    return 'chip-skipped';
  }

  private fillForm(trustedNode: CyberSecurityTrustedNode) {
    this.form.reset({
      name: trustedNode.name ?? '',
      nodeUUID: trustedNode.nodeUUID ?? '',
      nodeType: trustedNode.nodeType ?? 'freeswitch',
      hostname: trustedNode.hostname ?? '',
      allowedNetworks: this.pretty(trustedNode.allowedNetworks ?? []),
      endpointGroups: this.pretty(trustedNode.endpointGroups ?? []),
      authMode: trustedNode.authMode ?? 'hmac',
      secret: '',
      status: trustedNode.status ?? 'active',
      mode: trustedNode.mode ?? 'monitor',
      notes: trustedNode.notes ?? '',
    });
  }

  private buildPayload(): CyberSecurityTrustedNodePayload {
    const value = this.form.getRawValue();
    const payload: CyberSecurityTrustedNodePayload = {
      name: value.name.trim(),
      nodeUUID: value.nodeUUID.trim(),
      nodeType: value.nodeType,
      hostname: value.hostname.trim() || null,
      allowedNetworks: this.parseJson(value.allowedNetworks, 'Allowed networks'),
      endpointGroups: this.parseJson(value.endpointGroups, 'Endpoint groups'),
      authMode: value.authMode,
      status: value.status,
      mode: value.mode,
      notes: value.notes.trim() || null,
    };
    const secret = value.secret.trim();
    if (secret) payload.secret = secret;
    return payload;
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

  private async loadTrustedNodes(search: string) {
    const trustedNodes = await this.trustedNodesApi.list(search, this.listLimit);
    const paginator = this.paginator();
    if (paginator) queueMicrotask(() => paginator.firstPage());
    return trustedNodes.items;
  }

  private openTrustedNodeDialog() {
    const trustedNodeFormDialog = this.trustedNodeFormDialog();
    if (!trustedNodeFormDialog || this.trustedNodeDialogBinding) return;
    this.trustedNodeDialogBinding = openCrudTemplateDialog(
      this.dialog,
      trustedNodeFormDialog,
      'crud-form-dialog',
      { onEscape: () => this.cancelForm() },
    );
    this.trustedNodeDialogBinding.ref.afterClosed().subscribe(() => {
      this.trustedNodeDialogBinding?.stop();
      this.trustedNodeDialogBinding = null;
    });
  }

  private closeTrustedNodeDialog() {
    if (!this.trustedNodeDialogBinding) return;
    this.trustedNodeDialogBinding.ref.close();
    this.trustedNodeDialogBinding.stop();
    this.trustedNodeDialogBinding = null;
  }

  private extractErrorMessage(error: any, fallback: string) {
    return error?.error?.error || error?.error?.message || error?.message || fallback;
  }

  private extractBulkFailureUUID(item: any): string | null {
    if (!item || typeof item !== 'object') return null;
    if (typeof item.CyberSecurityTrustedNodeUUID === 'string') {
      return item.CyberSecurityTrustedNodeUUID;
    }
    if (typeof item.uuid === 'string') return item.uuid;
    const uuidKey = Object.keys(item).find((key) => key.endsWith('UUID'));
    return uuidKey && typeof item[uuidKey] === 'string' ? item[uuidKey] : null;
  }

  private reconcileSelection() {
    const available = new Set(this.dataSource.data.map((item) => item.uuid));
    this.selectedTrustedNodeUUIDs.update((current) => {
      const next = new Set<string>();
      current.forEach((uuid) => {
        if (available.has(uuid)) next.add(uuid);
      });
      return next;
    });
  }
}
