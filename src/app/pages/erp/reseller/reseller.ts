import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewChild,
  inject,
  signal,
  ChangeDetectionStrategy
} from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatMenuModule } from '@angular/material/menu';
import { firstValueFrom, merge } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ApiService } from '../../../services/api.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { PhoneInputComponent } from '../../../shared/phone-input/phone-input.component';
import { TranslocoPipe } from '@jsverse/transloco';

type Reseller = {
  ResellerUUID: string;
  Type: 'company' | 'person';
  Name: string;
  Document?: string | null;
  Email?: string | null;
  Phone?: string | null;
  Street?: string | null;
  Number?: string | null;
  District?: string | null;
  City?: string | null;
  State?: string | null;
  Zip?: string | null;
  Country?: string | null;
  Status: number;
  Notes?: string | null;
};

type PostalCodeLookupItem = {
  street?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
};

@Component({
  selector: 'app-erp-reseller',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatChipsModule,
    MatTooltipModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    TranslocoPipe,
    MatCheckboxModule,
    MatMenuModule,
    PhoneInputComponent,
  ],
  templateUrl: './reseller.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./reseller.scss'],
})
export class ErpResellerPage implements OnInit, AfterViewInit, OnDestroy {
  private api = inject(ApiService);
  private snack = inject(SnackbarService);
  private cdr = inject(ChangeDetectorRef);
  private dialog = inject(MatDialog);
  private readonly listLimit = 200;
  resellers: Reseller[] = [];
  dataSource = new MatTableDataSource<Reseller>([]);
  displayedColumns: string[] = ['select', 'name', 'type', 'document', 'email', 'status', 'actions'];
  loading = true;
  saving = false;
  searchingPostalCode = false;
  error = '';
  search = '';
  searchInput = '';
  editingReseller: Reseller | null = null;
  selectedResellerUUIDs = new Set<string>();
  readonly emailControl = new FormControl('', [Validators.email]);
  readonly emailError = signal('');

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild('resellerFormDialog') resellerFormDialog?: TemplateRef<unknown>;
  @ViewChild('addressNumberInput') addressNumberInput?: ElementRef<HTMLInputElement>;
  private resellerFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;

  form = {
    type: 'company' as 'company' | 'person',
    name: '',
    document: '',
    phone: '',
    street: '',
    number: '',
    district: '',
    city: '',
    state: '',
    zip: '',
    country: '',
    notes: '',
    status: 1,
  };

  constructor() {
    merge(this.emailControl.statusChanges, this.emailControl.valueChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.updateEmailError());
  }

  ngOnInit() {
    this.resetForm();
  }

  ngOnDestroy() {
    this.stopDialogViewportObserver();
    this.closeResellerDialog();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sort = this.sort ?? null;
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'name':
          return data.Name ?? '';
        case 'type':
          return data.Type ?? '';
        case 'document':
          return data.Document ?? '';
        case 'email':
          return data.Email ?? '';
        case 'status':
          return data.Status ?? 0;
        default:
          return '';
      }
    };
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      return [data.Name, data.Document, data.Email, data.Phone]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    };

    setTimeout(() => {
      void this.loadResellers();
    }, 0);
  }

  onSearchChange(value: string) {
    this.searchInput = value;
  }

  applySearchFilters() {
    this.search = this.searchInput.trim();
    void this.loadResellers();
  }

  clearSearchFilters() {
    this.searchInput = '';
    this.search = '';
    void this.loadResellers();
  }

  refreshList() {
    void this.loadResellers();
  }

  applyFilter() {
    const q = this.search.trim().toLowerCase();
    this.dataSource.filter = q;
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  async loadResellers() {
    await new Promise((resolve) => setTimeout(resolve, 0));
    this.loading = true;
    this.cdr.detectChanges();
    this.error = '';
    const start = performance.now();
    try {
      const params = new URLSearchParams();
      params.set('limit', String(this.listLimit));
      if (this.search) params.set('q', this.search);
      const res = await this.api.get<any>(`erp/resellers?${params.toString()}`);
      this.resellers = res?.data?.items ?? [];
      this.dataSource.data = [...this.resellers];
      this.reconcileSelection();
      this.applyFilter();
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to load resellers.');
      this.dataSource.data = [];
    } finally {
      const elapsed = performance.now() - start;
      const minMs = 600;
      const waitMs = Math.max(0, minMs - elapsed);
      if (waitMs) {
        setTimeout(() => {
          this.loading = false;
          this.cdr.detectChanges();
        }, waitMs);
      } else {
        this.loading = false;
        this.cdr.detectChanges();
      }
    }
  }

  startCreate() {
    this.resetForm();
    this.openResellerDialog();
  }

  private resetForm() {
    this.editingReseller = null;
    this.form.type = 'company';
    this.form.name = '';
    this.form.document = '';
    this.emailControl.setValue('', { emitEvent: false });
    this.updateEmailError();
    this.form.phone = '';
    this.form.street = '';
    this.form.number = '';
    this.form.district = '';
    this.form.city = '';
    this.form.state = '';
    this.form.zip = '';
    this.form.country = '';
    this.form.notes = '';
    this.form.status = 1;
  }

  startEdit(reseller: Reseller) {
    this.editingReseller = reseller;
    this.form.type = reseller.Type;
    this.form.name = reseller.Name ?? '';
    this.form.document = reseller.Document ?? '';
    this.emailControl.setValue(reseller.Email ?? '', { emitEvent: false });
    this.updateEmailError();
    this.form.phone = reseller.Phone ?? '';
    this.form.street = reseller.Street ?? '';
    this.form.number = reseller.Number ?? '';
    this.form.district = reseller.District ?? '';
    this.form.city = reseller.City ?? '';
    this.form.state = reseller.State ?? '';
    this.form.zip = reseller.Zip ?? '';
    this.form.country = reseller.Country ?? '';
    this.form.notes = reseller.Notes ?? '';
    this.form.status = reseller.Status ?? 1;
    this.openResellerDialog();
  }

  async saveReseller(keepOpenForNew = false) {
    if (!this.form.name.trim()) {
      this.showWarning('Name is required.');
      return;
    }

    if (this.emailControl.value && this.emailControl.invalid) {
      this.showWarning('Email is invalid.');
      return;
    }

    if (this.form.phone && !/^\d{8,15}$/.test(this.form.phone)) {
      this.showWarning('Phone must contain 8 to 15 digits.');
      return;
    }

    this.saving = true;
    this.error = '';

    try {
      const payload = {
        type: this.form.type,
        name: this.form.name.trim(),
        document: this.form.document?.trim() || null,
        email: this.emailControl.value?.trim() || null,
        phone: this.form.phone?.trim() || null,
        street: this.form.street?.trim() || null,
        number: this.form.number?.trim() || null,
        district: this.form.district?.trim() || null,
        city: this.form.city?.trim() || null,
        state: this.form.state?.trim() || null,
        zip: this.form.zip?.trim() || null,
        country: this.form.country?.trim() || null,
        notes: this.form.notes?.trim() || null,
        status: this.form.status,
      };

      if (this.editingReseller) {
        await this.api.put(`erp/resellers/${this.editingReseller.ResellerUUID}`, payload);
        this.snack.success('Reseller updated successfully.');
      } else {
        await this.api.post('erp/resellers', payload);
        this.snack.success('Reseller created successfully.');
      }

      if (!this.editingReseller && keepOpenForNew) {
        this.resetForm();
        this.cdr.detectChanges();
      } else {
        this.closeResellerDialog();
        this.resetForm();
        this.cdr.detectChanges();
      }
      await this.loadResellers();
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to save reseller.');
    } finally {
      this.saving = false;
    }
  }

  saveAndNewReseller() {
    if (this.editingReseller) return;
    void this.saveReseller(true);
  }

  async searchPostalCode() {
    const normalizedZip = (this.form.zip ?? '').replace(/\D/g, '');

    if (!normalizedZip) {
      this.showWarning('Inform a postal code to search.');
      return;
    }

    if (!/^\d{8}$/.test(normalizedZip)) {
      this.showWarning('Invalid postal code. Provide 8 digits.');
      return;
    }

    this.searchingPostalCode = true;
    this.error = '';
    this.form.zip = normalizedZip;

    try {
      const res = await this.api.get<any>(`postal-codes/${normalizedZip}`);
      const item = (res?.data?.item ?? {}) as PostalCodeLookupItem;
      setTimeout(() => {
        this.form.street = item.street ?? this.form.street;
        this.form.district = item.district ?? this.form.district;
        this.form.city = item.city ?? this.form.city;
        this.form.state = item.state ?? this.form.state;
        this.searchingPostalCode = false;
        this.cdr.detectChanges();
        setTimeout(() => {
          this.addressNumberInput?.nativeElement?.focus();
        }, 0);
      }, 0);
    } catch (err: any) {
      setTimeout(() => {
        this.showError(err?.message ?? 'Failed to search postal code.');
        this.searchingPostalCode = false;
        this.cdr.detectChanges();
      }, 0);
    }
  }

  async deleteReseller(resellerUUID: string) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete reseller',
        message: 'Are you sure you want to delete this reseller?',
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;
    this.loading = true;
    this.error = '';
    try {
      await this.api.delete(`erp/resellers/${resellerUUID}`);
      this.selectedResellerUUIDs.delete(resellerUUID);
      await this.loadResellers();
      this.snack.success('Reseller deleted successfully.');
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to delete reseller.');
    } finally {
      this.loading = false;
    }
  }

  cancelResellerForm() {
    this.closeResellerDialog();
    this.resetForm();
  }

  get selectedCount() {
    return this.selectedResellerUUIDs.size;
  }

  visibleRows() {
    const filtered = this.dataSource.filter ? this.dataSource.filteredData : this.dataSource.data;
    const paginator = this.dataSource.paginator;
    if (!paginator) return filtered;
    const start = paginator.pageIndex * paginator.pageSize;
    return filtered.slice(start, start + paginator.pageSize);
  }

  isSelected(reseller: Reseller) {
    return this.selectedResellerUUIDs.has(reseller.ResellerUUID);
  }

  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  toggleResellerSelection(reseller: Reseller, checked: boolean) {
    if (checked) {
      this.selectedResellerUUIDs.add(reseller.ResellerUUID);
    } else {
      this.selectedResellerUUIDs.delete(reseller.ResellerUUID);
    }
  }

  toggleVisibleSelection(checked: boolean) {
    this.visibleRows().forEach((row) => this.toggleResellerSelection(row, checked));
  }

  async removeSelectedResellers() {
    const ids = Array.from(this.selectedResellerUUIDs);
    if (!ids.length) return;

    const labels = this.dataSource.data
      .filter((row) => this.selectedResellerUUIDs.has(row.ResellerUUID))
      .slice(0, 3)
      .map((row) => row.Name)
      .filter(Boolean);
    const detail = labels.length
      ? ` Selected: ${labels.join(', ')}${ids.length > 3 ? ', ...' : ''}`
      : '';

    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete selected resellers',
        message: `Are you sure you want to delete ${ids.length} selected reseller record(s)?${detail}`,
        confirmLabel: 'Delete selected',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.loading = true;
    this.error = '';
    try {
      const response = await this.api.delete<any>('erp/resellers/bulk', { ids });
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      const failed = new Set<string>(
        (response?.data?.failed ?? []).map((item: any) => item.ResellerUUID),
      );
      this.dataSource.data = this.dataSource.data.filter((row) => !deleted.has(row.ResellerUUID));
      this.resellers = this.resellers.filter((row) => !deleted.has(row.ResellerUUID));
      this.selectedResellerUUIDs.clear();
      failed.forEach((uuid) => this.selectedResellerUUIDs.add(uuid));
      await this.loadResellers();
      if (failed.size) {
        this.showError(`${failed.size} selected reseller record(s) could not be deleted.`);
      } else {
        this.snack.success(`${deleted.size || ids.length} reseller record(s) deleted.`);
      }
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to delete selected resellers.');
    } finally {
      this.loading = false;
    }
  }

  private reconcileSelection() {
    const validIds = new Set(this.dataSource.data.map((row) => row.ResellerUUID));
    Array.from(this.selectedResellerUUIDs).forEach((uuid) => {
      if (!validIds.has(uuid)) this.selectedResellerUUIDs.delete(uuid);
    });
  }

  private updateEmailError() {
    if (this.emailControl.hasError('email')) {
      this.emailError.set('Not a valid email');
    } else {
      this.emailError.set('');
    }
  }

  private showError(message: string) {
    this.error = '';
    this.snack.error(message);
  }

  private showWarning(message: string) {
    this.error = '';
    this.snack.warning(message);
  }

  private openResellerDialog() {
    if (!this.resellerFormDialog || this.resellerFormDialogRef) return;
    this.error = '';
    this.resellerFormDialogRef = this.dialog.open(this.resellerFormDialog, {
      ...this.getResellerDialogViewportConfig(),
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'erp-reseller-form-dialog',
    });
    this.resellerFormDialogRef.keydownEvents().subscribe((event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.closeResellerDialog();
      }
    });
    this.startDialogViewportObserver();
    this.resellerFormDialogRef.afterClosed().subscribe(() => {
      this.stopDialogViewportObserver();
      this.resellerFormDialogRef = null;
    });
  }

  private closeResellerDialog() {
    if (!this.resellerFormDialogRef) return;
    this.stopDialogViewportObserver();
    this.resellerFormDialogRef.close();
    this.resellerFormDialogRef = null;
  }

  private getResellerDialogViewportConfig() {
    if (window.innerWidth <= 900) {
      return {
        width: 'calc(100vw - 24px)',
        maxWidth: 'calc(100vw - 24px)',
        height: 'calc(100dvh - 24px)',
        maxHeight: 'calc(100dvh - 24px)',
        position: {
          left: '12px',
          top: '12px',
        },
      };
    }

    const pageContent = document.querySelector('.page-content') as HTMLElement | null;
    if (!pageContent) {
      return {
        width: 'min(1280px, calc(100vw - 1.5rem))',
        maxWidth: '99vw',
        maxHeight: '95vh',
      };
    }

    const rect = pageContent.getBoundingClientRect();
    const spacing = 8;
    const widthPx = Math.max(320, Math.floor(rect.width - spacing * 2));
    const maxHeightPx = Math.max(420, Math.floor(rect.height - spacing * 2));
    const leftPx = Math.max(0, Math.floor(rect.left + spacing));
    const topPx = Math.max(0, Math.floor(rect.top + spacing));

    return {
      width: `${widthPx}px`,
      maxWidth: `${widthPx}px`,
      maxHeight: `${maxHeightPx}px`,
      position: {
        left: `${leftPx}px`,
        top: `${topPx}px`,
      },
    };
  }

  private startDialogViewportObserver() {
    this.stopDialogViewportObserver();
    if (!this.resellerFormDialogRef) return;

    const pageContent = document.querySelector('.page-content') as HTMLElement | null;
    if (!pageContent) return;

    this.dialogViewportObserver = new ResizeObserver(() => {
      this.updateResellerDialogViewport();
    });
    this.dialogViewportObserver.observe(pageContent);
    this.updateResellerDialogViewport();
  }

  private stopDialogViewportObserver() {
    if (!this.dialogViewportObserver) return;
    this.dialogViewportObserver.disconnect();
    this.dialogViewportObserver = null;
  }

  private updateResellerDialogViewport() {
    if (!this.resellerFormDialogRef) return;
    const config = this.getResellerDialogViewportConfig();
    const width = typeof config.width === 'string' ? config.width : '';
    const height =
      typeof config.height === 'string'
        ? config.height
        : typeof config.maxHeight === 'string'
          ? config.maxHeight
          : '';
    this.resellerFormDialogRef.updateSize(width, height);
    if (config.position) {
      this.resellerFormDialogRef.updatePosition(config.position);
    } else {
      this.resellerFormDialogRef.updatePosition();
    }
  }
}
