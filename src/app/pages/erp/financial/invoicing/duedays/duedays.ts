import {
  AfterViewInit,
  Component,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewChild,
  inject,
  ChangeDetectionStrategy
} from '@angular/core';
import { FormsModule } from '@angular/forms';
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
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTabsModule } from '@angular/material/tabs';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../../../../services/api.service';
import { SnackbarService } from '../../../../../services/snackbar.service';
import { SlowConfirmDialogComponent } from '../../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslocoPipe } from '@jsverse/transloco';

type DueDayStatus = 'active' | 'inactive';

type ErpFinInvDueDay = {
  ErpFinInvDueDayUUID: string;
  Name: string;
  DueDay: number;
  BillingDay: number;
  ClosedMonth: boolean;
  Status: DueDayStatus;
  DateCreated?: string | null;
  DateUpdated?: string | null;
};

@Component({
  selector: 'app-invoicing-duedays',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
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
    MatCheckboxModule,
    MatTabsModule,
    TranslocoPipe,
  ],
  templateUrl: './duedays.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./duedays.scss'],
})
export class InvoicingDueDaysPage implements OnInit, AfterViewInit, OnDestroy {
  private api = inject(ApiService);
  private snack = inject(SnackbarService);
  private dialog = inject(MatDialog);

  dueDays: ErpFinInvDueDay[] = [];
  dataSource = new MatTableDataSource<ErpFinInvDueDay>([]);
  displayedColumns: string[] = ['name', 'dueDay', 'billingDay', 'closedMonth', 'status', 'actions'];
  loading = false;
  saving = false;
  error = '';
  search = '';
  searchInput = '';
  editingDueDay: ErpFinInvDueDay | null = null;

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild('dueDayFormDialog') dueDayFormDialog?: TemplateRef<unknown>;
  private dueDayFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;

  statusOptions: { value: DueDayStatus; label: string }[] = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ];

  daysOfMonth: number[] = Array.from({ length: 31 }, (_, i) => i + 1);

  form = {
    name: '',
    dueDay: 1,
    billingDay: 1,
    closedMonth: false,
    status: 'active' as DueDayStatus,
  };

  ngOnInit() {
    this.startCreate();
    void this.loadDueDays();
  }

  ngOnDestroy() {
    this.stopDialogViewportObserver();
    this.closeDueDayDialog();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sort = this.sort ?? null;
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'dueDay':
          return data.DueDay ?? 0;
        case 'billingDay':
          return data.BillingDay ?? 0;
        case 'name':
          return data.Name ?? '';
        case 'closedMonth':
          return data.ClosedMonth ? 1 : 0;
        case 'status':
          return data.Status ?? '';
        default:
          return '';
      }
    };
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      const closedMonthLabel = data.ClosedMonth ? 'yes' : 'no';
      return [
        data.Name,
        String(data.DueDay),
        String(data.BillingDay),
        closedMonthLabel,
        data.Status,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    };
  }

  onSearchChange(value: string) {
    this.searchInput = value;
  }

  applySearchFilters() {
    this.search = this.searchInput.trim();
    this.applyFilter();
  }

  clearSearchFilters() {
    this.searchInput = '';
    this.search = '';
    this.applyFilter();
  }

  refreshList() {
    void this.loadDueDays();
  }

  applyFilter() {
    const q = this.search.trim().toLowerCase();
    this.dataSource.filter = q;
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  async loadDueDays() {
    this.loading = true;
    this.error = '';
    try {
      const res = await this.api.get<any>('erp/financial/invoicing/duedays');
      this.dueDays = res?.data?.items ?? [];
      this.dataSource.data = [...this.dueDays];
      this.applySearchFilters();
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to load due days.');
      this.dataSource.data = [];
    } finally {
      this.loading = false;
    }
  }

  startCreate() {
    this.editingDueDay = null;
    this.form.name = '';
    this.form.dueDay = 1;
    this.form.billingDay = 1;
    this.form.closedMonth = false;
    this.form.status = 'active';
  }

  openCreateDialog() {
    this.startCreate();
    this.openDueDayDialog();
  }

  startEdit(item: ErpFinInvDueDay) {
    this.editingDueDay = item;
    this.form.name = item.Name ?? '';
    this.form.dueDay = Number(item.DueDay) || 1;
    this.form.billingDay = Number(item.BillingDay) || 1;
    this.form.closedMonth = Boolean(item.ClosedMonth);
    this.form.status = item.Status ?? 'active';
  }

  openEditDialog(item: ErpFinInvDueDay) {
    this.startEdit(item);
    this.openDueDayDialog();
  }

  private isValidDay(value: number) {
    return Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 31;
  }

  async saveDueDay() {
    const name = this.form.name.trim();
    if (!name) {
      this.showWarning('Name is required.');
      return;
    }

    if (!this.isValidDay(this.form.dueDay)) {
      this.showWarning('Due day must be between 1 and 31.');
      return;
    }

    if (!this.isValidDay(this.form.billingDay)) {
      this.showWarning('Billing day must be between 1 and 31.');
      return;
    }

    this.saving = true;
    this.error = '';

    try {
      const payload = {
        name,
        dueDay: Number(this.form.dueDay),
        billingDay: Number(this.form.billingDay),
        closedMonth: Boolean(this.form.closedMonth),
        status: this.form.status,
      };

      if (this.editingDueDay) {
        await this.api.put(
          `erp/financial/invoicing/duedays/${this.editingDueDay.ErpFinInvDueDayUUID}`,
          payload,
        );
        this.snack.success('Due day rule updated successfully.');
      } else {
        await this.api.post('erp/financial/invoicing/duedays', payload);
        this.snack.success('Due day rule created successfully.');
      }

      this.closeDueDayDialog();
      this.startCreate();
      setTimeout(() => {
        void this.loadDueDays();
      }, 0);
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to save due day.');
    } finally {
      // Avoid mutating loading in the same check cycle that may trigger global error UI.
      setTimeout(() => {
        this.saving = false;
      }, 0);
    }
  }

  cancelDueDayForm() {
    this.closeDueDayDialog();
    this.startCreate();
  }

  async deleteDueDay(dueDayUUID: string) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete due day',
        message: 'Are you sure you want to delete this due day rule?',
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
      await this.api.delete(`erp/financial/invoicing/duedays/${dueDayUUID}`);
      this.snack.success('Due day rule deleted successfully.');
      await this.loadDueDays();
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to delete due day.');
    } finally {
      setTimeout(() => {
        this.loading = false;
      }, 0);
    }
  }

  statusClass(status?: string) {
    return status ? `is-${status}` : '';
  }

  closedMonthLabel(value: boolean) {
    return value ? 'Yes' : 'No';
  }

  private openDueDayDialog() {
    if (!this.dueDayFormDialog || this.dueDayFormDialogRef) return;
    this.error = '';
    this.dueDayFormDialogRef = this.dialog.open(this.dueDayFormDialog, {
      ...this.getDueDayDialogViewportConfig(),
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'erp-due-day-form-dialog',
    });
    this.dueDayFormDialogRef.keydownEvents().subscribe((event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.cancelDueDayForm();
      }
    });
    this.startDialogViewportObserver();
    this.dueDayFormDialogRef.afterClosed().subscribe(() => {
      this.stopDialogViewportObserver();
      this.dueDayFormDialogRef = null;
    });
  }

  private closeDueDayDialog() {
    if (!this.dueDayFormDialogRef) return;
    this.stopDialogViewportObserver();
    this.dueDayFormDialogRef.close();
    this.dueDayFormDialogRef = null;
  }

  private getDueDayDialogViewportConfig() {
    if (window.innerWidth <= 900) {
      return {
        width: '100vw',
        maxWidth: '100vw',
        maxHeight: '100dvh',
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
    if (!this.dueDayFormDialogRef) return;

    const pageContent = document.querySelector('.page-content') as HTMLElement | null;
    if (!pageContent) return;

    this.dialogViewportObserver = new ResizeObserver(() => {
      this.updateDueDayDialogViewport();
    });
    this.dialogViewportObserver.observe(pageContent);
    this.updateDueDayDialogViewport();
  }

  private stopDialogViewportObserver() {
    if (!this.dialogViewportObserver) return;
    this.dialogViewportObserver.disconnect();
    this.dialogViewportObserver = null;
  }

  private updateDueDayDialogViewport() {
    if (!this.dueDayFormDialogRef) return;
    const config = this.getDueDayDialogViewportConfig();
    const width = typeof config.width === 'string' ? config.width : '';
    const maxHeight = typeof config.maxHeight === 'string' ? config.maxHeight : '';
    this.dueDayFormDialogRef.updateSize(width, maxHeight);
    if (config.position) {
      this.dueDayFormDialogRef.updatePosition(config.position);
    } else {
      this.dueDayFormDialogRef.updatePosition();
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
}
