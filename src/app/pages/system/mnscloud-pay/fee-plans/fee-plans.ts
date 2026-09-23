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
import { MatTabsModule } from '@angular/material/tabs';

import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../shared/dialog/crud-dialog.util';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';
import { bindDialogClosed } from '../../../../shared/dialog/dialog-events.util';
import { MnsSelectFieldComponent, MnsTextFieldComponent } from '../../../../shared/forms';

type FeePlan = {
  BfpUUID: string;
  BfpName: string;
  BfpDescription: string | null;
  BfpIsDefault: number;
  BfpStatus: number;
};

type FeePlanRate = {
  BfrUUID: string;
  BillingFeePlanBfpUUID: string;
  BfrTransactionType: string;
  BfrProvider: string;
  BfrFixedAmount: number;
  BfrPercentRate: number;
  BfrMinFeeAmount: number | null;
  BfrMaxFeeAmount: number | null;
  BfrCurrency: string;
};

type FeePlanTier = {
  BftUUID: string;
  BillingFeePlanRateBfrUUID: string;
  BftMinVolumeCount: number | null;
  BftMinVolumeAmount: number | null;
  BftFixedAmount: number;
  BftPercentRate: number;
  BftMinFeeAmount: number | null;
  BftMaxFeeAmount: number | null;
};

@Component({
  selector: 'app-system-mnscloud-pay-fee-plans',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    MnsSelectFieldComponent,
    MnsTextFieldComponent,
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
    MatTabsModule,
    TranslocoPipe,
    NgClass,
  ],
  templateUrl: './fee-plans.html',
  styleUrls: ['./fee-plans.scss'],
  host: { class: 'app-fade-in-host' },
})
export class SystemMnscloudPayFeePlansPage {
  private readonly api = inject(ApiService);
  private readonly snack = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);

  readonly pageTitle = computed(() => 'MNSCloud Pay — Fee Plans');
  readonly pageSubtitle = computed(
    () => 'Standard and custom fee plans charged on settled boleto/Pix transactions.',
  );
  readonly baseEndpoint = '/system/mnscloud-pay/fee-plans';

  private readonly plansResource = resource({
    defaultValue: [] as FeePlan[],
    loader: async () => {
      const result = await this.api.get<any>(this.baseEndpoint);
      return Array.isArray(result?.data?.items) ? result.data.items : [];
    },
  });

  readonly plans = signal<FeePlan[]>([]);
  readonly loadingPlans = this.plansResource.isLoading;
  readonly savingPlan = signal<boolean>(false);
  readonly editingPlan = signal<FeePlan | null>(null);

  readonly transactionTypeOptions = [
    { value: 'boleto', label: 'Boleto' },
    { value: 'pix', label: 'Pix' },
  ];
  readonly yesNoOptions = [
    { value: true, label: 'Yes' },
    { value: false, label: 'No' },
  ] as const;
  readonly activeOptions = [
    { value: true, label: 'Active' },
    { value: false, label: 'Inactive' },
  ] as const;

  readonly planFormModel = signal({
    name: '',
    description: '',
    isDefault: false,
    isActive: true,
  });
  readonly planForm = createForm(this.planFormModel, (schema) => {
    required(schema.name);
  });

  dataSource = new MatTableDataSource<FeePlan>([]);
  displayedColumns: string[] = ['name', 'description', 'default', 'status', 'actions'];
  search = '';
  searchInput = '';

  // Rates/tiers management for the plan currently being edited.
  readonly rates = signal<FeePlanRate[]>([]);
  readonly loadingRates = signal<boolean>(false);
  readonly expandedRateUUID = signal<string | null>(null);
  readonly tiersByRate = signal<Record<string, FeePlanTier[]>>({});
  readonly loadingTiers = signal<boolean>(false);

  readonly rateFormModel = signal({
    transactionType: 'boleto',
    provider: '',
    fixedAmount: '0',
    percentRate: '0',
    minFeeAmount: '',
    maxFeeAmount: '',
    currency: 'BRL',
  });

  readonly tierFormModel = signal({
    minVolumeCount: '',
    minVolumeAmount: '',
    fixedAmount: '0',
    percentRate: '0',
  });

  private readonly syncPlans = effect(() => {
    const normalized = this.plansResource.value();
    this.plans.set(normalized);
    this.dataSource.data = [...normalized];
    this.applyFilter();
  });

  private readonly reportPlansError = effect(() => {
    const error = this.plansResource.error();
    if (error) {
      this.showError(this.friendlyError(error, 'Failed to load fee plans.'));
      this.plans.set([]);
      this.dataSource.data = [];
    }
  });

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly planFormDialog = viewChild<TemplateRef<unknown>>('planFormDialog');
  private planFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;

  private readonly cleanupOnDestroy = inject(DestroyRef).onDestroy(() => {
    this.closePlanDialog();
  });

  private readonly afterViewReady = afterNextRender(() => {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'name':
          return data.BfpName ?? '';
        case 'default':
          return data.BfpIsDefault ?? 0;
        case 'status':
          return data.BfpStatus ?? 0;
        default:
          return '';
      }
    };
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      return [data.BfpName, data.BfpDescription]
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

  planStatusLabel(item: FeePlan) {
    return item.BfpStatus === 1 ? 'Active' : 'Inactive';
  }

  planStatusChipClass(item: FeePlan) {
    return item.BfpStatus === 1 ? 'chip-success' : 'chip-skipped';
  }

  planIsDefault(item: FeePlan) {
    return item.BfpIsDefault === 1;
  }

  openCreateDialog() {
    this.cancelEditPlan();
    this.openPlanDialog();
  }

  openEditDialog(item: FeePlan) {
    this.startEditPlan(item);
    this.openPlanDialog();
  }

  startEditPlan(item: FeePlan) {
    this.editingPlan.set(item);
    this.planFormModel.set({
      name: item.BfpName,
      description: item.BfpDescription ?? '',
      isDefault: item.BfpIsDefault === 1,
      isActive: item.BfpStatus === 1,
    });
    void this.loadRates(item.BfpUUID);
  }

  cancelEditPlan() {
    this.editingPlan.set(null);
    this.planFormModel.set({ name: '', description: '', isDefault: false, isActive: true });
    this.rates.set([]);
    this.tiersByRate.set({});
    this.expandedRateUUID.set(null);
  }

  cancelPlanForm() {
    this.closePlanDialog();
    this.cancelEditPlan();
  }

  async submitPlan() {
    if (!this.planForm().valid()) {
      this.showWarning('Please fill all required fields.');
      return;
    }
    this.savingPlan.set(true);
    const values = this.planFormModel();
    const payload = {
      name: values.name,
      description: values.description || null,
      isDefault: values.isDefault ? 1 : 0,
      status: values.isActive ? 1 : 0,
    };
    try {
      if (this.editingPlan()) {
        await this.api.put(`${this.baseEndpoint}/${this.editingPlan()!.BfpUUID}`, payload);
        this.showSuccess('Fee plan updated.');
      } else {
        const result = await this.api.post<any>(this.baseEndpoint, payload);
        this.showSuccess('Fee plan created.');
        const created = result?.data?.item;
        if (created) {
          this.startEditPlan({
            BfpUUID: created.BfpUUID,
            BfpName: created.BfpName,
            BfpDescription: created.BfpDescription,
            BfpIsDefault: created.BfpIsDefault,
            BfpStatus: created.BfpStatus,
          });
        }
      }
      this.plansResource.reload();
    } catch (error) {
      this.showError(this.friendlyError(error, 'Failed to save fee plan.'));
    } finally {
      this.savingPlan.set(false);
    }
  }

  async deletePlan(item: FeePlan) {
    try {
      await this.api.delete(`${this.baseEndpoint}/${item.BfpUUID}`);
      this.showSuccess('Fee plan deleted.');
      this.plansResource.reload();
    } catch (error) {
      this.showError(this.friendlyError(error, 'Failed to delete fee plan.'));
    }
  }

  // --- Rates ---

  private async loadRates(planUUID: string) {
    this.loadingRates.set(true);
    try {
      const result = await this.api.get<any>(`${this.baseEndpoint}/${planUUID}/rates`);
      this.rates.set(Array.isArray(result?.data?.items) ? result.data.items : []);
    } catch (error) {
      this.showError(this.friendlyError(error, 'Failed to load fee plan rates.'));
      this.rates.set([]);
    } finally {
      this.loadingRates.set(false);
    }
  }

  async addRate() {
    const plan = this.editingPlan();
    if (!plan) return;
    const values = this.rateFormModel();
    const payload = {
      transactionType: values.transactionType,
      provider: values.provider || '',
      fixedAmount: Number(values.fixedAmount || 0),
      percentRate: Number(values.percentRate || 0),
      minFeeAmount: values.minFeeAmount ? Number(values.minFeeAmount) : null,
      maxFeeAmount: values.maxFeeAmount ? Number(values.maxFeeAmount) : null,
      currency: values.currency || null,
    };
    try {
      await this.api.post(`${this.baseEndpoint}/${plan.BfpUUID}/rates`, payload);
      this.showSuccess('Rate added.');
      this.rateFormModel.set({
        transactionType: 'boleto',
        provider: '',
        fixedAmount: '0',
        percentRate: '0',
        minFeeAmount: '',
        maxFeeAmount: '',
        currency: values.currency || 'BRL',
      });
      await this.loadRates(plan.BfpUUID);
    } catch (error) {
      this.showError(this.friendlyError(error, 'Failed to add rate.'));
    }
  }

  async deleteRate(rate: FeePlanRate) {
    const plan = this.editingPlan();
    if (!plan) return;
    try {
      await this.api.delete(`${this.baseEndpoint}/rates/${rate.BfrUUID}`);
      this.showSuccess('Rate deleted.');
      await this.loadRates(plan.BfpUUID);
    } catch (error) {
      this.showError(this.friendlyError(error, 'Failed to delete rate.'));
    }
  }

  rateProviderLabel(rate: FeePlanRate) {
    return rate.BfrProvider ? rate.BfrProvider : 'Any bank';
  }

  // --- Tiers ---

  isRateExpanded(rate: FeePlanRate) {
    return this.expandedRateUUID() === rate.BfrUUID;
  }

  async toggleRateTiers(rate: FeePlanRate) {
    if (this.expandedRateUUID() === rate.BfrUUID) {
      this.expandedRateUUID.set(null);
      return;
    }
    this.expandedRateUUID.set(rate.BfrUUID);
    if (!this.tiersByRate()[rate.BfrUUID]) {
      await this.loadTiers(rate.BfrUUID);
    }
  }

  tiersFor(rate: FeePlanRate): FeePlanTier[] {
    return this.tiersByRate()[rate.BfrUUID] ?? [];
  }

  private async loadTiers(rateUUID: string) {
    this.loadingTiers.set(true);
    try {
      const result = await this.api.get<any>(`${this.baseEndpoint}/rates/${rateUUID}/tiers`);
      const items = Array.isArray(result?.data?.items) ? result.data.items : [];
      this.tiersByRate.update((map) => ({ ...map, [rateUUID]: items }));
    } catch (error) {
      this.showError(this.friendlyError(error, 'Failed to load volume tiers.'));
    } finally {
      this.loadingTiers.set(false);
    }
  }

  async addTier(rate: FeePlanRate) {
    const values = this.tierFormModel();
    if (!values.minVolumeCount && !values.minVolumeAmount) {
      this.showWarning('Inform a volume count or volume amount threshold.');
      return;
    }
    const payload = {
      minVolumeCount: values.minVolumeCount ? Number(values.minVolumeCount) : null,
      minVolumeAmount: values.minVolumeAmount ? Number(values.minVolumeAmount) : null,
      fixedAmount: Number(values.fixedAmount || 0),
      percentRate: Number(values.percentRate || 0),
    };
    try {
      await this.api.post(`${this.baseEndpoint}/rates/${rate.BfrUUID}/tiers`, payload);
      this.showSuccess('Volume tier added.');
      this.tierFormModel.set({
        minVolumeCount: '',
        minVolumeAmount: '',
        fixedAmount: '0',
        percentRate: '0',
      });
      await this.loadTiers(rate.BfrUUID);
    } catch (error) {
      this.showError(this.friendlyError(error, 'Failed to add volume tier.'));
    }
  }

  async deleteTier(rate: FeePlanRate, tier: FeePlanTier) {
    try {
      await this.api.delete(`${this.baseEndpoint}/tiers/${tier.BftUUID}`);
      this.showSuccess('Volume tier deleted.');
      await this.loadTiers(rate.BfrUUID);
    } catch (error) {
      this.showError(this.friendlyError(error, 'Failed to delete volume tier.'));
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

  private openPlanDialog() {
    const planFormDialog = this.planFormDialog();
    if (!planFormDialog || this.planFormDialogRef) return;
    this.dialogBinding = openCrudTemplateDialog(this.dialog, planFormDialog, 'crud-dialog-panel', {
      onEscape: () => this.cancelPlanForm(),
    });
    this.planFormDialogRef = this.dialogBinding.ref;
    bindDialogClosed(this.planFormDialogRef, () => {
      this.dialogBinding?.stop();
      this.dialogBinding = null;
      this.planFormDialogRef = null;
    });
  }

  private closePlanDialog() {
    if (!this.planFormDialogRef) return;
    this.dialogBinding?.stop();
    this.dialogBinding = null;
    this.planFormDialogRef.close();
    this.planFormDialogRef = null;
  }
}
