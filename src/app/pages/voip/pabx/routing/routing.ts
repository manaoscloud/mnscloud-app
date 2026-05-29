import {
  AfterViewInit,
  Component,
  computed,
  inject,
  OnDestroy,
  signal,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatMenuModule } from '@angular/material/menu';
import { firstValueFrom } from 'rxjs';
import { fadeIn } from '../../../../shared/animations/fade.animation';
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
import { PabxRoutingResource, VoipPabxRoutingService } from './routing.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';

type Option = { value: string; label: string; pabxUUID?: string | null };
type MemberResource = Extract<PabxRoutingResource, 'group' | 'queue'>;

@Component({
  selector: 'app-voip-pabx-routing',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSortModule,
    MatTabsModule,
    TranslatePipe,
    MatTableModule,
    MatTooltipModule,
    MatCheckboxModule,
    MatMenuModule,
  ],
  templateUrl: './routing.html',
  styleUrls: ['./routing.scss'],
  animations: [fadeIn],
})
export class VoipPabxRoutingPage implements AfterViewInit, OnDestroy {
  private readonly listLimit = 5000;
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(VoipPabxRoutingService);
  private readonly pabxApi = inject(VoipPabxService);
  private readonly extensionApi = inject(VoipPabxExtensionService);
  private readonly mediaFileApi = inject(VoipPabxMediaFilesService);
  private readonly snack = inject(SnackbarService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);

  readonly resource = signal<PabxRoutingResource>('external');
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly deletingSelected = signal(false);
  readonly editing = signal<any | null>(null);
  readonly pabxOptions = signal<Option[]>([]);
  readonly extensionOptions = signal<Option[]>([]);
  readonly targetOptions = signal<Option[]>([]);
  readonly mediaFileOptions = signal<Option[]>([]);
  readonly memberRows = signal<any[]>([]);
  readonly ivrOptionRows = signal<any[]>([]);
  readonly optionTargetOptions = signal<Option[]>([]);
  readonly pabxSearch = signal('');
  readonly targetSearch = signal('');
  readonly mediaFileSearch = signal('');
  readonly memberExtensionSearch = signal('');
  readonly optionTargetSearch = signal('');
  readonly membersLoading = signal(false);
  readonly memberSaving = signal(false);
  readonly optionsLoading = signal(false);
  readonly optionSaving = signal(false);

  readonly filteredPabxOptions = computed(() =>
    this.filterOptions(this.pabxOptions(), this.pabxSearch()),
  );
  readonly filteredTargetOptions = computed(() =>
    this.filterOptions(this.targetOptions(), this.targetSearch()),
  );
  readonly filteredMediaFileOptions = computed(() => {
    const pabxUUID = this.form.controls.pabxUUID.value;
    return this.filterOptions(
      this.mediaFileOptions().filter((option) => !pabxUUID || option.pabxUUID === pabxUUID),
      this.mediaFileSearch(),
    );
  });

  readonly dataSource = new MatTableDataSource<any>([]);
  readonly displayedColumns = computed(() => {
    if (this.resource() === 'external') {
      return ['select', 'name', 'number', 'pabx', 'status', 'actions'];
    }
    return ['select', 'name', 'pabx', 'engine', 'status', 'actions'];
  });

  searchInput = '';
  search = '';
  readonly selectedRoutingUUIDs = new Set<string>();

  readonly form = this.fb.group({
    pabxUUID: ['', Validators.required],
    name: [''],
    number: [''],
    routeType: ['extension'],
    routeTargetUUID: [''],
    routeTargetValue: [''],
    context: ['default'],
    description: [''],
    strategy: ['ring_all'],
    ringStrategy: ['simultaneous'],
    timeoutSeconds: [30],
    retrySeconds: [5],
    maxWaitSeconds: [300],
    mediaFileUUID: [''],
    greetingText: [''],
    invalidRetries: [3],
    callerId: [''],
    dialPrefix: [''],
    enabled: [true],
  });
  readonly memberForm = this.fb.group({
    extensionUUID: ['', Validators.required],
    priority: [0],
    penalty: [0],
    delaySeconds: [0],
    enabled: [true],
  });
  readonly optionForm = this.fb.group({
    digit: ['', Validators.required],
    routeType: ['extension', Validators.required],
    routeTargetUUID: [''],
    routeTargetValue: [''],
    description: [''],
    enabled: [true],
  });

  @ViewChild(MatPaginator)
  paginator?: MatPaginator;
  @ViewChild(MatSort)
  sort?: MatSort;
  @ViewChild('routingFormDialog')
  routingFormDialog?: TemplateRef<unknown>;
  private dialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;

  readonly pageTitle = computed(() => {
    const titles: Record<PabxRoutingResource, string> = {
      external: 'PABX external destinations',
      group: 'PABX groups',
      queue: 'PABX queues',
      ivr: 'PABX IVRs',
    };
    return titles[this.resource()];
  });

  ngAfterViewInit() {
    this.route.data.subscribe((data) => {
      this.resource.set((data['resource'] as PabxRoutingResource) ?? 'external');
      this.resetForm();
      void this.refreshList();
    });
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sort = this.sort ?? null;
    this.dataSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
    this.dataSource.filterPredicate = (row, filter) =>
      JSON.stringify(row).toLowerCase().includes(filter.trim().toLowerCase());
  }

  ngOnDestroy() {
    this.closeDialog();
  }

  async refreshList() {
    const started = performance.now();
    this.loading.set(true);
    try {
      await this.loadLookups();
      const params = new URLSearchParams();
      params.set('limit', String(this.listLimit));
      if (this.search) params.set('search', this.search);
      const response = await this.api.list(this.resource(), params);
      this.dataSource.data = response?.data?.items ?? [];
      this.reconcileSelection();
      this.dataSource.filter = '';
      if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
    } catch (err: any) {
      this.snack.error(this.messageFromError(err));
    } finally {
      const waitMs = Math.max(0, 600 - (performance.now() - started));
      setTimeout(() => this.loading.set(false), waitMs);
    }
  }

  applySearchFilters() {
    this.search = this.searchInput.trim();
    void this.refreshList();
  }

  clearSearchFilters() {
    this.searchInput = '';
    this.search = '';
    void this.refreshList();
  }

  startCreate() {
    this.resetForm();
    this.openDialog();
  }

  startEdit(row: any) {
    this.editing.set(row);
    const resource = this.resource();
    this.form.patchValue({
      pabxUUID: row.VoipPabxAccountVpaUUID ?? '',
      name: row.VpxName ?? row.VpgName ?? row.VpqName ?? row.VpiName ?? '',
      number: row.VpxNumber ?? '',
      routeType: 'extension',
      routeTargetUUID: '',
      routeTargetValue: '',
      context: 'default',
      description: '',
      strategy: row.VpqStrategy ?? 'ring_all',
      ringStrategy: row.VpgRingStrategy ?? 'simultaneous',
      timeoutSeconds: row.VpxTimeoutSeconds ?? row.VpqTimeoutSeconds ?? row.VpiTimeoutSeconds ?? 30,
      retrySeconds: row.VpqRetrySeconds ?? 5,
      maxWaitSeconds: row.VpqMaxWaitSeconds ?? 300,
      mediaFileUUID: row.VoipPabxMediaFileVmfUUID ?? '',
      greetingText: row.VpiGreetingText ?? '',
      invalidRetries: row.VpiInvalidRetries ?? 3,
      callerId: row.VpxCallerId ?? '',
      dialPrefix: row.VpxDialPrefix ?? '',
      enabled: (row.VpxEnabled ?? row.VpgEnabled ?? row.VpqEnabled ?? row.VpiEnabled ?? 1) === 1,
    });
    if (this.isMemberResource()) {
      this.resetMemberForm();
      void this.loadMembers();
    }
    if (resource === 'ivr') {
      this.resetOptionForm();
      void this.loadIvrOptions();
      void this.loadOptionTargets();
    }
    this.openDialog();
  }

  async save(keepOpen = false) {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    try {
      const payload = this.payload();
      const editing = this.editing();
      if (editing) {
        await this.api.update(this.resource(), this.uuidOf(editing), payload);
        this.snack.success(`${this.singularTitle()} updated successfully.`);
      } else {
        const response = await this.api.create(this.resource(), payload);
        await this.persistPendingRows(response?.data?.items?.[0]);
        this.snack.success(`${this.singularTitle()} created successfully.`);
      }
      if (keepOpen && !editing) {
        this.resetForm();
        await this.loadLookups();
      } else {
        this.closeDialog();
      }
      await this.refreshList();
    } catch (err: any) {
      this.snack.error(this.messageFromError(err));
    } finally {
      this.saving.set(false);
    }
  }

  async saveAndNew() {
    await this.save(true);
  }

  async remove(row: any) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete item',
        message: 'Are you sure you want to delete this record?',
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;
    try {
      await this.api.remove(this.resource(), this.uuidOf(row));
      this.snack.success(`${this.singularTitle()} deleted successfully.`);
      this.selectedRoutingUUIDs.delete(this.uuidOf(row));
      await this.refreshList();
    } catch (err: any) {
      this.snack.error(this.messageFromError(err));
    }
  }

  get selectedCount() {
    return this.selectedRoutingUUIDs.size;
  }

  visibleRows() {
    const filtered = this.dataSource.filter ? this.dataSource.filteredData : this.dataSource.data;
    const paginator = this.dataSource.paginator;
    if (!paginator) return filtered;
    const start = paginator.pageIndex * paginator.pageSize;
    return filtered.slice(start, start + paginator.pageSize);
  }

  isSelected(row: any) {
    return this.selectedRoutingUUIDs.has(this.uuidOf(row));
  }

  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  toggleRoutingSelection(row: any, checked: boolean) {
    const uuid = this.uuidOf(row);
    if (!uuid) return;
    if (checked) {
      this.selectedRoutingUUIDs.add(uuid);
    } else {
      this.selectedRoutingUUIDs.delete(uuid);
    }
  }

  toggleVisibleSelection(checked: boolean) {
    this.visibleRows().forEach((row) => this.toggleRoutingSelection(row, checked));
  }

  async removeSelected() {
    const ids = Array.from(this.selectedRoutingUUIDs);
    if (!ids.length) return;

    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete Selected Records',
        message: `Are you sure you want to delete ${ids.length} selected record(s)?`,
        confirmLabel: 'Delete selected',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.deletingSelected.set(true);
    try {
      const response = await this.api.removeMany(this.resource(), ids);
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      const failed = new Set<string>(
        (response?.data?.failed ?? []).map((item: any) => {
          const values = Object.entries(item).filter(([key]) => key !== 'message');
          return String(values[0]?.[1] ?? '');
        }),
      );
      this.dataSource.data = this.dataSource.data.filter((row) => !deleted.has(this.uuidOf(row)));
      this.selectedRoutingUUIDs.clear();
      failed.forEach((uuid) => {
        if (uuid) this.selectedRoutingUUIDs.add(uuid);
      });
      if (failed.size) {
        this.snack.warning(`${failed.size} selected record(s) could not be deleted.`);
      } else {
        this.snack.success(`${deleted.size} selected record(s) deleted successfully.`);
      }
      this.dataSource.filter = this.search.trim().toLowerCase();
    } catch (err: any) {
      this.snack.error(this.messageFromError(err));
    } finally {
      this.deletingSelected.set(false);
    }
  }

  async onRouteTypeChange() {
    this.form.controls.routeTargetUUID.setValue('');
    this.targetSearch.set('');
    await this.loadTargets();
  }

  async onPabxChange() {
    this.form.controls.routeTargetUUID.setValue('');
    this.memberForm.controls.extensionUUID.setValue('');
    this.optionForm.controls.routeTargetUUID.setValue('');
    this.targetSearch.set('');
    this.memberExtensionSearch.set('');
    this.optionTargetSearch.set('');
    if (this.isMemberResource() && !this.editing()) this.memberRows.set([]);
    if (this.resource() === 'ivr' && !this.editing()) this.ivrOptionRows.set([]);
    await this.loadTargets();
    await this.loadOptionTargets();
  }

  onPabxOpened(opened: boolean) {
    if (!opened) this.pabxSearch.set('');
  }

  onTargetOpened(opened: boolean) {
    if (!opened) this.targetSearch.set('');
  }

  onMediaFileOpened(opened: boolean) {
    if (!opened) this.mediaFileSearch.set('');
  }

  onMemberExtensionOpened(opened: boolean) {
    if (!opened) this.memberExtensionSearch.set('');
  }

  onOptionTargetOpened(opened: boolean) {
    if (!opened) this.optionTargetSearch.set('');
  }

  async onOptionRouteTypeChange() {
    this.optionForm.controls.routeTargetUUID.setValue('');
    this.optionTargetSearch.set('');
    await this.loadOptionTargets();
  }

  filteredMemberExtensionOptions() {
    const selectedPabxUUID = this.form.controls.pabxUUID.value;
    const linkedExtensions = new Set(
      this.memberRows()
        .map((row) => row.VoipPabxExtensionVpeUUID)
        .filter(Boolean),
    );
    return this.filterOptions(
      this.extensionOptions().filter(
        (option) =>
          (!selectedPabxUUID || option.pabxUUID === selectedPabxUUID) &&
          !linkedExtensions.has(option.value),
      ),
      this.memberExtensionSearch(),
    );
  }

  filteredOptionTargetOptions() {
    return this.filterOptions(this.optionTargetOptions(), this.optionTargetSearch());
  }

  routeLabel(row: any) {
    return row.RouteTargetLabel ?? '';
  }

  ivrOptionTargetLabel(row: any) {
    const targetUUID = row.VioRouteTargetUUID;
    if (!targetUUID) return row.VioRouteTargetValue ?? '';
    const allOptions = [
      ...this.extensionOptions(),
      ...this.targetOptions(),
      ...this.optionTargetOptions(),
    ];
    return allOptions.find((option) => option.value === targetUUID)?.label ?? targetUUID;
  }

  uuidOf(row: any) {
    return row.VpxUUID ?? row.VpgUUID ?? row.VpqUUID ?? row.VpiUUID;
  }

  private payload() {
    const value = this.form.getRawValue();
    const base: Record<string, unknown> = {
      pabxUUID: value.pabxUUID,
      enabled: value.enabled,
    };
    switch (this.resource()) {
      case 'external':
        return {
          ...base,
          name: value.name,
          number: value.number,
          callerId: value.callerId,
          dialPrefix: value.dialPrefix,
          timeoutSeconds: value.timeoutSeconds,
        };
      case 'group':
        return {
          ...base,
          name: value.name,
          ringStrategy: value.ringStrategy,
          ringTimeoutSeconds: value.timeoutSeconds,
        };
      case 'queue':
        return {
          ...base,
          name: value.name,
          strategy: value.strategy,
          timeoutSeconds: value.timeoutSeconds,
          retrySeconds: value.retrySeconds,
          maxWaitSeconds: value.maxWaitSeconds,
          mediaFileUUID: value.mediaFileUUID || null,
        };
      case 'ivr':
        return {
          ...base,
          name: value.name,
          greetingText: value.greetingText,
          mediaFileUUID: value.mediaFileUUID || null,
          timeoutSeconds: value.timeoutSeconds,
          invalidRetries: value.invalidRetries,
        };
    }
  }

  private async loadLookups() {
    const [pabxResponse, extResponse, mediaFileResponse] = await Promise.all([
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
      (extResponse?.data?.items ?? []).map((item: VoipPabxExtensionItem) => ({
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
    await this.loadTargets();
    if (this.resource() === 'ivr') await this.loadOptionTargets();
  }

  private async loadTargets() {
    const routeType = this.form.controls.routeType.value;
    const pabxUUID = this.form.controls.pabxUUID.value;
    if (routeType === 'extension') {
      this.targetOptions.set(
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
      this.targetOptions.set([]);
      return;
    }
    const params = new URLSearchParams();
    params.set('limit', String(this.listLimit));
    if (pabxUUID) params.set('pabxUUID', pabxUUID);
    const response = await this.api.list(resource, params);
    this.targetOptions.set(
      (response?.data?.items ?? []).map((item: any) => ({
        value: this.uuidOf(item),
        label: item.VpxName ?? item.VpgName ?? item.VpqName ?? item.VpiName ?? this.uuidOf(item),
      })),
    );
  }

  private targetLabel(targetUUID: string | null | undefined) {
    if (!targetUUID) return '';
    const allOptions = [
      ...this.extensionOptions(),
      ...this.targetOptions(),
      ...this.optionTargetOptions(),
    ];
    return allOptions.find((option) => option.value === targetUUID)?.label ?? targetUUID;
  }

  private async loadOptionTargets() {
    if (this.resource() !== 'ivr') {
      this.optionTargetOptions.set([]);
      return;
    }
    const routeType = this.optionForm.controls.routeType.value;
    const pabxUUID = this.form.controls.pabxUUID.value;
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
    const params = new URLSearchParams();
    params.set('limit', String(this.listLimit));
    if (pabxUUID) params.set('pabxUUID', pabxUUID);
    const response = await this.api.list(resource, params);
    const currentIvrUUID =
      this.resource() === 'ivr' && this.editing() ? this.uuidOf(this.editing()) : '';
    this.optionTargetOptions.set(
      (response?.data?.items ?? [])
        .filter((item: any) => resource !== 'ivr' || this.uuidOf(item) !== currentIvrUUID)
        .map((item: any) => ({
          value: this.uuidOf(item),
          label: item.VpxName ?? item.VpgName ?? item.VpqName ?? item.VpiName ?? this.uuidOf(item),
        })),
    );
  }

  private async loadMembers() {
    if (!this.isMemberResource() || !this.editing()) {
      this.memberRows.set([]);
      return;
    }
    this.membersLoading.set(true);
    try {
      const response = await this.api.listMembers(
        this.resource() as MemberResource,
        this.uuidOf(this.editing()),
      );
      this.memberRows.set(response?.data?.items ?? []);
    } catch (err: any) {
      this.snack.error(this.messageFromError(err));
    } finally {
      this.membersLoading.set(false);
    }
  }

  async addMember() {
    if (!this.isMemberResource() || this.memberSaving()) return;
    if (this.memberForm.invalid) {
      this.memberForm.markAllAsTouched();
      return;
    }
    const resource = this.resource() as MemberResource;
    const payload = this.memberPayload();

    if (!this.editing()) {
      this.memberRows.update((rows) => [...rows, this.pendingMemberRow(resource, payload)]);
      this.resetMemberForm();
      return;
    }

    this.memberSaving.set(true);
    try {
      const response = await this.api.createMember(resource, this.uuidOf(this.editing()), payload);
      this.memberRows.set(response?.data?.items ?? []);
      this.resetMemberForm();
      this.snack.success('Member added successfully.');
    } catch (err: any) {
      this.snack.error(this.messageFromError(err));
    } finally {
      this.memberSaving.set(false);
    }
  }

  async removeMember(row: any) {
    if (!this.isMemberResource()) return;
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete member',
        message: 'Are you sure you want to remove this member?',
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    if (!this.editing()) {
      const memberUUID = this.memberUuidOf(row);
      this.memberRows.update((rows) =>
        rows.filter((member) => this.memberUuidOf(member) !== memberUUID),
      );
      return;
    }

    try {
      await this.api.removeMember(
        this.resource() as MemberResource,
        this.uuidOf(this.editing()),
        this.memberUuidOf(row),
      );
      await this.loadMembers();
      this.snack.success('Member removed successfully.');
    } catch (err: any) {
      this.snack.error(this.messageFromError(err));
    }
  }

  private async persistPendingRows(createdRow: any) {
    await this.persistPendingMembers(createdRow);
    await this.persistPendingIvrOptions(createdRow);
  }

  private async persistPendingMembers(createdRow: any) {
    if (!this.isMemberResource() || this.editing() || !this.memberRows().length) return;
    const parentUUID = this.uuidOf(createdRow);
    if (!parentUUID) return;
    const resource = this.resource() as MemberResource;
    for (const member of this.memberRows()) {
      await this.api.createMember(
        resource,
        parentUUID,
        this.payloadFromMemberRow(resource, member),
      );
    }
  }

  private async loadIvrOptions() {
    if (this.resource() !== 'ivr' || !this.editing()) {
      this.ivrOptionRows.set([]);
      return;
    }
    this.optionsLoading.set(true);
    try {
      const response = await this.api.listIvrOptions(this.uuidOf(this.editing()));
      this.ivrOptionRows.set(response?.data?.items ?? []);
    } catch (err: any) {
      this.snack.error(this.messageFromError(err));
    } finally {
      this.optionsLoading.set(false);
    }
  }

  async addIvrOption() {
    if (this.resource() !== 'ivr' || this.optionSaving()) return;
    if (this.optionForm.invalid) {
      this.optionForm.markAllAsTouched();
      return;
    }
    const payload = this.ivrOptionPayload();
    const digit = String(payload.digit ?? '').trim();
    const duplicateDigit = this.ivrOptionRows().some(
      (row) => String(row.VioDigit ?? '').trim() === digit,
    );
    if (duplicateDigit) {
      this.snack.warning('IVR option digit already linked.');
      return;
    }
    if (!this.editing()) {
      this.ivrOptionRows.update((rows) => [...rows, this.pendingIvrOptionRow(payload)]);
      this.resetOptionForm();
      await this.loadOptionTargets();
      return;
    }

    this.optionSaving.set(true);
    try {
      const response = await this.api.createIvrOption(this.uuidOf(this.editing()), payload);
      this.ivrOptionRows.set(response?.data?.items ?? []);
      this.resetOptionForm();
      await this.loadOptionTargets();
      this.snack.success('IVR option added successfully.');
    } catch (err: any) {
      this.snack.error(this.messageFromError(err));
    } finally {
      this.optionSaving.set(false);
    }
  }

  async removeIvrOption(row: any) {
    if (this.resource() !== 'ivr') return;
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete IVR option',
        message: 'Are you sure you want to remove this IVR option?',
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    if (!this.editing()) {
      const optionUUID = this.ivrOptionUuidOf(row);
      this.ivrOptionRows.update((rows) =>
        rows.filter((option) => this.ivrOptionUuidOf(option) !== optionUUID),
      );
      return;
    }

    try {
      await this.api.removeIvrOption(this.uuidOf(this.editing()), this.ivrOptionUuidOf(row));
      await this.loadIvrOptions();
      this.snack.success('IVR option removed successfully.');
    } catch (err: any) {
      this.snack.error(this.messageFromError(err));
    }
  }

  private async persistPendingIvrOptions(createdRow: any) {
    if (this.resource() !== 'ivr' || this.editing() || !this.ivrOptionRows().length) return;
    const ivrUUID = this.uuidOf(createdRow);
    if (!ivrUUID) return;
    for (const option of this.ivrOptionRows()) {
      await this.api.createIvrOption(ivrUUID, this.payloadFromIvrOptionRow(option));
    }
  }

  private resetForm() {
    this.editing.set(null);
    this.pabxSearch.set('');
    this.targetSearch.set('');
    this.mediaFileSearch.set('');
    this.memberExtensionSearch.set('');
    this.optionTargetSearch.set('');
    this.memberRows.set([]);
    this.ivrOptionRows.set([]);
    this.optionTargetOptions.set([]);
    this.form.reset({
      pabxUUID: '',
      name: '',
      number: '',
      routeType: 'extension',
      routeTargetUUID: '',
      routeTargetValue: '',
      context: 'default',
      description: '',
      strategy: 'ring_all',
      ringStrategy: 'simultaneous',
      timeoutSeconds: 30,
      retrySeconds: 5,
      maxWaitSeconds: 300,
      mediaFileUUID: '',
      greetingText: '',
      invalidRetries: 3,
      callerId: '',
      dialPrefix: '',
      enabled: true,
    });
    this.resetMemberForm();
    this.resetOptionForm();
  }

  private resetMemberForm() {
    this.memberExtensionSearch.set('');
    this.memberForm.reset({
      extensionUUID: '',
      priority: 0,
      penalty: 0,
      delaySeconds: 0,
      enabled: true,
    });
  }

  private memberPayload() {
    const resource = this.resource() as MemberResource;
    const value = this.memberForm.getRawValue();
    const payload: Record<string, unknown> = {
      extensionUUID: value.extensionUUID,
      priority: value.priority,
      enabled: value.enabled,
    };
    if (resource === 'queue') {
      payload['penalty'] = value.penalty;
    } else {
      payload['delaySeconds'] = value.delaySeconds;
    }
    return payload;
  }

  private pendingMemberRow(resource: MemberResource, payload: Record<string, unknown>) {
    const extensionUUID = String(payload['extensionUUID'] ?? '');
    const extension = this.extensionOptions().find((option) => option.value === extensionUUID);
    const enabled = payload['enabled'] ? 1 : 0;
    if (resource === 'queue') {
      return {
        _localUUID: crypto.randomUUID(),
        VoipPabxExtensionVpeUUID: extensionUUID,
        ExtensionUsername: extension?.label ?? extensionUUID,
        VqmPriority: payload['priority'],
        VqmPenalty: payload['penalty'],
        VqmEnabled: enabled,
      };
    }
    return {
      _localUUID: crypto.randomUUID(),
      VoipPabxExtensionVpeUUID: extensionUUID,
      ExtensionUsername: extension?.label ?? extensionUUID,
      VgmPriority: payload['priority'],
      VgmDelaySeconds: payload['delaySeconds'],
      VgmEnabled: enabled,
    };
  }

  private payloadFromMemberRow(resource: MemberResource, row: any) {
    const payload: Record<string, unknown> = {
      extensionUUID: row.VoipPabxExtensionVpeUUID,
      priority: row.VgmPriority ?? row.VqmPriority ?? 0,
      enabled: (row.VgmEnabled ?? row.VqmEnabled ?? 1) === 1,
    };
    if (resource === 'queue') {
      payload['penalty'] = row.VqmPenalty ?? 0;
    } else {
      payload['delaySeconds'] = row.VgmDelaySeconds ?? 0;
    }
    return payload;
  }

  private resetOptionForm() {
    this.optionTargetSearch.set('');
    this.optionForm.reset({
      digit: '',
      routeType: 'extension',
      routeTargetUUID: '',
      routeTargetValue: '',
      description: '',
      enabled: true,
    });
  }

  private ivrOptionPayload() {
    const value = this.optionForm.getRawValue();
    return {
      digit: value.digit,
      routeType: value.routeType,
      routeTargetUUID: value.routeTargetUUID,
      routeTargetValue: value.routeTargetValue,
      description: value.description,
      enabled: value.enabled,
    };
  }

  private pendingIvrOptionRow(payload: Record<string, unknown>) {
    return {
      _localUUID: crypto.randomUUID(),
      VioDigit: payload['digit'],
      VioRouteType: payload['routeType'],
      VioRouteTargetUUID: payload['routeTargetUUID'],
      VioRouteTargetValue: payload['routeTargetValue'],
      VioDescription: payload['description'],
      VioEnabled: payload['enabled'] ? 1 : 0,
    };
  }

  private payloadFromIvrOptionRow(row: any) {
    return {
      digit: row.VioDigit,
      routeType: row.VioRouteType,
      routeTargetUUID: row.VioRouteTargetUUID,
      routeTargetValue: row.VioRouteTargetValue,
      description: row.VioDescription,
      enabled: (row.VioEnabled ?? 1) === 1,
    };
  }

  private openDialog() {
    if (!this.routingFormDialog || this.dialogRef) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      this.routingFormDialog,
      'voip-pabx-routing-dialog',
    );
    this.dialogRef = this.dialogBinding.ref;
    this.dialogRef.keydownEvents().subscribe((event: KeyboardEvent) => {
      if (event.key === 'Escape') this.closeDialog();
    });
  }

  closeDialog() {
    this.dialogBinding?.stop();
    this.dialogBinding = null;
    this.dialogRef?.close();
    this.dialogRef = null;
  }

  private messageFromError(err: any) {
    return err?.error?.message || err?.error?.error || err?.message || 'Operation failed.';
  }

  private filterOptions(options: Option[], search: string) {
    const value = search.trim().toLowerCase();
    if (!value) return options;
    return options.filter((option) => option.label.toLowerCase().includes(value));
  }

  private reconcileSelection() {
    const validIds = new Set(this.dataSource.data.map((row) => this.uuidOf(row)));
    Array.from(this.selectedRoutingUUIDs).forEach((uuid) => {
      if (!validIds.has(uuid)) this.selectedRoutingUUIDs.delete(uuid);
    });
  }

  private sortValue(row: any, column: string): string | number {
    switch (column) {
      case 'name':
        return this.normalizeSortText(
          row.VpxName ?? row.VpgName ?? row.VpqName ?? row.VpiName ?? '',
        );
      case 'number':
        return this.normalizeSortText(row.VpxNumber ?? '');
      case 'pabx':
        return this.normalizeSortText(row.PabxName ?? '');
      case 'engine':
        return this.normalizeSortText(
          row.VpxEngine ?? row.VpgEngine ?? row.VpqEngine ?? row.VpiEngine ?? '',
        );
      case 'route':
        return this.normalizeSortText(this.routeLabel(row));
      case 'status':
        return Number(row.VpxEnabled ?? row.VpgEnabled ?? row.VpqEnabled ?? row.VpiEnabled ?? 0);
      default:
        return this.normalizeSortText(String(row[column] ?? ''));
    }
  }

  private normalizeSortText(value: string) {
    return value.trim().toLowerCase();
  }

  private isMemberResource() {
    return this.resource() === 'group' || this.resource() === 'queue';
  }

  private memberUuidOf(row: any) {
    return row.VgmUUID ?? row.VqmUUID ?? row._localUUID;
  }

  private ivrOptionUuidOf(row: any) {
    return row.VioUUID ?? row._localUUID;
  }

  private singularTitle() {
    const titles: Record<PabxRoutingResource, string> = {
      external: 'PABX external destination',
      group: 'PABX group',
      queue: 'PABX queue',
      ivr: 'PABX IVR',
    };
    return titles[this.resource()];
  }
}
