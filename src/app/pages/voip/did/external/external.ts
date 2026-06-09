import {
  AfterViewInit,
  Component,
  OnDestroy,
  TemplateRef,
  inject,
  signal,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
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
import { fadeIn } from '../../../../shared/animations/fade.animation';
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../shared/dialog/crud-dialog.util';
import { SnackbarService } from '../../../../services/snackbar.service';
import { VoipDidExternalItem, VoipDidExternalService } from './external.service';

@Component({
  selector: 'app-voip-did-external',
  standalone: true,
  imports: [
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
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    NgClass,
  ],
  templateUrl: './external.html',
  styleUrls: ['./external.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [fadeIn],
})
export class VoipDidExternalPage implements AfterViewInit, OnDestroy {
  private readonly api = inject(VoipDidExternalService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);

  readonly isMasterScope = signal(false);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly editing = signal<VoipDidExternalItem | null>(null);
  readonly dataSource = new MatTableDataSource<VoipDidExternalItem>([]);
  readonly displayedColumns = ['number', 'provider', 'validation', 'billing', 'tenant', 'actions'];
  searchInput = '';
  search = '';

  readonly form = this.fb.nonNullable.group({
    number: ['', [Validators.required, Validators.pattern(/^\d{8,15}$/)]],
    providerName: ['', [Validators.required]],
    providerAccount: [''],
    allowedSources: [''],
    billingAmount: [0],
    billingCurrency: ['BRL'],
    billingInterval: ['MONTHLY'],
    notes: [''],
  });

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly externalFormDialog = viewChild<TemplateRef<unknown>>('externalFormDialog');
  private dialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;

  async ngAfterViewInit() {
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
    setTimeout(() => void this.loadItems(), 0);
  }

  ngOnDestroy() {
    this.closeDialog();
  }

  async loadItems() {
    this.loading.set(true);
    try {
      const response = await this.api.list(
        { search: this.search, limit: 5000 },
        this.isMasterScope(),
      );
      this.dataSource.data = response?.data?.items ?? [];
    } catch (error) {
      this.snack.error(error instanceof Error ? error.message : 'Failed to load external DIDs.');
    } finally {
      this.loading.set(false);
    }
  }

  applySearchFilters() {
    this.search = this.searchInput.trim();
    void this.loadItems();
  }

  clearSearchFilters() {
    this.searchInput = '';
    this.search = '';
    void this.loadItems();
  }

  startCreate() {
    if (this.isMasterScope()) return;
    this.editing.set(null);
    this.form.reset({
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
    this.form.reset({
      number: item.VddNumber,
      providerName: item.VddExternalProviderName ?? '',
      providerAccount: item.VddExternalProviderAccount ?? '',
      allowedSources: item.VddExternalAllowedSources ?? '',
      billingAmount: Number(item.VddBillingAmount ?? 0),
      billingCurrency: item.VddBillingCurrency ?? 'BRL',
      billingInterval: item.VddBillingInterval ?? 'MONTHLY',
      notes: item.VddExternalRoutingInstructions ?? '',
    });
    this.form.controls.number.disable();
    this.openDialog();
  }

  async save(closeAfterSave = true) {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const raw = this.form.getRawValue();
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
      await this.loadItems();
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
      await this.loadItems();
    } catch (error) {
      this.snack.error(error instanceof Error ? error.message : 'Failed to start validation.');
    }
  }

  async setStatus(item: VoipDidExternalItem, validationStatus: string, billingStatus?: string) {
    try {
      await this.api.setStatus(item.VddUUID, { validationStatus, billingStatus });
      this.snack.success('External DID status updated.');
      await this.loadItems();
    } catch (error) {
      this.snack.error(error instanceof Error ? error.message : 'Failed to update status.');
    }
  }

  async remove(item: VoipDidExternalItem) {
    try {
      await this.api.remove(item.VddUUID, this.isMasterScope());
      this.snack.success('External DID removed.');
      await this.loadItems();
    } catch (error) {
      this.snack.error(error instanceof Error ? error.message : 'Failed to remove external DID.');
    }
  }

  validationClass(item: VoipDidExternalItem) {
    return `status-${String(item.VddValidationStatus ?? '').toLowerCase()}`;
  }

  private openDialog() {
    this.form.controls.number.enable();
    if (this.editing()) this.form.controls.number.disable();
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
}
