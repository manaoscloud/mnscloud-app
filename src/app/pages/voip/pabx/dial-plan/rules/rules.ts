import {
  Component,
  TemplateRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  ChangeDetectionStrategy,
  viewChild,
  afterNextRender,
  DestroyRef,
} from '@angular/core';
import { FormField, form as createForm, minLength, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
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

import { SnackbarService } from '../../../../../services/snackbar.service';
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../../shared/dialog/crud-dialog.util';
import { SlowConfirmDialogComponent } from '../../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../../../shared/refresh-button/refresh-button';
import {
  VoipPabxDialPlanItem,
  VoipPabxDialPlanRuleItem,
  VoipPabxTrunkOption,
  VoipPabxDialPlanUiService,
} from '../dial-plan.service';

type DialPlanRuleFilters = {
  search: string;
  dialPlanUUID: string;
};

const emptyDialPlanRuleFilters = (): DialPlanRuleFilters => ({
  search: '',
  dialPlanUUID: '',
});

@Component({
  selector: 'app-voip-pabx-dial-plan-rules',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    FormField,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatChipsModule,
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
  templateUrl: './rules.html',
  styleUrls: ['./rules.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoipPabxDialPlanRulesPage {
  private readonly api = inject(VoipPabxDialPlanUiService);
  private readonly snack = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly listLimit = 5000;

  private readonly appliedFilters = signal<DialPlanRuleFilters>(emptyDialPlanRuleFilters());
  private readonly itemsResource = resource({
    params: () => this.appliedFilters(),
    defaultValue: [] as VoipPabxDialPlanRuleItem[],
    loader: ({ params }) => this.fetchItems(params),
  });
  private readonly mutating = signal(false);
  readonly loading = computed(() => this.itemsResource.isLoading() || this.mutating());
  readonly saving = signal(false);
  readonly searchInput = signal('');
  readonly search = signal('');
  readonly dialPlanFilter = signal('');
  readonly dialPlanSearch = signal('');
  readonly trunkSearch = signal('');
  readonly editing = signal<VoipPabxDialPlanRuleItem | null>(null);
  readonly selectedUUIDs = signal<Set<string>>(new Set());
  readonly dialPlans = signal<VoipPabxDialPlanItem[]>([]);
  readonly trunks = signal<VoipPabxTrunkOption[]>([]);
  readonly filteredDialPlans = computed(() => {
    const term = this.dialPlanSearch().trim().toLowerCase();
    if (!term) return this.dialPlans();
    return this.dialPlans().filter((item) =>
      `${item.name} ${item.code}`.toLowerCase().includes(term),
    );
  });
  readonly filteredTrunks = computed(() => {
    const term = this.trunkSearch().trim().toLowerCase();
    const rows = this.trunks().filter((item) => {
      const direction = String(item.direction ?? '').toLowerCase();
      return Number(item.enabled ?? 0) === 1 && ['outbound', 'both'].includes(direction);
    });
    if (!term) return rows;
    return rows.filter((item) =>
      `${item.name} ${item.host ?? ''} ${item.pabxName ?? ''} ${item.direction ?? ''}`
        .toLowerCase()
        .includes(term),
    );
  });
  readonly dataSource = new MatTableDataSource<VoipPabxDialPlanRuleItem>([]);
  readonly displayedColumns = [
    'select',
    'name',
    'dialPlan',
    'direction',
    'operator',
    'pattern',
    'priority',
    'status',
    'actions',
  ];

  readonly formModel = signal({
    dialPlanUUID: '',
    name: '',
    direction: 'outbound',
    operator: 'regex',
    pattern: '',
    replacement: '',
    stripDigits: 0,
    prepend: '',
    priority: 100,
    caseSensitive: 0,
    resultType: 'outbound',
    trunkUUID: '',
    callerIdMode: 'extension',
    callerIdValue: '',
    fallbackTrunks: '',
    engineConfig: '',
    description: '',
    enabled: 1,
  });
  readonly form = createForm(this.formModel, (schema) => {
    required(schema.dialPlanUUID);
    required(schema.name);
    minLength(schema.name, 2);
    required(schema.direction);
    required(schema.operator);
    required(schema.pattern);
    required(schema.resultType);
  });

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly formDialog = viewChild<TemplateRef<unknown>>('formDialog');
  private dialogBinding: CrudDialogBinding | null = null;
  private readonly itemsEffect = effect(() => {
    this.dataSource.data = this.itemsResource.value();
    this.reconcileSelection();
  });
  private readonly itemsErrorEffect = effect(() => {
    const error = this.itemsResource.error();
    if (!error) return;
    this.snack.error(this.messageFromError(error, 'Failed to load dial plan rules.'));
    this.dataSource.data = [];
    this.reconcileSelection();
  });

  private readonly afterViewReady = afterNextRender(() => {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
    void this.bootstrap();
  });

  private readonly cleanupOnDestroy = inject(DestroyRef).onDestroy(() => {
    this.closeDialog();
  });

  async bootstrap() {
    await Promise.all([this.loadDialPlans(), this.loadTrunks()]);
    this.itemsResource.reload();
  }

  refreshList() {
    this.itemsResource.reload();
  }

  applySearchFilters() {
    const nextFilters = this.currentDialPlanRuleFilters();
    this.search.set(nextFilters.search);
    if (this.sameDialPlanRuleFilters(nextFilters, this.appliedFilters())) {
      this.itemsResource.reload();
    } else {
      this.appliedFilters.set(nextFilters);
    }
  }

  clearSearchFilters() {
    this.searchInput.set('');
    this.search.set('');
    this.dialPlanFilter.set('');
    const nextFilters = emptyDialPlanRuleFilters();
    if (this.sameDialPlanRuleFilters(nextFilters, this.appliedFilters())) {
      this.itemsResource.reload();
    } else {
      this.appliedFilters.set(nextFilters);
    }
  }

  onDialPlanSelectOpened(opened: boolean) {
    if (!opened) this.dialPlanSearch.set('');
  }

  onTrunkSelectOpened(opened: boolean) {
    if (!opened) this.trunkSearch.set('');
  }

  async loadDialPlans() {
    const response = await this.api.listPlans({ limit: this.listLimit });
    this.dialPlans.set((response?.data?.items ?? []) as VoipPabxDialPlanItem[]);
  }

  async loadTrunks() {
    const response = await this.api.listTrunks({ limit: this.listLimit, status: 1 });
    this.trunks.set((response?.data?.items ?? []) as VoipPabxTrunkOption[]);
  }

  private async fetchItems(filters: DialPlanRuleFilters): Promise<VoipPabxDialPlanRuleItem[]> {
    const response = await this.api.listAllRules({
      search: filters.search,
      dialPlanUUID: filters.dialPlanUUID,
      limit: this.listLimit,
    });
    return (response?.data?.items ?? []) as VoipPabxDialPlanRuleItem[];
  }

  private currentDialPlanRuleFilters(): DialPlanRuleFilters {
    return {
      search: this.searchInput().trim(),
      dialPlanUUID: this.dialPlanFilter(),
    };
  }

  private sameDialPlanRuleFilters(left: DialPlanRuleFilters, right: DialPlanRuleFilters) {
    return left.search === right.search && left.dialPlanUUID === right.dialPlanUUID;
  }

  startCreate() {
    this.editing.set(null);
    this.formModel.set({
      dialPlanUUID: this.dialPlanFilter() || this.dialPlans()[0]?.uuid || '',
      name: '',
      direction: 'outbound',
      operator: 'regex',
      pattern: '',
      replacement: '',
      stripDigits: 0,
      prepend: '',
      priority: 100,
      caseSensitive: 0,
      resultType: 'outbound',
      trunkUUID: '',
      callerIdMode: 'extension',
      callerIdValue: '',
      fallbackTrunks: '',
      engineConfig: '',
      description: '',
      enabled: 1,
    });
    this.openDialog();
  }

  startEdit(item: VoipPabxDialPlanRuleItem) {
    this.editing.set(item);
    this.formModel.set({
      dialPlanUUID: item.dialPlanUUID,
      name: item.name,
      direction: item.direction || 'outbound',
      operator: item.operator || 'regex',
      pattern: item.pattern,
      replacement: item.replacement ?? '',
      stripDigits: Number(item.stripDigits ?? 0),
      prepend: item.prepend ?? '',
      priority: Number(item.priority ?? 100),
      caseSensitive: item.caseSensitive === 1 ? 1 : 0,
      resultType: item.resultType || 'outbound',
      trunkUUID: item.trunkUUID ?? '',
      callerIdMode: item.callerIdMode ?? 'extension',
      callerIdValue: item.callerIdValue ?? '',
      fallbackTrunks: item.fallbackTrunks ?? '',
      engineConfig: item.engineConfig ?? '',
      description: item.description ?? '',
      enabled: item.enabled === 1 ? 1 : 0,
    });
    this.openDialog();
  }

  async saveItem(saveAndNew = false) {
    if (!this.form().valid()) return;
    const value = this.formModel();
    const isOutbound = value.direction === 'outbound' && value.resultType === 'outbound';
    if (isOutbound && !value.trunkUUID) {
      this.snack.error('Outbound dial plan rule trunk is required.');
      return;
    }
    const payload = {
      dialPlanUUID: value.dialPlanUUID,
      name: value.name.trim(),
      direction: value.direction,
      operator: value.operator,
      pattern: value.pattern.trim(),
      replacement: value.replacement.trim() || null,
      stripDigits: Number(value.stripDigits ?? 0),
      prepend: value.prepend.trim() || null,
      priority: Number(value.priority ?? 100),
      caseSensitive: value.caseSensitive === 1,
      resultType: value.resultType,
      trunkUUID: value.trunkUUID || null,
      callerIdMode: value.callerIdMode || 'extension',
      callerIdValue: value.callerIdValue.trim() || null,
      fallbackTrunks: value.fallbackTrunks.trim() || null,
      engineConfig: value.engineConfig.trim() || null,
      description: value.description.trim() || null,
      enabled: value.enabled === 1,
    };
    const createMode = !this.editing();
    this.saving.set(true);
    try {
      const editing = this.editing();
      if (editing) await this.api.updateRule(editing.uuid, payload);
      else await this.api.createRule(payload);
      this.snack.success(
        editing ? 'Dial plan rule updated successfully.' : 'Dial plan rule created successfully.',
      );
      this.itemsResource.reload();
      if (saveAndNew && createMode) {
        this.startCreate();
        return;
      }
      this.cancelForm();
    } catch (err: any) {
      this.snack.error(this.messageFromError(err, 'Failed to save dial plan rule.'));
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNew() {
    if (!this.editing()) void this.saveItem(true);
  }

  cancelForm() {
    this.closeDialog();
    this.editing.set(null);
  }

  async deleteItem(item: VoipPabxDialPlanRuleItem) {
    const confirmed = await this.confirmDelete(
      'Delete dial plan rule',
      `Delete rule "${item.name}"?`,
      'Delete',
    );
    if (!confirmed) return;
    this.mutating.set(true);
    try {
      await this.api.removeRule(item.uuid);
      this.selectedUUIDs.update((current) => this.removeFromSet(current, item.uuid));
      this.snack.success('Dial plan rule deleted successfully.');
      this.itemsResource.reload();
    } catch (err: any) {
      this.snack.error(this.messageFromError(err, 'Failed to delete dial plan rule.'));
    } finally {
      this.mutating.set(false);
    }
  }

  get selectedCount() {
    return this.selectedUUIDs().size;
  }

  visibleRows() {
    const filtered = this.dataSource.filter ? this.dataSource.filteredData : this.dataSource.data;
    const paginator = this.dataSource.paginator;
    if (!paginator) return filtered;
    const start = paginator.pageIndex * paginator.pageSize;
    return filtered.slice(start, start + paginator.pageSize);
  }

  isSelected(item: VoipPabxDialPlanRuleItem) {
    return this.selectedUUIDs().has(item.uuid);
  }

  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  toggleEntitySelection(item: VoipPabxDialPlanRuleItem, checked: boolean) {
    this.selectedUUIDs.update((current) => this.toggleSet(current, item.uuid, checked));
  }

  toggleVisibleSelection(checked: boolean) {
    this.selectedUUIDs.update((current) => {
      const next = new Set(current);
      for (const row of this.visibleRows()) checked ? next.add(row.uuid) : next.delete(row.uuid);
      return next;
    });
  }

  async deleteSelectedItems() {
    const ids = Array.from(this.selectedUUIDs());
    if (!ids.length) return;
    const confirmed = await this.confirmDelete(
      'Delete selected rules',
      `Delete ${ids.length} selected rule(s)?`,
      'Delete selected',
    );
    if (!confirmed) return;
    this.mutating.set(true);
    try {
      const response = await this.api.removeManyRules(ids);
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      const failed = this.failedUUIDs(response?.data?.failed ?? [], ['VdrUUID', 'uuid']);
      this.dataSource.data = this.dataSource.data.filter((row) => !deleted.has(row.uuid));
      this.selectedUUIDs.set(failed);
      if (failed.size) this.snack.error(`${failed.size} selected rule(s) could not be deleted.`);
      else this.snack.success(`${deleted.size || ids.length} selected rule(s) deleted.`);
      this.itemsResource.reload();
    } catch (err: any) {
      this.snack.error(this.messageFromError(err, 'Failed to delete selected rules.'));
    } finally {
      this.mutating.set(false);
    }
  }

  dialPlanLabel(uuid: string) {
    const plan = this.dialPlans().find((item) => item.uuid === uuid);
    return plan ? `${plan.name} (${plan.code})` : uuid || '-';
  }

  trunkLabel(uuid?: string | null) {
    if (!uuid) return '-';
    const trunk = this.trunks().find((item) => item.uuid === uuid);
    return trunk ? `${trunk.name}${trunk.host ? ` - ${trunk.host}` : ''}` : uuid;
  }

  isActive(item: VoipPabxDialPlanRuleItem) {
    return Number(item.enabled ?? 0) === 1;
  }

  private openDialog() {
    const formDialog = this.formDialog();
    if (!formDialog || this.dialogBinding) return;
    this.dialogBinding = openCrudTemplateDialog(this.dialog, formDialog, 'crud-form-dialog', {
      onEscape: () => this.cancelForm(),
    });
    this.dialogBinding.ref.afterClosed().subscribe(() => {
      this.dialogBinding?.stop();
      this.dialogBinding = null;
    });
  }

  private closeDialog() {
    this.dialogBinding?.stop();
    this.dialogBinding?.ref.close();
    this.dialogBinding = null;
  }

  private async confirmDelete(title: string, message: string, confirmLabel: string) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: { title, message, confirmLabel },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    return Boolean(await firstValueFrom(ref.afterClosed()));
  }

  private sortValue(row: VoipPabxDialPlanRuleItem, column: string): string | number {
    if (column === 'dialPlan') return row.dialPlanName ?? this.dialPlanLabel(row.dialPlanUUID);
    if (column === 'priority') return Number(row.priority ?? 0);
    if (column === 'status') return this.isActive(row) ? 'ACTIVE' : 'INACTIVE';
    return String((row as any)[column] ?? '');
  }

  private reconcileSelection() {
    const valid = new Set(this.dataSource.data.map((item) => item.uuid));
    this.selectedUUIDs.update(
      (current) => new Set(Array.from(current).filter((uuid) => valid.has(uuid))),
    );
  }

  private toggleSet(current: Set<string>, uuid: string, checked: boolean) {
    const next = new Set(current);
    checked ? next.add(uuid) : next.delete(uuid);
    return next;
  }

  private removeFromSet(current: Set<string>, uuid: string) {
    const next = new Set(current);
    next.delete(uuid);
    return next;
  }

  private failedUUIDs(items: any[], keys: string[]) {
    return new Set<string>(
      items
        .map(
          (item) =>
            keys.map((key) => item?.[key]).find((value) => typeof value === 'string') ?? null,
        )
        .filter((uuid): uuid is string => !!uuid),
    );
  }

  private messageFromError(err: any, fallback: string) {
    return err?.error?.error || err?.error?.message || err?.message || fallback;
  }
}
