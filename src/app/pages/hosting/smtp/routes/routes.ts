import { CommonModule } from '@angular/common';
import { Component, OnDestroy, TemplateRef, ViewChild, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginator, MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule, type Sort } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { fadeIn } from '../../../../shared/animations/fade.animation';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';

type SmtpAccount = { HsaUUID: string; HsaName: string; HspName?: string; HspProvider?: string };
type SmtpRoute = { HsrUUID: string; HsrEventType: string; HsrFromName?: string | null; HsrFromEmail?: string | null; HsrIsActive: number; HostingSmtpAccountHsaUUID: string; HsaName?: string; HspName?: string; HspProvider?: string };

@Component({ selector: 'app-hosting-smtp-routes', standalone: true, imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatCardModule, MatCheckboxModule, MatChipsModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, MatMenuModule, MatPaginatorModule, MatProgressSpinnerModule, MatSelectModule, MatSortModule, MatTableModule, MatTabsModule, MatTooltipModule], templateUrl: './routes.html', styleUrls: ['./routes.scss'], animations: [fadeIn] })
export class HostingSmtpRoutesPage implements OnDestroy {
  private readonly api = inject(ApiService); private readonly fb = inject(FormBuilder); private readonly route = inject(ActivatedRoute); private readonly dialog = inject(MatDialog); private readonly snack = inject(SnackbarService);
  @ViewChild('routeDialog') routeDialog?: TemplateRef<unknown>; @ViewChild(MatPaginator) paginator?: MatPaginator; @ViewChild(MatSort) sort?: MatSort;
  private dialogRef: MatDialogRef<unknown> | null = null; readonly dataSource = new MatTableDataSource<SmtpRoute>([]);
  readonly isMaster = signal(this.route.snapshot.data?.['scope'] === 'master'); readonly rootEndpoint = computed(() => this.isMaster() ? 'system/hosting/smtp' : 'hosting/smtp'); readonly endpoint = computed(() => `${this.rootEndpoint()}/routes`);
  readonly loading = signal(false); readonly saving = signal(false); readonly routes = signal<SmtpRoute[]>([]); readonly accounts = signal<SmtpAccount[]>([]); readonly editing = signal<SmtpRoute | null>(null); readonly selectedIds = signal<Set<string>>(new Set()); readonly selectedCount = computed(() => this.selectedIds().size); readonly pageIndex = signal(0); readonly pageSize = signal(10); readonly sortActive = signal(''); readonly sortDirection = signal<'asc' | 'desc' | ''>(''); readonly accountSearch = signal('');
  readonly displayedColumns = ['select', 'event', 'account', 'from', 'status', 'actions'];
  readonly filterForm = this.fb.nonNullable.group({ search: [''], accountUuid: [''], status: [''] });
  readonly form = this.fb.nonNullable.group({ eventType: ['general', [Validators.required]], accountUuid: ['', [Validators.required]], fromName: [''], fromEmail: ['', [Validators.email]], isActive: [1] });
  readonly eventTypeOptions = ['general', 'welcome', 'resetPassword', 'userAccessInvite', 'userAccessAccept'];
  readonly filteredAccountOptions = computed(() => { const term = this.accountSearch().trim().toLowerCase(); return this.accounts().filter((a) => !term || `${a.HsaName} ${a.HspName ?? ''}`.toLowerCase().includes(term)); });
  readonly filteredRoutes = computed(() => { const { search, accountUuid, status } = this.filterForm.getRawValue(); const term = search.trim().toLowerCase(); return this.sortRows(this.routes().filter((r) => (!term || `${r.HsrEventType} ${r.HsaName ?? ''} ${r.HsrFromEmail ?? ''}`.toLowerCase().includes(term)) && (!accountUuid || r.HostingSmtpAccountHsaUUID === accountUuid) && (status === '' || String(r.HsrIsActive) === status))); });
  readonly pagedRoutes = computed(() => { const start = this.pageIndex() * this.pageSize(); return this.filteredRoutes().slice(start, start + this.pageSize()); });
  ngOnInit() { this.dataSource.sortingDataAccessor = (row, column) => this.sortValue(row, column); void this.loadAll(); }
  ngOnDestroy() { this.dialogRef?.close(); }
  refreshList() { void this.loadAll(); }
  async loadAll() { this.loading.set(true); const start = performance.now(); try { const [accounts, routes] = await Promise.all([this.api.get<SmtpAccount[]>(`${this.rootEndpoint()}/accounts`), this.api.get<SmtpRoute[]>(this.endpoint())]); this.accounts.set(Array.isArray(accounts) ? accounts : []); this.routes.set(Array.isArray(routes) ? routes : []); this.dataSource.data = this.routes(); this.pageIndex.set(0); this.reconcileSelection(); } catch (e) { this.snack.error(this.errorMessage(e, 'Failed to load SMTP routes.')); } finally { setTimeout(() => this.loading.set(false), Math.max(0, 600 - (performance.now() - start))); } }
  applyFilters() { this.pageIndex.set(0); this.reconcileSelection(); } clearFilters() { this.filterForm.reset({ search: '', accountUuid: '', status: '' }); this.applyFilters(); } onPage(e: PageEvent) { this.pageIndex.set(e.pageIndex); this.pageSize.set(e.pageSize); } onSort(s: Sort) { this.sortActive.set(s.active); this.sortDirection.set(s.direction); this.pageIndex.set(0); } resetAccountSearch(opened: boolean) { if (!opened) this.accountSearch.set(''); }
  startCreate() { this.editing.set(null); this.form.reset({ eventType: 'general', accountUuid: '', fromName: '', fromEmail: '', isActive: 1 }); this.openDialog(); }
  startEdit(r: SmtpRoute) { this.editing.set(r); this.form.reset({ eventType: r.HsrEventType, accountUuid: r.HostingSmtpAccountHsaUUID, fromName: r.HsrFromName ?? '', fromEmail: r.HsrFromEmail ?? '', isActive: r.HsrIsActive ? 1 : 0 }); this.openDialog(); }
  private openDialog() { if (!this.routeDialog) return; this.dialogRef = this.dialog.open(this.routeDialog, { width: 'min(960px, calc(100vw - 32px))', maxWidth: '960px', height: 'min(92vh, 720px)', maxHeight: '92vh', disableClose: true, panelClass: 'crud-dialog-panel' }); this.dialogRef.keydownEvents().subscribe((e) => { if (e.key === 'Escape') this.closeDialog(); }); }
  openCrudTemplateDialog() { this.openDialog(); } closeDialog() { this.dialogRef?.close(); this.dialogRef = null; this.editing.set(null); }
  async save(keepOpen = false) { if (this.form.invalid) { this.form.markAllAsTouched(); return; } const raw = this.form.getRawValue(); const body = { eventType: raw.eventType, accountUuid: raw.accountUuid, fromName: raw.fromName, fromEmail: raw.fromEmail, isActive: raw.isActive === 1 }; this.saving.set(true); try { const editing = this.editing(); if (editing) await this.api.put(`${this.endpoint()}/${editing.HsrUUID}`, body); else await this.api.post(this.endpoint(), body); this.snack.success('SMTP route saved.'); await this.loadAll(); if (keepOpen && !editing) this.startCreate(); else this.closeDialog(); } catch (e) { this.snack.error(this.errorMessage(e, 'Failed to save SMTP route.')); } finally { this.saving.set(false); } }
  async deleteRoute(r: SmtpRoute) { if (!(await this.confirm(`Delete SMTP route ${r.HsrEventType}?`))) return; try { await this.api.delete(`${this.endpoint()}/${r.HsrUUID}`); this.snack.success('SMTP route deleted.'); await this.loadAll(); } catch (e) { this.snack.error(this.errorMessage(e, 'Failed to delete SMTP route.')); } }
  async deleteSelectedRoutes() { const ids = [...this.selectedIds()]; if (!ids.length || !(await this.confirm(`Delete ${ids.length} selected SMTP route(s)?`))) return; try { await this.api.delete(`${this.endpoint()}/bulk`, { ids }); this.selectedIds.set(new Set()); this.snack.success('Selected SMTP routes deleted.'); await this.loadAll(); } catch (e) { this.snack.error(this.errorMessage(e, 'Failed to delete selected SMTP routes.')); } }
  isSelected(r: SmtpRoute) { return this.selectedIds().has(r.HsrUUID); } toggleSelection(r: SmtpRoute, checked: boolean) { const n = new Set(this.selectedIds()); checked ? n.add(r.HsrUUID) : n.delete(r.HsrUUID); this.selectedIds.set(n); } toggleVisibleSelection(checked: boolean) { const n = new Set(this.selectedIds()); for (const r of this.pagedRoutes()) checked ? n.add(r.HsrUUID) : n.delete(r.HsrUUID); this.selectedIds.set(n); } isAllVisibleSelected() { const rows = this.pagedRoutes(); return rows.length > 0 && rows.every((r) => this.selectedIds().has(r.HsrUUID)); } isSomeVisibleSelected() { return this.pagedRoutes().some((r) => this.selectedIds().has(r.HsrUUID)) && !this.isAllVisibleSelected(); }
  accountLabel(r: SmtpRoute) { return r.HsaName ?? this.accounts().find((a) => a.HsaUUID === r.HostingSmtpAccountHsaUUID)?.HsaName ?? '-'; } fromLabel(r: SmtpRoute) { return r.HsrFromEmail || 'Default'; } statusLabel(v: number) { return v === 1 ? 'Active' : 'Inactive'; }
  private sortRows(rows: SmtpRoute[]) { const a = this.sortActive(); const d = this.sortDirection(); if (!a || !d) return rows; return [...rows].sort((x, y) => (d === 'asc' ? 1 : -1) * this.sortValue(x, a).localeCompare(this.sortValue(y, a), undefined, { numeric: true, sensitivity: 'base' })); } private sortValue(r: SmtpRoute, c: string) { if (c === 'event') return r.HsrEventType; if (c === 'account') return this.accountLabel(r); if (c === 'from') return this.fromLabel(r); if (c === 'status') return this.statusLabel(r.HsrIsActive); return ''; }
  private reconcileSelection() { const valid = new Set(this.routes().map((r) => r.HsrUUID)); this.selectedIds.set(new Set([...this.selectedIds()].filter((id) => valid.has(id)))); } private async confirm(message: string) { const ref = this.dialog.open(SlowConfirmDialogComponent, { data: { title: 'Confirm delete', message, confirmText: 'Delete', color: 'warn' }, panelClass: 'slow-confirm-dialog', disableClose: true }); return !!(await firstValueFrom(ref.afterClosed())); } private errorMessage(e: unknown, f: string) { const m = e as { error?: { error?: string }; message?: string }; return m?.error?.error || m?.message || f; }
}
