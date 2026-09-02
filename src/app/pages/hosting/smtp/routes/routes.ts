import {
  Component,
  DestroyRef,
  TemplateRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormField, email, form as createForm, required } from '@angular/forms/signals';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginator, MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule, type Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../shared/dialog/crud-dialog.util';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';
import { bindDialogClosed } from '../../../../shared/dialog/dialog-events.util';
import {
  MnsSearchSelectFieldComponent,
  type MnsSearchSelectFieldOption,
} from '../../../../shared/forms';

type SmtpAccount = {
  HsaUUID: string;
  HsaName: string;
  HspName?: string;
  HspProvider?: string;
};

type SmtpRoute = {
  HsrUUID: string;
  HsrEventType: string;
  HsrFromName?: string | null;
  HsrFromEmail?: string | null;
  HsrIsActive: number;
  HostingSmtpAccountHsaUUID: string;
  HsaName?: string;
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
  data: SmtpEventType[];
};

@Component({
  selector: 'app-hosting-smtp-routes',
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
  templateUrl: './routes.html',
  styleUrls: ['./routes.scss'],
})
export class HostingSmtpRoutesPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);
  private readonly destroyRef = inject(DestroyRef);

  readonly routeDialog = viewChild<TemplateRef<unknown>>('routeDialog');
  readonly testDialog = viewChild<TemplateRef<unknown>>('testDialog');
  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);

  private dialogBinding: CrudDialogBinding | null = null;
  private testDialogBinding: CrudDialogBinding | null = null;

  readonly isMaster = signal(this.route.snapshot.data?.['scope'] === 'master');
  readonly rootEndpoint = computed(() =>
    this.isMaster() ? 'system/hosting/smtp' : 'hosting/smtp',
  );
  readonly endpoint = computed(() => `${this.rootEndpoint()}/routes`);

  readonly saving = signal(false);
  readonly testing = signal(false);
  readonly routes = signal<SmtpRoute[]>([]);
  readonly accounts = signal<SmtpAccount[]>([]);
  readonly eventTypes = signal<SmtpEventType[]>([]);
  readonly editing = signal<SmtpRoute | null>(null);
  readonly testingRoute = signal<SmtpRoute | null>(null);
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly selectedCount = computed(() => this.selectedIds().size);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly sortActive = signal('');
  readonly sortDirection = signal<'asc' | 'desc' | ''>('');
  readonly accountSearch = signal('');

  readonly displayedColumns = ['select', 'event', 'account', 'from', 'status', 'actions'];

  readonly filterFormModel = signal({
    search: '',
    accountUuid: '',
    status: '',
  });
  readonly filterForm = createForm(this.filterFormModel);

  readonly routeFormModel = signal({
    eventType: 'general',
    accountUuid: '',
    fromName: '',
    fromEmail: '',
    isActive: 1,
  });
  readonly form = createForm(this.routeFormModel, (schema) => {
    required(schema.eventType);
    required(schema.accountUuid);
    email(schema.fromEmail);
  });

  readonly testFormModel = signal({
    to: '',
    subject: 'MNSCloud SMTP route test',
    html: '<p>This is a test email sent from an MNSCloud SMTP route.</p>',
  });
  readonly testForm = createForm(this.testFormModel, (schema) => {
    required(schema.to);
    email(schema.to);
  });

  private readonly routesResource = resource({
    params: () => ({
      rootEndpoint: this.rootEndpoint(),
      endpoint: this.endpoint(),
    }),
    defaultValue: {
      accounts: [] as SmtpAccount[],
      routes: [] as SmtpRoute[],
      eventTypes: [] as SmtpEventType[],
    },
    loader: async ({ params }) => {
      const [accounts, routes, eventTypesResponse] = await Promise.all([
        this.api.get<SmtpAccount[]>(`${params.rootEndpoint}/accounts`),
        this.api.get<SmtpRoute[]>(params.endpoint),
        this.api.get<SmtpEventTypeResponse | SmtpEventType[]>(`${params.rootEndpoint}/event-types`),
      ]);
      const eventTypes = Array.isArray(eventTypesResponse)
        ? eventTypesResponse
        : eventTypesResponse.data;
      return {
        accounts: Array.isArray(accounts) ? accounts : [],
        routes: Array.isArray(routes) ? routes : [],
        eventTypes: Array.isArray(eventTypes) ? eventTypes : [],
      };
    },
  });
  readonly loading = this.routesResource.isLoading;
  private readonly syncRoutes = effect(() => {
    const snapshot = this.routesResource.value();
    this.accounts.set(snapshot.accounts);
    this.routes.set(snapshot.routes);
    this.eventTypes.set(snapshot.eventTypes);
    this.pageIndex.set(0);
    this.reconcileSelection();
  });
  private readonly reportLoadError = effect(() => {
    const error = this.routesResource.error();
    if (!error) return;
    this.snack.error(this.errorMessage(error, 'Failed to load SMTP routes.'));
  });

  readonly filteredAccountOptions = computed(() => {
    const term = this.accountSearch().trim().toLowerCase();
    return this.accounts().filter(
      (account) =>
        !term || `${account.HsaName} ${account.HspName ?? ''}`.toLowerCase().includes(term),
    );
  });
  readonly accountSelectOptions = computed<MnsSearchSelectFieldOption[]>(() =>
    this.accounts().map((account) => ({
      value: account.HsaUUID,
      label: account.HsaName,
      description: account.HspName ?? account.HspProvider,
      searchText: `${account.HsaName} ${account.HspName ?? ''} ${account.HspProvider ?? ''} ${account.HsaUUID}`,
    })),
  );

  readonly filteredRoutes = computed(() => {
    const { search, accountUuid, status } = this.filterFormModel();
    const term = search.trim().toLowerCase();
    const rows = this.routes().filter((route) => {
      const matchesTerm =
        !term ||
        `${route.HsrEventType} ${route.HsaName ?? ''} ${route.HsrFromName ?? ''} ${route.HsrFromEmail ?? ''}`
          .toLowerCase()
          .includes(term);
      const matchesAccount = !accountUuid || route.HostingSmtpAccountHsaUUID === accountUuid;
      const matchesStatus = status === '' || String(route.HsrIsActive) === status;
      return matchesTerm && matchesAccount && matchesStatus;
    });
    return this.sortRows(rows);
  });

  readonly pagedRoutes = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.filteredRoutes().slice(start, start + this.pageSize());
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.closeDialog();
      this.closeTestDialog();
    });
  }

  refreshList() {
    this.routesResource.reload();
  }

  applyFilters() {
    this.pageIndex.set(0);
    this.reconcileSelection();
  }

  clearFilters() {
    this.filterFormModel.set({ search: '', accountUuid: '', status: '' });
    this.applyFilters();
  }

  onPage(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  onSort(sort: Sort) {
    this.sortActive.set(sort.active);
    this.sortDirection.set(sort.direction);
    this.pageIndex.set(0);
  }

  resetAccountSearch(opened: boolean) {
    if (!opened) this.accountSearch.set('');
  }

  startCreate() {
    this.editing.set(null);
    this.routeFormModel.set({
      eventType: 'general',
      accountUuid: '',
      fromName: '',
      fromEmail: '',
      isActive: 1,
    });
    this.openDialog();
  }

  startEdit(route: SmtpRoute) {
    this.editing.set(route);
    this.routeFormModel.set({
      eventType: route.HsrEventType,
      accountUuid: route.HostingSmtpAccountHsaUUID,
      fromName: route.HsrFromName ?? '',
      fromEmail: route.HsrFromEmail ?? '',
      isActive: route.HsrIsActive ? 1 : 0,
    });
    this.openDialog();
  }

  private openDialog() {
    const routeDialog = this.routeDialog();
    if (!routeDialog || this.dialogBinding) return;
    this.dialogBinding = openCrudTemplateDialog(this.dialog, routeDialog, 'crud-form-dialog', {
      onEscape: () => this.closeDialog(),
    });
    bindDialogClosed(this.dialogBinding.ref, () => {
      this.dialogBinding?.stop();
      this.dialogBinding = null;
    });
  }

  openCrudTemplateDialog() {
    this.openDialog();
  }

  closeDialog() {
    if (!this.dialogBinding) return;
    this.dialogBinding.ref.close();
    this.dialogBinding.stop();
    this.dialogBinding = null;
    this.editing.set(null);
  }

  startTest(route: SmtpRoute) {
    this.testingRoute.set(route);
    this.testFormModel.set({
      to: '',
      subject: `MNSCloud SMTP route test: ${route.HsrEventType}`,
      html: `<p>This is a test email sent from the ${route.HsrEventType} SMTP route.</p>`,
    });
    this.openTestDialog();
  }

  private openTestDialog() {
    const testDialog = this.testDialog();
    if (!testDialog || this.testDialogBinding) return;
    this.testDialogBinding = openCrudTemplateDialog(this.dialog, testDialog, 'crud-form-dialog', {
      onEscape: () => this.closeTestDialog(),
    });
    bindDialogClosed(this.testDialogBinding.ref, () => {
      this.testDialogBinding?.stop();
      this.testDialogBinding = null;
    });
  }

  closeTestDialog() {
    if (!this.testDialogBinding) return;
    this.testDialogBinding.ref.close();
    this.testDialogBinding.stop();
    this.testDialogBinding = null;
    this.testingRoute.set(null);
  }

  async sendTestEmail() {
    if (!this.testForm().valid()) {
      return;
    }
    const route = this.testingRoute();
    if (!route) return;
    const raw = this.testFormModel();
    this.testing.set(true);
    try {
      await this.api.post(`${this.endpoint()}/${route.HsrUUID}/test`, {
        to: raw.to,
        subject: raw.subject,
        html: raw.html,
      });
      this.snack.success('SMTP route test email sent.');
      this.closeTestDialog();
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to send SMTP route test email.'));
    } finally {
      this.testing.set(false);
    }
  }

  async save(keepOpen = false) {
    if (!this.form().valid()) {
      return;
    }

    const raw = this.routeFormModel();
    const payload = {
      eventType: raw.eventType,
      accountUuid: raw.accountUuid,
      fromName: raw.fromName,
      fromEmail: raw.fromEmail,
      isActive: raw.isActive === 1,
    };

    this.saving.set(true);
    try {
      const editing = this.editing();
      if (editing) {
        await this.api.put(`${this.endpoint()}/${editing.HsrUUID}`, payload);
        this.snack.success('SMTP route updated.');
      } else {
        await this.api.post(this.endpoint(), payload);
        this.snack.success('SMTP route created.');
      }
      this.routesResource.reload();
      if (keepOpen && !editing) this.startCreate();
      else this.closeDialog();
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to save SMTP route.'));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteRoute(route: SmtpRoute) {
    if (!(await this.confirm(`Delete SMTP route ${route.HsrEventType}?`))) return;

    try {
      await this.api.delete(`${this.endpoint()}/${route.HsrUUID}`);
      this.snack.success('SMTP route deleted.');
      this.routesResource.reload();
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to delete SMTP route.'));
    }
  }

  async deleteSelectedRoutes() {
    const ids = [...this.selectedIds()];
    if (!ids.length) return;
    if (!(await this.confirm(this.bulkDeleteMessage(ids)))) return;

    try {
      const response = await this.api.delete<any>(`${this.endpoint()}/bulk`, { ids });
      const result = this.parseBulkDeleteResult(response, ids);
      this.routes.set(this.routes().filter((route) => !result.deleted.has(route.HsrUUID)));
      this.selectedIds.set(result.failed);
      if (result.failed.size) {
        this.snack.error(`${result.failed.size} selected SMTP route(s) could not be deleted.`);
      } else {
        this.snack.success(`${result.deleted.size} selected SMTP route(s) deleted.`);
      }
      this.routesResource.reload();
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to delete selected SMTP routes.'));
    }
  }

  isSelected(route: SmtpRoute) {
    return this.selectedIds().has(route.HsrUUID);
  }

  toggleSelection(route: SmtpRoute, checked: boolean) {
    const next = new Set(this.selectedIds());
    checked ? next.add(route.HsrUUID) : next.delete(route.HsrUUID);
    this.selectedIds.set(next);
  }

  toggleVisibleSelection(checked: boolean) {
    const next = new Set(this.selectedIds());
    for (const route of this.pagedRoutes()) {
      checked ? next.add(route.HsrUUID) : next.delete(route.HsrUUID);
    }
    this.selectedIds.set(next);
  }

  isAllVisibleSelected() {
    const rows = this.pagedRoutes();
    return rows.length > 0 && rows.every((route) => this.selectedIds().has(route.HsrUUID));
  }

  isSomeVisibleSelected() {
    return (
      this.pagedRoutes().some((route) => this.selectedIds().has(route.HsrUUID)) &&
      !this.isAllVisibleSelected()
    );
  }

  accountLabel(route: SmtpRoute) {
    return (
      route.HsaName ??
      this.accounts().find((account) => account.HsaUUID === route.HostingSmtpAccountHsaUUID)
        ?.HsaName ??
      '-'
    );
  }

  fromLabel(route: SmtpRoute) {
    return route.HsrFromEmail || 'Default';
  }

  statusLabel(value: number) {
    return value === 1 ? 'Active' : 'Inactive';
  }

  statusChipClass(value: number) {
    return value === 1 ? 'chip-success' : 'chip-skipped';
  }

  private sortRows(rows: SmtpRoute[]) {
    const active = this.sortActive();
    const direction = this.sortDirection();
    if (!active || !direction) return rows;

    return [...rows].sort((a, b) => {
      const result = this.sortValue(a, active).localeCompare(this.sortValue(b, active), undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      return direction === 'asc' ? result : -result;
    });
  }

  private sortValue(route: SmtpRoute, column: string) {
    if (column === 'event') return this.eventLabel(route.HsrEventType);
    if (column === 'account') return this.accountLabel(route);
    if (column === 'from') return this.fromLabel(route);
    if (column === 'status') return this.statusLabel(route.HsrIsActive);
    return '';
  }

  eventLabel(code: string) {
    return this.eventTypes().find((event) => event.code === code)?.label ?? code;
  }

  private reconcileSelection() {
    const valid = new Set(this.routes().map((route) => route.HsrUUID));
    const current = untracked(() => this.selectedIds());
    const next = new Set([...current].filter((id) => valid.has(id)));
    if (next.size === current.size && [...next].every((id) => current.has(id))) return;
    this.selectedIds.set(next);
  }

  private async confirm(message: string) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: { title: 'Confirm delete', message, confirmText: 'Delete', color: 'warn' },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    return !!(await firstValueFrom(ref.afterClosed()));
  }

  private bulkDeleteMessage(ids: string[]) {
    const labels = this.routes()
      .filter((item) => ids.includes(item.HsrUUID))
      .slice(0, 3)
      .map((item) => item.HsrEventType);
    const suffix = labels.length ? ` (${labels.join(', ')}${ids.length > 3 ? ', ...' : ''})` : '';
    return `Delete ${ids.length} selected SMTP route(s)?${suffix}`;
  }

  private parseBulkDeleteResult(response: any, requestedIds: string[]) {
    const payload = response?.data ?? response ?? {};
    const failedItems = Array.isArray(payload.failed) ? payload.failed : [];
    const failed = new Set<string>(
      failedItems
        .map((item: any) => this.extractBulkFailureUUID(item))
        .filter((uuid: string | null): uuid is string => !!uuid),
    );
    const deletedItems = Array.isArray(payload.deleted) ? payload.deleted : [];
    const deleted = new Set<string>(
      deletedItems.length
        ? deletedItems.filter((uuid: unknown): uuid is string => typeof uuid === 'string')
        : requestedIds.filter((uuid) => !failed.has(uuid)),
    );
    return { deleted, failed };
  }

  private extractBulkFailureUUID(item: any): string | null {
    if (!item || typeof item !== 'object') return null;
    if (typeof item.HsrUUID === 'string') return item.HsrUUID;
    if (typeof item.UUID === 'string') return item.UUID;
    const uuidKey = Object.keys(item).find((key) => key.endsWith('UUID'));
    return uuidKey && typeof item[uuidKey] === 'string' ? item[uuidKey] : null;
  }

  private errorMessage(error: unknown, fallback: string) {
    const maybe = error as { error?: { error?: string }; message?: string };
    return maybe?.error?.error || maybe?.message || fallback;
  }
}
