import {
  Component,
  DestroyRef,
  afterNextRender,
  effect,
  resource,
  TemplateRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';

import { FormField, form as createForm, required } from '@angular/forms/signals';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { firstValueFrom, takeUntil } from 'rxjs';

import { ApiService } from '../../../services/api.service';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../shared/refresh-button/refresh-button';

type UnitItem = {
  SunUUID: string;
  SunID: string;
  SunCode: string;
  SunName: string;
  SunDateCreated: string | null;
  SunDateUpdated: string | null;
};

type UnitFilters = {
  code: string;
  name: string;
};

@Component({
  selector: 'app-sale-unit',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    FormField,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatPaginatorModule,
    MatTooltipModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    TranslocoPipe,
  ],
  templateUrl: './unit.html',
  styleUrls: ['./unit.scss'],
})
export class SaleUnitPage {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly units = signal<UnitItem[]>([]);
  readonly editing = signal<UnitItem | null>(null);
  readonly filterFormModel = signal({ code: '', name: '' });
  readonly filterForm = createForm(this.filterFormModel);
  private readonly unitsResource = resource({
    defaultValue: [] as UnitItem[],
    params: (): UnitFilters => ({
      code: this.filterFormModel().code.trim(),
      name: this.filterFormModel().name.trim(),
    }),
    loader: ({ params }) => this.fetchUnits(params),
  });
  readonly loading = this.unitsResource.isLoading;

  readonly unitFormModel = signal({ code: '', name: '' });
  readonly unitForm = createForm(this.unitFormModel, (path) => {
    required(path.code);
    required(path.name);
  });

  readonly displayedColumns = ['code', 'name', 'actions'];
  readonly dataSource = new MatTableDataSource<UnitItem>([]);
  readonly paginator = viewChild(MatPaginator);
  readonly unitFormDialog = viewChild<TemplateRef<unknown>>('unitFormDialog');
  private unitFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;
  private readonly syncUnits = effect(() => {
    const items = this.unitsResource.value();
    this.units.set(items);
    this.dataSource.data = [...items];
  });
  private readonly reportUnitsError = effect(() => {
    const error = this.unitsResource.error();
    if (error) {
      this.error.set(this.extractErrorMessage(error, 'Failed to load units.'));
      this.dataSource.data = [];
    }
  });

  private readonly setupTable = afterNextRender(() => {
    this.dataSource.paginator = this.paginator() ?? null;
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.closeUnitDialog());
  }

  private async fetchUnits(filters: UnitFilters) {
    this.error.set(null);

    const params = new URLSearchParams();
    if (filters.code) params.set('code', filters.code);
    if (filters.name) params.set('name', filters.name);

    const response = await this.api.get<any>(`sale/units?${params.toString()}`);
    return response?.data?.items ?? [];
  }

  applyFilters() {
    this.unitsResource.reload();
  }

  clearFilters() {
    this.filterFormModel.set({ code: '', name: '' });
    this.unitsResource.reload();
  }

  refreshList() {
    this.unitsResource.reload();
  }

  startEdit(unit: UnitItem) {
    this.editing.set(unit);
    this.unitFormModel.set({ code: unit.SunCode, name: unit.SunName });
  }

  openCreateDialog() {
    this.cancelEdit();
    this.openUnitDialog();
  }

  openEditDialog(unit: UnitItem) {
    this.startEdit(unit);
    this.openUnitDialog();
  }

  cancelEdit() {
    this.editing.set(null);
    this.unitFormModel.set({ code: '', name: '' });
    this.closeUnitDialog();
  }

  async saveUnit() {
    if (!this.unitForm().valid()) return;

    const payload = {
      code: this.unitFormModel().code.trim(),
      name: this.unitFormModel().name.trim(),
    };
    if (!payload.code || !payload.name) return;

    this.saving.set(true);
    this.error.set(null);

    try {
      const editing = this.editing();
      if (editing) {
        await this.api.put<any>(`sale/units/${editing.SunUUID}`, payload);
      } else {
        await this.api.post<any>('sale/units', payload);
      }

      this.cancelEdit();
      this.unitsResource.reload();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to save unit.'));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteUnit(unit: UnitItem) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete unit',
        message: 'Are you sure you want to delete this unit?',
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.delete(`sale/units/${unit.SunUUID}`);
      this.unitsResource.reload();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to delete unit.'));
    }
  }

  private openUnitDialog() {
    const unitFormDialog = this.unitFormDialog();
    if (!unitFormDialog || this.unitFormDialogRef) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      unitFormDialog,
      'sale-unit-form-dialog',
    );
    this.unitFormDialogRef = this.dialogBinding.ref;
    this.unitFormDialogRef
      .keydownEvents()
      .pipe(takeUntil(this.unitFormDialogRef.afterClosed()))
      .subscribe((event: KeyboardEvent) => {
        if (event.key === 'Escape') this.cancelEdit();
      });
  }

  private closeUnitDialog() {
    this.dialogBinding?.stop();
    this.dialogBinding = null;
    this.unitFormDialogRef?.close();
    this.unitFormDialogRef = null;
  }

  private extractErrorMessage(err: any, fallback: string) {
    return err?.error?.error || err?.error?.message || err?.message || fallback;
  }
}
