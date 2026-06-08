import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  OnDestroy,
  TemplateRef,
  ViewChild,
  computed,
  inject,
  signal,
  ChangeDetectionStrategy
} from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { fadeIn } from '../../../../../shared/animations/fade.animation';
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../../shared/dialog/crud-dialog.util';
import { SlowConfirmDialogComponent } from '../../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  VoipPabxDialPlanItem,
  VoipPabxDialPlanRuleItem,
  VoipPabxTrunkOption,
  VoipPabxDialPlanUiService,
} from '../dial-plan.service';

@Component({
  selector: 'app-voip-pabx-dial-plan-rules',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
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
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [fadeIn],
})
export class VoipPabxDialPlanRulesPage implements AfterViewInit, OnDestroy {
  private readonly api = inject(VoipPabxDialPlanUiService);
  private readonly snack = inject(SnackbarService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly listLimit = 5000;

  readonly loading = signal(false);
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

  readonly form = this.fb.nonNullable.group({
    dialPlanUUID: ['', [Validators.required]],
    name: ['', [Validators.required, Validators.minLength(2)]],
    direction: ['outbound', [Validators.required]],
    operator: ['regex', [Validators.required]],
    pattern: ['', [Validators.required]],
    replacement: [''],
    stripDigits: [0],
    prepend: [''],
    priority: [100],
    caseSensitive: [0],
    resultType: ['outbound', [Validators.required]],
    trunkUUID: [''],
    callerIdMode: ['extension'],
    callerIdValue: [''],
    fallbackTrunks: [''],
    engineConfig: [''],
    description: [''],
    enabled: [1],
  });

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild('formDialog') formDialog?: TemplateRef<unknown>;
  private dialogBinding: CrudDialogBinding | null = null;

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sort = this.sort ?? null;
    this.dataSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
    setTimeout(() => void this.bootstrap(), 0);
  }

  ngOnDestroy() {
    this.closeDialog();
  }

  async bootstrap() {
    await Promise.all([this.loadDialPlans(), this.loadTrunks()]);
    await this.loadItems();
  }

  refreshList() {
    void this.loadItems();
  }

  applySearchFilters() {
    this.search.set(this.searchInput().trim());
    void this.loadItems();
  }

  clearSearchFilters() {
    this.searchInput.set('');
    this.search.set('');
    this.dialPlanFilter.set('');
    void this.loadItems();
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

  async loadItems() {
    this.loading.set(true);
    const start = performance.now();
    try {
      const response = await this.api.listAllRules({
        search: this.search(),
        dialPlanUUID: this.dialPlanFilter(),
        limit: this.listLimit,
      });
      this.dataSource.data = (response?.data?.items ?? []) as VoipPabxDialPlanRuleItem[];
      this.reconcileSelection();
    } catch (err: any) {
      this.snack.error(this.messageFromError(err, 'Failed to load dial plan rules.'));
      this.dataSource.data = [];
      this.reconcileSelection();
    } finally {
      await this.finishLoading(start);
    }
  }

  startCreate() {
    this.editing.set(null);
    this.form.reset({
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
    this.form.reset({
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
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
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
      await this.loadItems();
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
    this.loading.set(true);
    try {
      await this.api.removeRule(item.uuid);
      this.selectedUUIDs.update((current) => this.removeFromSet(current, item.uuid));
      this.snack.success('Dial plan rule deleted successfully.');
      await this.loadItems();
    } catch (err: any) {
      this.snack.error(this.messageFromError(err, 'Failed to delete dial plan rule.'));
    } finally {
      this.loading.set(false);
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
    this.loading.set(true);
    try {
      const response = await this.api.removeManyRules(ids);
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      const failed = this.failedUUIDs(response?.data?.failed ?? [], ['VdrUUID', 'uuid']);
      this.dataSource.data = this.dataSource.data.filter((row) => !deleted.has(row.uuid));
      this.selectedUUIDs.set(failed);
      if (failed.size) this.snack.error(`${failed.size} selected rule(s) could not be deleted.`);
      else this.snack.success(`${deleted.size || ids.length} selected rule(s) deleted.`);
      await this.loadItems();
    } catch (err: any) {
      this.snack.error(this.messageFromError(err, 'Failed to delete selected rules.'));
    } finally {
      this.loading.set(false);
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
    if (!this.formDialog || this.dialogBinding) return;
    this.dialogBinding = openCrudTemplateDialog(this.dialog, this.formDialog, 'crud-form-dialog', {
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

  private async finishLoading(start: number) {
    const waitMs = Math.max(0, 600 - (performance.now() - start));
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
    this.loading.set(false);
  }

  private messageFromError(err: any, fallback: string) {
    return err?.error?.error || err?.error?.message || err?.message || fallback;
  }
}
