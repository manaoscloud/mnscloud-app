import {
  Component,
  TemplateRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  viewChild,
  afterNextRender,
  DestroyRef,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { form as createForm, required } from '@angular/forms/signals';
import { HttpErrorResponse } from '@angular/common/http';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../shared/dialog/crud-dialog.util';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';
import { bindDialogClosed } from '../../../../shared/dialog/dialog-events.util';
import {
  MnsSearchSelectFieldComponent,
  MnsSelectFieldComponent,
  type MnsSearchSelectFieldOption,
} from '../../../../shared/forms';

type FeePlanAssignment = {
  BpaUUID: string;
  UserUsrUUID: string;
  TenantEmail: string | null;
  BillingFeePlanBfpUUID: string;
  FeePlanName: string;
  BpaBillingMode: 'PREPAID' | 'POSTPAID';
  BpaStatus: number;
};

type FeePlanOption = { BfpUUID: string; BfpName: string };

@Component({
  selector: 'app-system-mnscloud-pay-fee-plan-assignments',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    MnsSearchSelectFieldComponent,
    MnsSelectFieldComponent,
    MatCardModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatTooltipModule,
    TranslocoPipe,
    NgClass,
  ],
  templateUrl: './fee-plan-assignments.html',
  styleUrls: ['./fee-plan-assignments.scss'],
  host: { class: 'app-fade-in-host' },
})
export class SystemMnscloudPayFeePlanAssignmentsPage {
  private readonly api = inject(ApiService);
  private readonly snack = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);

  readonly pageTitle = computed(() => 'Payments — Fee Plan Assignments');
  readonly pageSubtitle = computed(
    () => 'Assign a fee plan and billing mode (prepaid/postpaid) to a specific tenant.',
  );
  readonly baseEndpoint = '/system/mnscloud-pay/fee-plan-assignments';

  private readonly assignmentsResource = resource({
    defaultValue: [] as FeePlanAssignment[],
    loader: async () => {
      const result = await this.api.get<any>(this.baseEndpoint);
      return Array.isArray(result?.data?.items) ? result.data.items : [];
    },
  });

  private readonly plansResource = resource({
    defaultValue: [] as FeePlanOption[],
    loader: async () => {
      const result = await this.api.get<any>('/system/mnscloud-pay/fee-plans');
      return Array.isArray(result?.data?.items) ? result.data.items : [];
    },
  });

  readonly assignments = signal<FeePlanAssignment[]>([]);
  readonly loadingAssignments = this.assignmentsResource.isLoading;
  readonly savingAssignment = signal<boolean>(false);
  readonly editingAssignment = signal<FeePlanAssignment | null>(null);

  readonly planOptions = computed(() =>
    this.plansResource
      .value()
      .map((plan: FeePlanOption) => ({ value: plan.BfpUUID, label: plan.BfpName })),
  );
  readonly billingModeOptions = [
    { value: 'PREPAID', label: 'Prepaid' },
    { value: 'POSTPAID', label: 'Postpaid (finance-authorized)' },
  ];

  readonly tenantOptions = signal<MnsSearchSelectFieldOption[]>([]);
  readonly loadingTenants = signal<boolean>(false);

  readonly assignmentFormModel = signal({
    tenantUUID: '',
    planUUID: '',
    billingMode: 'PREPAID',
    notes: '',
  });
  readonly assignmentForm = createForm(this.assignmentFormModel, (schema) => {
    required(schema.tenantUUID);
    required(schema.planUUID);
  });

  dataSource = new MatTableDataSource<FeePlanAssignment>([]);
  displayedColumns: string[] = ['tenant', 'plan', 'billingMode', 'status', 'actions'];
  search = '';
  searchInput = '';

  private readonly syncAssignments = effect(() => {
    const normalized = this.assignmentsResource.value();
    this.assignments.set(normalized);
    this.dataSource.data = [...normalized];
    this.applyFilter();
  });

  private readonly reportAssignmentsError = effect(() => {
    const error = this.assignmentsResource.error();
    if (error) {
      this.showError(this.friendlyError(error, 'Failed to load fee plan assignments.'));
      this.assignments.set([]);
      this.dataSource.data = [];
    }
  });

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly assignmentFormDialog = viewChild<TemplateRef<unknown>>('assignmentFormDialog');
  private assignmentFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;

  private readonly cleanupOnDestroy = inject(DestroyRef).onDestroy(() => {
    this.closeAssignmentDialog();
  });

  private readonly afterViewReady = afterNextRender(() => {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'tenant':
          return data.TenantEmail ?? '';
        case 'plan':
          return data.FeePlanName ?? '';
        case 'billingMode':
          return data.BpaBillingMode ?? '';
        case 'status':
          return data.BpaStatus ?? 0;
        default:
          return '';
      }
    };
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      return [data.TenantEmail, data.FeePlanName, data.BpaBillingMode]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    };
  });

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
    this.assignmentsResource.reload();
    this.plansResource.reload();
  }

  applyFilter() {
    this.dataSource.filter = this.search.trim().toLowerCase();
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  private friendlyError(error: unknown, fallback: string) {
    if (error instanceof HttpErrorResponse) {
      const serverMessage = error.error?.error;
      if (typeof serverMessage === 'string' && serverMessage.trim().length) {
        return serverMessage;
      }
      return error.message || fallback;
    }
    if (error instanceof Error) return error.message;
    return fallback;
  }

  assignmentStatusLabel(item: FeePlanAssignment) {
    return item.BpaStatus === 1 ? 'Active' : 'Inactive';
  }

  assignmentStatusChipClass(item: FeePlanAssignment) {
    return item.BpaStatus === 1 ? 'chip-success' : 'chip-skipped';
  }

  billingModeLabel(item: FeePlanAssignment) {
    return item.BpaBillingMode === 'POSTPAID' ? 'Postpaid' : 'Prepaid';
  }

  async tenantOpened(opened: boolean) {
    if (!opened || this.loadingTenants()) return;
    this.loadingTenants.set(true);
    try {
      const result = await this.api.get<any>('/system/billing/tenants');
      const items = Array.isArray(result?.data?.items) ? result.data.items : [];
      this.tenantOptions.set(
        items.map((item: any) => ({
          value: String(item.EnvironmentUUID ?? ''),
          label: `${item.TenantEmail ?? ''} ${item.EnvironmentName ? '(' + item.EnvironmentName + ')' : ''}`.trim(),
          searchText: `${item.TenantEmail ?? ''} ${item.EnvironmentName ?? ''}`,
        })),
      );
    } catch (error) {
      this.showError(this.friendlyError(error, 'Failed to load tenants.'));
    } finally {
      this.loadingTenants.set(false);
    }
  }

  openCreateDialog() {
    this.cancelEditAssignment();
    this.openAssignmentDialog();
  }

  openEditDialog(item: FeePlanAssignment) {
    this.startEditAssignment(item);
    this.openAssignmentDialog();
  }

  startEditAssignment(item: FeePlanAssignment) {
    this.editingAssignment.set(item);
    this.assignmentFormModel.set({
      tenantUUID: item.UserUsrUUID,
      planUUID: item.BillingFeePlanBfpUUID,
      billingMode: item.BpaBillingMode,
      notes: '',
    });
    this.tenantOptions.set([
      { value: item.UserUsrUUID, label: item.TenantEmail ?? item.UserUsrUUID },
    ]);
  }

  cancelEditAssignment() {
    this.editingAssignment.set(null);
    this.assignmentFormModel.set({
      tenantUUID: '',
      planUUID: '',
      billingMode: 'PREPAID',
      notes: '',
    });
  }

  cancelAssignmentForm() {
    this.closeAssignmentDialog();
    this.cancelEditAssignment();
  }

  async submitAssignment() {
    if (!this.assignmentForm().valid()) {
      this.showWarning('Please select a tenant and a fee plan.');
      return;
    }
    this.savingAssignment.set(true);
    const values = this.assignmentFormModel();
    try {
      if (this.editingAssignment()) {
        await this.api.put(`${this.baseEndpoint}/${this.editingAssignment()!.BpaUUID}`, {
          billingMode: values.billingMode,
          notes: values.notes || null,
        });
        this.showSuccess('Fee plan assignment updated.');
      } else {
        await this.api.post(this.baseEndpoint, {
          tenantUUID: values.tenantUUID,
          planUUID: values.planUUID,
          billingMode: values.billingMode,
          notes: values.notes || null,
        });
        this.showSuccess('Fee plan assigned to tenant.');
      }
      this.closeAssignmentDialog();
      this.cancelEditAssignment();
      this.assignmentsResource.reload();
    } catch (error) {
      this.showError(this.friendlyError(error, 'Failed to save fee plan assignment.'));
    } finally {
      this.savingAssignment.set(false);
    }
  }

  async deleteAssignment(item: FeePlanAssignment) {
    try {
      await this.api.delete(`${this.baseEndpoint}/${item.BpaUUID}`);
      this.showSuccess('Fee plan assignment removed.');
      this.assignmentsResource.reload();
    } catch (error) {
      this.showError(this.friendlyError(error, 'Failed to remove fee plan assignment.'));
    }
  }

  private showSuccess(message: string) {
    this.snack.success(message);
  }

  private showError(message: string) {
    this.snack.error(message);
  }

  private showWarning(message: string) {
    this.snack.warning(message);
  }

  private openAssignmentDialog() {
    const assignmentFormDialog = this.assignmentFormDialog();
    if (!assignmentFormDialog || this.assignmentFormDialogRef) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      assignmentFormDialog,
      'crud-dialog-panel',
      {
        onEscape: () => this.cancelAssignmentForm(),
      },
    );
    this.assignmentFormDialogRef = this.dialogBinding.ref;
    bindDialogClosed(this.assignmentFormDialogRef, () => {
      this.dialogBinding?.stop();
      this.dialogBinding = null;
      this.assignmentFormDialogRef = null;
    });
  }

  private closeAssignmentDialog() {
    if (!this.assignmentFormDialogRef) return;
    this.dialogBinding?.stop();
    this.dialogBinding = null;
    this.assignmentFormDialogRef.close();
    this.assignmentFormDialogRef = null;
  }
}
