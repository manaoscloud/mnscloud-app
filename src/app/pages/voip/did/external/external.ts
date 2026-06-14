import {
  Component,
  TemplateRef,
  effect,
  inject,
  resource,
  signal,
  viewChild,
  afterNextRender,
  DestroyRef,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormField, form as createForm, pattern, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../shared/dialog/crud-dialog.util';
import { SnackbarService } from '../../../../services/snackbar.service';
import { VoipDidExternalItem, VoipDidExternalService } from './external.service';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';

type ExternalDidFormModel = {
  number: string;
  providerName: string;
  providerAccount: string;
  allowedSources: string;
  billingAmount: number;
  billingCurrency: string;
  billingInterval: string;
  notes: string;
};

@Component({
  selector: 'app-voip-did-external',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    FormField,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    TranslocoPipe,
    NgClass,
  ],
  templateUrl: './external.html',
  styleUrls: ['./external.scss'],
})
export class VoipDidExternalPage {
  private readonly api = inject(VoipDidExternalService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);

  readonly isMasterScope = signal(false);
  readonly saving = signal(false);
  readonly editing = signal<VoipDidExternalItem | null>(null);
  readonly dataSource = new MatTableDataSource<VoipDidExternalItem>([]);
  readonly displayedColumns = ['number', 'provider', 'validation', 'billing', 'tenant', 'actions'];
  private readonly appliedSearch = signal('');
  readonly searchInput = signal('');
  search = '';

  private readonly externalDidsResource = resource({
    params: () => ({
      search: this.appliedSearch(),
      isMasterScope: this.isMasterScope(),
    }),
    defaultValue: [] as VoipDidExternalItem[],
    loader: async ({ params }) => {
      const response = await this.api.list(
        { search: params.search, limit: 5000 },
        params.isMasterScope,
      );
      return response?.data?.items ?? [];
    },
  });

  readonly loading = this.externalDidsResource.isLoading;

  private readonly syncTableData = effect(() => {
    this.dataSource.data = this.externalDidsResource.value();
  });

  private readonly reportLoadError = effect(() => {
    const error = this.externalDidsResource.error();
    if (!error) return;
    this.snack.error(this.errorMessage(error, 'Failed to load external DIDs.'));
  });

  readonly formModel = signal<ExternalDidFormModel>({
    number: '',
    providerName: '',
    providerAccount: '',
    allowedSources: '',
    billingAmount: 0,
    billingCurrency: 'BRL',
    billingInterval: 'MONTHLY',
    notes: '',
  });

  readonly form = createForm(this.formModel, (schema) => {
    required(schema.number);
    pattern(schema.number, /^\d{8,15}$/);
    required(schema.providerName);
  });

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly externalFormDialog = viewChild<TemplateRef<unknown>>('externalFormDialog');
  private dialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;

  private readonly afterViewReady = afterNextRender(async () => {
    this.isMasterScope.set(this.route.snapshot.data['scope'] === 'master');
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.sortingDataAccessor = (row, column) => {
      switch (column) {
        case 'number':
          return row.VddNumber ?? '';
        case 'provider':
          return row.VddExternalProviderName ?? '';
        case 'validation':
          return row.VddValidationStatus ?? '';
        case 'billing':
          return row.VddBillingStatus ?? '';
        case 'tenant':
          return row.TenantName ?? '';
        default:
          return '';
      }
    };
  });

  private readonly cleanupOnDestroy = inject(DestroyRef).onDestroy(() => {
    this.closeDialog();
  });

  refreshList() {
    this.externalDidsResource.reload();
  }

  applySearchFilters() {
    this.search = this.searchInput().trim();
    this.appliedSearch.set(this.search);
  }

  clearSearchFilters() {
    this.searchInput.set('');
    this.search = '';
    this.appliedSearch.set('');
  }

  startCreate() {
    if (this.isMasterScope()) return;
    this.editing.set(null);
    this.formModel.set({
      number: '',
      providerName: '',
      providerAccount: '',
      allowedSources: '',
      billingAmount: 0,
      billingCurrency: 'BRL',
      billingInterval: 'MONTHLY',
      notes: '',
    });
    this.openDialog();
  }

  startEdit(item: VoipDidExternalItem) {
    if (this.isMasterScope()) return;
    this.editing.set(item);
    this.formModel.set({
      number: item.VddNumber,
      providerName: item.VddExternalProviderName ?? '',
      providerAccount: item.VddExternalProviderAccount ?? '',
      allowedSources: item.VddExternalAllowedSources ?? '',
      billingAmount: Number(item.VddBillingAmount ?? 0),
      billingCurrency: item.VddBillingCurrency ?? 'BRL',
      billingInterval: item.VddBillingInterval ?? 'MONTHLY',
      notes: item.VddExternalRoutingInstructions ?? '',
    });
    this.openDialog();
  }

  async save(closeAfterSave = true) {
    if (!this.form().valid()) return;
    this.saving.set(true);
    const raw = this.formModel();
    const payload = {
      number: raw.number,
      providerName: raw.providerName,
      providerAccount: raw.providerAccount || null,
      allowedSources: raw.allowedSources || null,
      billingAmount: Number(raw.billingAmount ?? 0),
      billingCurrency: raw.billingCurrency || 'BRL',
      billingInterval: raw.billingInterval || 'MONTHLY',
      notes: raw.notes || null,
    };
    try {
      const current = this.editing();
      if (current) {
        await this.api.update(current.VddUUID, payload);
        this.snack.success('External DID updated.');
      } else {
        await this.api.create(payload);
        this.snack.success('External DID created.');
      }
      this.externalDidsResource.reload();
      if (closeAfterSave) this.closeDialog();
    } catch (error) {
      this.snack.error(error instanceof Error ? error.message : 'Failed to save external DID.');
    } finally {
      this.saving.set(false);
    }
  }

  async startValidation(item: VoipDidExternalItem) {
    try {
      await this.api.startValidation(item.VddUUID, {
        expectedSource: item.VddExternalAllowedSources ?? undefined,
      });
      this.snack.success('Validation restarted.');
      this.externalDidsResource.reload();
    } catch (error) {
      this.snack.error(error instanceof Error ? error.message : 'Failed to start validation.');
    }
  }

  async setStatus(item: VoipDidExternalItem, validationStatus: string, billingStatus?: string) {
    try {
      await this.api.setStatus(item.VddUUID, { validationStatus, billingStatus });
      this.snack.success('External DID status updated.');
      this.externalDidsResource.reload();
    } catch (error) {
      this.snack.error(error instanceof Error ? error.message : 'Failed to update status.');
    }
  }

  async remove(item: VoipDidExternalItem) {
    try {
      await this.api.remove(item.VddUUID, this.isMasterScope());
      this.snack.success('External DID removed.');
      this.externalDidsResource.reload();
    } catch (error) {
      this.snack.error(error instanceof Error ? error.message : 'Failed to remove external DID.');
    }
  }

  validationClass(item: VoipDidExternalItem) {
    return `status-${String(item.VddValidationStatus ?? '').toLowerCase()}`;
  }

  private openDialog() {
    const externalFormDialog = this.externalFormDialog();
    if (!externalFormDialog || this.dialogRef) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      externalFormDialog,
      'voip-did-external-form-dialog',
    );
    this.dialogRef = this.dialogBinding.ref;
  }

  private closeDialog() {
    this.dialogBinding?.stop();
    this.dialogBinding = null;
    this.dialogRef?.close();
    this.dialogRef = null;
  }

  private errorMessage(error: unknown, fallback: string) {
    if (error instanceof Error) return error.message;
    const maybe = error as { error?: { error?: string }; message?: string };
    return maybe?.error?.error || maybe?.message || fallback;
  }
}
