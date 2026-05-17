import { AfterViewInit, Component, OnDestroy, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

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
import { firstValueFrom } from 'rxjs';

import { fadeIn } from '../../../shared/animations/fade.animation';
import { ApiService } from '../../../services/api.service';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';

type UnitItem = {
  SunUUID: string;
  SunID: string;
  SunCode: string;
  SunName: string;
  SunDateCreated: string | null;
  SunDateUpdated: string | null;
};

@Component({
  selector: 'app-sale-unit',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
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
  ],
  templateUrl: './unit.html',
  styleUrls: ['./unit.scss'],
  animations: [fadeIn],
})
export class SaleUnitPage implements AfterViewInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly units = signal<UnitItem[]>([]);
  readonly editing = signal<UnitItem | null>(null);

  readonly filterForm = this.fb.nonNullable.group({
    code: [''],
    name: [''],
  });

  readonly unitForm = this.fb.nonNullable.group({
    code: ['', [Validators.required]],
    name: ['', [Validators.required]],
  });

  readonly displayedColumns = ['code', 'name', 'actions'];
  readonly dataSource = new MatTableDataSource<UnitItem>([]);
  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild('unitFormDialog') unitFormDialog?: TemplateRef<unknown>;
  private unitFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;

  ngOnInit() {
    this.loadUnits();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator ?? null;
  }

  async loadUnits() {
    this.loading.set(true);
    this.error.set(null);
    const start = performance.now();

    const { code, name } = this.filterForm.getRawValue();
    const params = new URLSearchParams();
    if (code?.trim()) params.set('code', code.trim());
    if (name?.trim()) params.set('name', name.trim());

    try {
      const response = await this.api.get<any>(`sale/units?${params.toString()}`);
      const items = response?.data?.items ?? [];
      this.units.set(items);
      this.dataSource.data = [...items];
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to load units.'));
    } finally {
      const elapsed = performance.now() - start;
      const waitMs = Math.max(0, 600 - elapsed);
      if (waitMs) {
        setTimeout(() => this.loading.set(false), waitMs);
      } else {
        this.loading.set(false);
      }
    }
  }

  applyFilters() {
    void this.loadUnits();
  }

  clearFilters() {
    this.filterForm.reset({ code: '', name: '' });
    void this.loadUnits();
  }

  refreshList() {
    void this.loadUnits();
  }

  startEdit(unit: UnitItem) {
    this.editing.set(unit);
    this.unitForm.reset({ code: unit.SunCode, name: unit.SunName });
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
    this.unitForm.reset({ code: '', name: '' });
    this.closeUnitDialog();
  }

  async saveUnit() {
    if (this.unitForm.invalid) return;

    const payload = {
      code: this.unitForm.getRawValue().code.trim(),
      name: this.unitForm.getRawValue().name.trim(),
    };
    if (!payload.code || !payload.name) return;

    this.saving.set(true);
    this.error.set(null);

    try {
      const editing = this.editing();
      if (editing) {
        const response = await this.api.put<any>(`sale/units/${editing.SunUUID}`, payload);
        const item = response?.data?.item ?? null;
        if (item) {
          this.units.update((items) => items.map((row) => (row.SunUUID === item.SunUUID ? item : row)));
          this.dataSource.data = [...this.units()];
        }
      } else {
        const response = await this.api.post<any>('sale/units', payload);
        const item = response?.data?.item ?? null;
        if (item) {
          this.units.update((items) => [item, ...items]);
          this.dataSource.data = [...this.units()];
        }
      }

      this.cancelEdit();
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
      this.units.update((items) => items.filter((row) => row.SunUUID !== unit.SunUUID));
      this.dataSource.data = [...this.units()];
    } catch (err) {
      console.error('Failed to delete unit.', err);
      alert('Failed to delete unit.');
    }
  }

  ngOnDestroy() {
    this.closeUnitDialog();
  }

  private openUnitDialog() {
    if (!this.unitFormDialog || this.unitFormDialogRef) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      this.unitFormDialog,
      'sale-unit-form-dialog',
    );
    this.unitFormDialogRef = this.dialogBinding.ref;
    this.unitFormDialogRef.keydownEvents().subscribe((event: KeyboardEvent) => {
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
