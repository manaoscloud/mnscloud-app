import {
  Component,
  TemplateRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  viewChild,
  DestroyRef,
} from '@angular/core';
import { FormField, form as createForm, min, minLength, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, type Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { createSignalCrudTable } from '../../../../shared/crud/signal-crud-table';

import { SnackbarService } from '../../../../services/snackbar.service';
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../shared/dialog/crud-dialog.util';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { VoipPabxAccount, VoipPabxService } from '../voip-pabx.service';
import { VoipPabxExtensionItem, VoipPabxExtensionService } from '../extension/extension.service';
import {
  VoipPabxMediaFileItem,
  VoipPabxMediaFilesService,
} from '../media-files/media-files.service';
import { PabxRoutingResource, VoipPabxRoutingService } from '../routing/routing.service';
import { VoipPabxIvrItem, VoipPabxIvrOptionItem, VoipPabxIvrService } from './ivr.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';
import {
  MnsSearchSelectFieldComponent,
  MnsSearchSelectFieldOption,
} from '../../../../shared/forms/mns-search-select-field/mns-search-select-field';

type Option = { value: string; label: string; pabxUUID?: string | null };
type IvrRouteType = 'extension' | 'ivr' | 'queue' | 'group' | 'external';
type IvrFormModel = {
  pabxUUID: string;
  name: string;
  greetingText: string;
  mediaFileUUID: string;
  timeoutSeconds: number;
  invalidRetries: number;
  enabled: boolean;
};
type IvrOptionFormModel = {
  digit: string;
  routeType: IvrRouteType;
  routeTargetUUID: string;
  routeTargetValue: string;
  description: string;
  enabled: boolean;
};

type IvrListFilters = {
  search: string;
  status: number | '';
};

@Component({
  selector: 'app-voip-pabx-ivr',
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
    MnsSearchSelectFieldComponent,
  ],
  templateUrl: './ivr.html',
  styleUrls: ['../queue/queue.scss'],
})
export class VoipPabxIvrPage {
  private readonly api = inject(VoipPabxIvrService);
  private readonly routingApi = inject(VoipPabxRoutingService);
  private readonly pabxApi = inject(VoipPabxService);
  private readonly extensionApi = inject(VoipPabxExtensionService);
  private readonly mediaFileApi = inject(VoipPabxMediaFilesService);
  private readonly snack = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly listLimit = 5000;

  private readonly mutating = signal(false);
  readonly saving = signal(false);
  readonly deletingSelected = signal(false);
  readonly optionsLoading = signal(false);
  readonly optionSaving = signal(false);
  readonly searchInput = signal('');
  readonly statusInput = signal<number | ''>('');
  readonly search = signal('');
  private readonly appliedSearch = signal('');
  private readonly appliedStatus = signal<number | ''>('');
  readonly statusFilterOptions = [
    { value: '', label: 'All' },
    { value: 1, label: 'Active' },
    { value: 0, label: 'Inactive' },
  ];
  readonly editing = signal<VoipPabxIvrItem | null>(null);
  readonly selectedUUIDs = signal<Set<string>>(new Set());
  readonly pabxOptions = signal<Option[]>([]);
  readonly extensionOptions = signal<Option[]>([]);
  readonly mediaFileOptions = signal<Option[]>([]);
  readonly optionTargetOptions = signal<Option[]>([]);
  readonly optionRows = signal<VoipPabxIvrOptionItem[]>([]);
  readonly rows = computed(() => this.itemsResource.value());
  readonly table = createSignalCrudTable<VoipPabxIvrItem>(this.rows, (row, column) => this.sortValue(row, column));
  readonly sortActive = this.table.sortActive;
  readonly sortDirection = this.table.sortDirection;
  readonly pageIndex = this.table.pageIndex;
  readonly pageSize = this.table.pageSize;
  readonly sortedRows = this.table.sortedRows;
  readonly visibleRows = this.table.visibleRows;
  private readonly itemsResource = resource({
    params: () => ({ search: this.appliedSearch(), status: this.appliedStatus() }),
    defaultValue: [] as VoipPabxIvrItem[],
    loader: ({ params }) => this.fetchItems(params),
  });
  readonly loading = computed(() => this.itemsResource.isLoading() || this.mutating());
  readonly displayedColumns = [
    'select',
    'name',
    'pabx',
    'engine',
    'greeting',
    'timeout',
    'retries',
    'status',
    'actions',
  ];
  readonly optionColumns = ['digit', 'route', 'destination', 'description', 'status', 'actions'];

  readonly pabxSelectOptions = computed<MnsSearchSelectFieldOption[]>(() => this.pabxOptions());
  readonly mediaFileSelectOptions = computed<MnsSearchSelectFieldOption[]>(() => {
    const pabxUUID = this.formModel().pabxUUID;
    const options = this.mediaFileOptions().filter((option) => !pabxUUID || option.pabxUUID === pabxUUID);
    return [{ value: '', label: 'None' }, ...options];
  });
  readonly optionTargetSelectOptions = computed<MnsSearchSelectFieldOption[]>(() =>
    this.optionTargetOptions(),
  );

  readonly formModel = signal<IvrFormModel>(this.emptyFormModel());
  readonly form = createForm(this.formModel, (schema) => {
    required(schema.pabxUUID);
    required(schema.name);
    minLength(schema.name, 2);
    required(schema.timeoutSeconds);
    min(schema.timeoutSeconds, 1);
    required(schema.invalidRetries);
    min(schema.invalidRetries, 0);
  });

  readonly optionFormModel = signal<IvrOptionFormModel>(this.emptyOptionFormModel());
  readonly optionForm = createForm(this.optionFormModel, (schema) => {
    required(schema.digit);
    required(schema.routeType);
  });
  readonly formDialog = viewChild<TemplateRef<unknown>>('formDialog');
  private dialogBinding: CrudDialogBinding | null = null;
  private readonly itemsEffect = effect(() => {
    this.rows();
    this.reconcileSelection();
    this.table.setPage({ pageIndex: 0, pageSize: this.pageSize(), length: this.sortedRows().length });
  });
  private readonly itemsErrorEffect = effect(() => {
    const error = this.itemsResource.error();
    if (!error) return;
    this.snack.error(this.messageFromError(error, 'Failed to load IVRs.'));
    this.rows();
    this.reconcileSelection();
  });

  private readonly cleanupOnDestroy = inject(DestroyRef).onDestroy(() => {
    this.closeDialog();
  });
  setSort(sort: Sort): void {
    this.table.setSort(sort);
  }

  setPage(page: PageEvent): void {
    this.table.setPage(page);
  }

  refreshList() {
    this.itemsResource.reload();
  }

  applySearchFilters() {
    const nextSearch = this.searchInput().trim();
    const nextStatus = this.statusInput();
    this.search.set(nextSearch);
    if (nextSearch === this.appliedSearch() && nextStatus === this.appliedStatus()) {
      this.itemsResource.reload();
    } else {
      this.appliedSearch.set(nextSearch);
      this.appliedStatus.set(nextStatus);
    }
  }

  clearSearchFilters() {
    this.searchInput.set('');
    this.statusInput.set('');
    this.search.set('');
    if (this.appliedSearch() || this.appliedStatus() !== '') {
      this.appliedSearch.set('');
      this.appliedStatus.set('');
    } else {
      this.itemsResource.reload();
    }
  }

  startCreate() {
    this.resetForm();
    void this.fetchOptionTargets();
    this.openDialog();
  }

  startEdit(item: VoipPabxIvrItem) {
    this.editing.set(item);
    this.formModel.set({
      pabxUUID: item.VoipPabxAccountVpaUUID ?? '',
      name: item.VpiName ?? '',
      greetingText: item.VpiGreetingText ?? '',
      mediaFileUUID: item.VoipPabxMediaFileVmfUUID ?? '',
      timeoutSeconds: Number(item.VpiTimeoutSeconds ?? 10),
      invalidRetries: Number(item.VpiInvalidRetries ?? 3),
      enabled: item.VpiEnabled === 1,
    });
    this.resetOptionForm();
    void this.fetchOptions();
    void this.fetchOptionTargets();
    this.openDialog();
  }

  async save(keepOpen = false) {
    if (this.saving()) return;
    if (!this.form().valid()) return;

    this.saving.set(true);
    try {
      const payload = this.payload();
      const editing = this.editing();
      if (editing) {
        await this.api.update(editing.VpiUUID, payload);
        this.snack.success('IVR updated successfully.');
      } else {
        const response = await this.api.create(payload);
        await this.persistPendingOptions(
          (response?.data?.item ?? response?.data?.items?.[0]) as VoipPabxIvrItem | null,
        );
        this.snack.success('IVR created successfully.');
      }

      if (keepOpen && !editing) {
        this.resetForm();
        await this.fetchLookups();
      } else {
        this.closeDialog();
      }
      this.itemsResource.reload();
    } catch (err) {
      this.snack.error(this.messageFromError(err, 'Failed to save IVR.'));
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNew() {
    void this.save(true);
  }

  async deleteItem(item: VoipPabxIvrItem) {
    const confirmed = await this.confirm(
      'Delete IVR',
      `Delete IVR "${item.VpiName}"? This will also remove its options.`,
      'Delete',
    );
    if (!confirmed) return;

    try {
      this.mutating.set(true);
      await this.api.remove(item.VpiUUID);
      this.snack.success('IVR deleted successfully.');
      this.selectedUUIDs.update((set) => {
        const next = new Set(set);
        next.delete(item.VpiUUID);
        return next;
      });
      this.itemsResource.reload();
    } catch (err) {
      this.snack.error(this.messageFromError(err, 'Failed to delete IVR.'));
    } finally {
      this.mutating.set(false);
    }
  }

  selectedCount() {
    return this.selectedUUIDs().size;
  }

  isSelected(item: VoipPabxIvrItem) {
    return this.selectedUUIDs().has(item.VpiUUID);
  }

  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  toggleSelection(item: VoipPabxIvrItem, checked: boolean) {
    this.selectedUUIDs.update((set) => {
      const next = new Set(set);
      if (checked) next.add(item.VpiUUID);
      else next.delete(item.VpiUUID);
      return next;
    });
  }

  toggleVisibleSelection(checked: boolean) {
    this.visibleRows().forEach((row) => this.toggleSelection(row, checked));
  }

  async deleteSelected() {
    const ids = Array.from(this.selectedUUIDs());
    if (!ids.length) return;
    const names = this.rows()
      .filter((row) => ids.includes(row.VpiUUID))
      .slice(0, 3)
      .map((row) => row.VpiName)
      .join(', ');
    const confirmed = await this.confirm(
      'Delete selected IVRs',
      `Delete ${ids.length} selected IVR(s)?${names ? ` Examples: ${names}.` : ''}`,
      'Delete selected',
    );
    if (!confirmed) return;

    this.deletingSelected.set(true);
    try {
      const response = await this.api.removeMany(ids);
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      const failed = this.failedUUIDs(response?.data?.failed ?? []);
    this.rows();
      this.selectedUUIDs.set(new Set(failed));
      if (failed.length) {
        this.snack.warning(`${failed.length} selected IVR(s) could not be deleted.`);
      } else {
        this.snack.success(`${deleted.size} selected IVR(s) deleted successfully.`);
      }
    } catch (err) {
      this.snack.error(this.messageFromError(err, 'Failed to delete selected IVRs.'));
    } finally {
      this.deletingSelected.set(false);
    }
  }

  onPabxChange() {
    this.formModel.update((value) => ({ ...value, mediaFileUUID: '' }));
    this.optionFormModel.update((value) => ({ ...value, routeTargetUUID: '' }));
    if (!this.editing()) this.optionRows.set([]);
    void this.fetchOptionTargets();
  }

  onOptionRouteTypeChange() {
    this.optionFormModel.update((value) => ({ ...value, routeTargetUUID: '' }));
    void this.fetchOptionTargets();
  }

  async addOption() {
    if (this.optionSaving()) return;
    if (!this.optionForm().valid()) return;

    const payload = this.optionPayload();
    if (!this.editing()) {
      this.optionRows.update((rows) => [...rows, this.pendingOptionRow(payload)]);
      this.resetOptionForm();
      void this.fetchOptionTargets();
      return;
    }

    this.optionSaving.set(true);
    try {
      const response = await this.api.createOption(this.editing()!.VpiUUID, payload);
      this.optionRows.set((response?.data?.items ?? []) as VoipPabxIvrOptionItem[]);
      this.resetOptionForm();
      await this.fetchOptionTargets();
      this.snack.success('Option added successfully.');
    } catch (err) {
      this.snack.error(this.messageFromError(err, 'Failed to add option.'));
    } finally {
      this.optionSaving.set(false);
    }
  }

  async removeOption(row: VoipPabxIvrOptionItem) {
    const confirmed = await this.confirm('Delete option', 'Remove this IVR option?', 'Delete');
    if (!confirmed) return;

    if (!this.editing()) {
      const optionUUID = this.optionUuidOf(row);
      this.optionRows.update((rows) =>
        rows.filter((option) => this.optionUuidOf(option) !== optionUUID),
      );
      return;
    }

    try {
      await this.api.removeOption(this.editing()!.VpiUUID, this.optionUuidOf(row));
      await this.fetchOptions();
      this.snack.success('Option removed successfully.');
    } catch (err) {
      this.snack.error(this.messageFromError(err, 'Failed to remove option.'));
    }
  }

  optionTargetLabel(row: VoipPabxIvrOptionItem) {
    if (!row.VioRouteTargetUUID) return row.VioRouteTargetValue ?? '';
    return this.targetLabel(row.VioRouteTargetUUID);
  }

  isActive(item: VoipPabxIvrItem) {
    return item.VpiEnabled === 1;
  }

  closeDialog() {
    this.dialogBinding?.ref.close();
    this.dialogBinding?.stop();
    this.dialogBinding = null;
  }

  private async fetchLookups() {
    const [pabxResponse, extensionResponse, mediaFileResponse] = await Promise.all([
      this.pabxApi.list({ limit: this.listLimit }),
      this.extensionApi.list(new URLSearchParams({ limit: String(this.listLimit) })),
      this.mediaFileApi.list({ limit: this.listLimit, status: '1' }),
    ]);
    this.pabxOptions.set(
      (pabxResponse?.data?.items ?? []).map((item: VoipPabxAccount) => ({
        value: item.VpaUUID,
        label: item.VpaName,
      })),
    );
    this.extensionOptions.set(
      (extensionResponse?.data?.items ?? []).map((item: VoipPabxExtensionItem) => ({
        value: item.VpeUUID,
        label: item.VpeUsername,
        pabxUUID: item.VoipPabxAccountVpaUUID,
      })),
    );
    this.mediaFileOptions.set(
      (mediaFileResponse?.data?.items ?? []).map((item: VoipPabxMediaFileItem) => ({
        value: item.uuid,
        label: item.name,
        pabxUUID: item.pabxUUID,
      })),
    );
  }

  private async fetchItems(filters: IvrListFilters): Promise<VoipPabxIvrItem[]> {
    await this.fetchLookups();
    const params = new URLSearchParams({ limit: String(this.listLimit) });
    if (filters.search) params.set('search', filters.search);
    if (filters.status !== '') params.set('status', String(filters.status));
    const response = await this.api.list(params);
    return (response?.data?.items ?? []) as VoipPabxIvrItem[];
  }

  private async fetchOptions() {
    const editing = this.editing();
    if (!editing) {
      this.optionRows.set([]);
      return;
    }
    this.optionsLoading.set(true);
    try {
      const response = await this.api.listOptions(editing.VpiUUID);
      this.optionRows.set((response?.data?.items ?? []) as VoipPabxIvrOptionItem[]);
    } catch (err) {
      this.snack.error(this.messageFromError(err, 'Failed to load IVR options.'));
    } finally {
      this.optionsLoading.set(false);
    }
  }

  private async fetchOptionTargets() {
    const routeType = this.optionFormModel().routeType;
    const pabxUUID = this.formModel().pabxUUID;
    if (routeType === 'extension') {
      this.optionTargetOptions.set(
        this.extensionOptions().filter((option) => !pabxUUID || option.pabxUUID === pabxUUID),
      );
      return;
    }
    const resourceByRoute: Record<string, PabxRoutingResource> = {
      external: 'external',
      group: 'group',
      queue: 'queue',
      ivr: 'ivr',
    };
    const resource = routeType ? resourceByRoute[routeType] : null;
    if (!resource) {
      this.optionTargetOptions.set([]);
      return;
    }
    const params = new URLSearchParams({ limit: String(this.listLimit) });
    if (pabxUUID) params.set('pabxUUID', pabxUUID);
    const response = await this.routingApi.list(resource, params);
    const currentIvrUUID = this.editing()?.VpiUUID ?? '';
    this.optionTargetOptions.set(
      (response?.data?.items ?? [])
        .filter((item: any) => resource !== 'ivr' || this.uuidOfResource(item) !== currentIvrUUID)
        .map((item: any) => ({
          value: this.uuidOfResource(item),
          label:
            item.VpxName ??
            item.VpgName ??
            item.VpqName ??
            item.VpiName ??
            this.uuidOfResource(item),
        })),
    );
  }

  private async persistPendingOptions(created: VoipPabxIvrItem | null) {
    if (!created?.VpiUUID || !this.optionRows().length) return;
    for (const option of this.optionRows()) {
      await this.api.createOption(created.VpiUUID, this.payloadFromOptionRow(option));
    }
  }

  private payload() {
    const value = this.formModel();
    return {
      pabxUUID: value.pabxUUID,
      name: value.name,
      greetingText: value.greetingText || null,
      mediaFileUUID: value.mediaFileUUID || null,
      timeoutSeconds: value.timeoutSeconds,
      invalidRetries: value.invalidRetries,
      enabled: value.enabled,
    };
  }

  private optionPayload() {
    const value = this.optionFormModel();
    return {
      digit: value.digit,
      routeType: value.routeType,
      routeTargetUUID: value.routeTargetUUID || null,
      routeTargetValue: value.routeTargetValue || null,
      description: value.description || null,
      enabled: value.enabled,
    };
  }

  private pendingOptionRow(payload: Record<string, unknown>): VoipPabxIvrOptionItem {
    return {
      _localUUID: crypto.randomUUID(),
      VioDigit: String(payload['digit'] ?? ''),
      VioRouteType: String(payload['routeType'] ?? 'extension'),
      VioRouteTargetUUID: (payload['routeTargetUUID'] as string | null) ?? null,
      VioRouteTargetValue: (payload['routeTargetValue'] as string | null) ?? null,
      VioDescription: (payload['description'] as string | null) ?? null,
      VioEnabled: payload['enabled'] ? 1 : 0,
    };
  }

  private payloadFromOptionRow(row: VoipPabxIvrOptionItem) {
    return {
      digit: row.VioDigit,
      routeType: row.VioRouteType,
      routeTargetUUID: row.VioRouteTargetUUID || null,
      routeTargetValue: row.VioRouteTargetValue || null,
      description: row.VioDescription || null,
      enabled: row.VioEnabled === 1,
    };
  }

  private resetForm() {
    this.editing.set(null);
    this.optionRows.set([]);
    this.formModel.set(this.emptyFormModel());
    this.resetOptionForm();
  }

  private resetOptionForm() {
    this.optionFormModel.set(this.emptyOptionFormModel());
  }

  private emptyFormModel(): IvrFormModel {
    return {
      pabxUUID: '',
      name: '',
      greetingText: '',
      mediaFileUUID: '',
      timeoutSeconds: 10,
      invalidRetries: 3,
      enabled: true,
    };
  }

  private emptyOptionFormModel(): IvrOptionFormModel {
    return {
      digit: '',
      routeType: 'extension',
      routeTargetUUID: '',
      routeTargetValue: '',
      description: '',
      enabled: true,
    };
  }

  private openDialog() {
    const formDialog = this.formDialog();
    if (!formDialog || this.dialogBinding) return;
    this.dialogBinding = openCrudTemplateDialog(this.dialog, formDialog, 'voip-pabx-ivr-dialog', {
      onEscape: () => this.closeDialog(),
    });
  }

  private async confirm(title: string, message: string, confirmLabel: string) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: { title, message, confirmLabel },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    return Boolean(await firstValueFrom(ref.afterClosed()));
  }

  private reconcileSelection() {
    const validIds = new Set(this.rows().map((row) => row.VpiUUID));
    this.selectedUUIDs.update((set) => {
      const next = new Set<string>();
      set.forEach((uuid) => {
        if (validIds.has(uuid)) next.add(uuid);
      });
      return next;
    });
  }

  private failedUUIDs(items: Array<Record<string, unknown>>) {
    return items
      .map((item) => String(item['VpiUUID'] ?? item['uuid'] ?? ''))
      .filter((uuid) => uuid.length > 0);
  }

  private optionUuidOf(row: VoipPabxIvrOptionItem) {
    return row.VioUUID ?? row._localUUID ?? '';
  }

  private targetLabel(targetUUID: string | null | undefined) {
    if (!targetUUID) return '';
    const allOptions = [...this.extensionOptions(), ...this.optionTargetOptions()];
    return allOptions.find((option) => option.value === targetUUID)?.label ?? targetUUID;
  }

  private uuidOfResource(row: any) {
    return row.VpxUUID ?? row.VpgUUID ?? row.VpqUUID ?? row.VpiUUID ?? '';
  }

  private sortValue(row: VoipPabxIvrItem, column: string): string | number {
    switch (column) {
      case 'name':
        return this.sortText(row.VpiName);
      case 'pabx':
        return this.sortText(row.PabxName);
      case 'engine':
        return this.sortText(row.VpiEngine);
      case 'greeting':
        return this.sortText(row.MediaFileName ?? row.VpiGreetingText);
      case 'timeout':
        return Number(row.VpiTimeoutSeconds ?? 0);
      case 'retries':
        return Number(row.VpiInvalidRetries ?? 0);
      case 'status':
        return Number(row.VpiEnabled ?? 0);
      default:
        return this.sortText(String((row as any)[column] ?? ''));
    }
  }

  private sortText(value: unknown) {
    return String(value ?? '').toLowerCase();
  }

  private messageFromError(error: unknown, fallback: string) {
    const anyError = error as any;
    return anyError?.error?.error ?? anyError?.message ?? fallback;
  }
}
