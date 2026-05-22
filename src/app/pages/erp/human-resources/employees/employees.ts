import {
  AfterViewInit,
  Component,
  OnDestroy,
  TemplateRef,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { fadeIn } from '../../../../shared/animations/fade.animation';
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../shared/dialog/crud-dialog.util';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';

type Employee = {
  EmployeeUUID: string;
  Name: string;
  Email?: string | null;
  Phone?: string | null;
  Document?: string | null;
  HireDate?: string | null;
  TerminationDate?: string | null;
  Status: number;
  Notes?: string | null;
  CompanyUUID?: string | null;
  CompanyName?: string | null;
  DepartmentUUID?: string | null;
  DepartmentName?: string | null;
  PositionUUID?: string | null;
  PositionName?: string | null;
};

type OptionItem = {
  uuid: string;
  name: string;
};

@Component({
  selector: 'app-erp-hr-employees',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
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
    MatTooltipModule,
  ],
  templateUrl: './employees.html',
  styleUrls: ['../shared/human-resources-crud.scss'],
  animations: [fadeIn],
})
export class ErpHumanResourcesEmployeesPage implements AfterViewInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);
  private readonly listLimit = 200;

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly editing = signal<Employee | null>(null);
  readonly searchInput = signal('');
  readonly search = signal('');
  readonly selectedEmployeeUUIDs = signal<Set<string>>(new Set());
  readonly statusFilter = signal<number | null>(null);
  readonly companyFilter = signal('');
  readonly departmentFilter = signal('');
  readonly positionFilter = signal('');

  readonly companySearch = new FormControl('');
  readonly departmentSearch = new FormControl('');
  readonly positionSearch = new FormControl('');
  readonly filterCompanySearch = new FormControl('');
  readonly filterDepartmentSearch = new FormControl('');
  readonly filterPositionSearch = new FormControl('');

  readonly companies = signal<OptionItem[]>([]);
  readonly departments = signal<OptionItem[]>([]);
  readonly positions = signal<OptionItem[]>([]);

  readonly dataSource = new MatTableDataSource<Employee>([]);
  readonly displayedColumns = [
    'select',
    'name',
    'email',
    'phone',
    'company',
    'department',
    'position',
    'status',
    'actions',
  ];

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.email]],
    phone: [''],
    document: [''],
    companyUUID: [''],
    departmentUUID: [''],
    positionUUID: [''],
    hireDate: [''],
    terminationDate: [''],
    status: [1],
    notes: [''],
  });

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild('employeeFormDialog') employeeFormDialog?: TemplateRef<unknown>;

  private dialogBinding: CrudDialogBinding | null = null;

  get selectedCount() {
    return this.selectedEmployeeUUIDs().size;
  }

  get filteredCompanies() {
    return this.filterOptions(this.companies(), this.companySearch.value ?? '');
  }

  get filteredCompaniesForFilter() {
    return this.filterOptions(this.companies(), this.filterCompanySearch.value ?? '');
  }

  get filteredDepartments() {
    return this.filterOptions(this.departments(), this.departmentSearch.value ?? '');
  }

  get filteredDepartmentsForFilter() {
    return this.filterOptions(this.departments(), this.filterDepartmentSearch.value ?? '');
  }

  get filteredPositions() {
    return this.filterOptions(this.positions(), this.positionSearch.value ?? '');
  }

  get filteredPositionsForFilter() {
    return this.filterOptions(this.positions(), this.filterPositionSearch.value ?? '');
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sort = this.sort ?? null;
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'name':
          return data.Name ?? '';
        case 'email':
          return data.Email ?? '';
        case 'phone':
          return data.Phone ?? '';
        case 'company':
          return data.CompanyName ?? '';
        case 'department':
          return data.DepartmentName ?? '';
        case 'position':
          return data.PositionName ?? '';
        case 'status':
          return this.isActive(data) ? 'ACTIVE' : 'INACTIVE';
        default:
          return '';
      }
    };
    setTimeout(() => {
      void this.loadReferences();
      void this.loadEmployees();
    }, 0);
  }

  ngOnDestroy() {
    this.closeEmployeeDialog();
  }

  applySearchFilters() {
    this.search.set(this.searchInput().trim());
    void this.loadEmployees();
  }

  clearSearchFilters() {
    this.searchInput.set('');
    this.search.set('');
    this.statusFilter.set(null);
    this.companyFilter.set('');
    this.departmentFilter.set('');
    this.positionFilter.set('');
    void this.loadEmployees();
  }

  refreshList() {
    void this.loadEmployees();
  }

  async loadReferences() {
    try {
      const [companies, departments, positions] = await Promise.all([
        this.api.get<any>('erp/companies?limit=200'),
        this.api.get<any>('erp/human-resources/departments?limit=200'),
        this.api.get<any>('erp/human-resources/positions?limit=200'),
      ]);
      this.companies.set(
        (companies?.data?.items ?? []).map((item: any) => ({
          uuid: item.CompanyUUID,
          name: item.Name,
        })),
      );
      this.departments.set(
        (departments?.data?.items ?? []).map((item: any) => ({
          uuid: item.DepartmentUUID,
          name: item.Name,
        })),
      );
      this.positions.set(
        (positions?.data?.items ?? []).map((item: any) => ({
          uuid: item.PositionUUID,
          name: item.Name,
        })),
      );
    } catch (err: any) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to load form references.'));
    }
  }

  async loadEmployees() {
    this.loading.set(true);
    const start = performance.now();
    try {
      const params = new URLSearchParams();
      params.set('limit', String(this.listLimit));
      if (this.search()) params.set('q', this.search());
      if (this.statusFilter() !== null) params.set('status', String(this.statusFilter()));
      if (this.companyFilter()) params.set('companyUUID', this.companyFilter());
      if (this.departmentFilter()) params.set('departmentUUID', this.departmentFilter());
      if (this.positionFilter()) params.set('positionUUID', this.positionFilter());
      const response = await this.api.get<any>(
        `erp/human-resources/employees?${params.toString()}`,
      );
      this.dataSource.data = response?.data?.items ?? [];
      this.reconcileSelection();
    } catch (err: any) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to load employees.'));
      this.dataSource.data = [];
      this.reconcileSelection();
    } finally {
      const elapsed = performance.now() - start;
      const waitMs = Math.max(0, 600 - elapsed);
      if (waitMs) setTimeout(() => this.loading.set(false), waitMs);
      else this.loading.set(false);
    }
  }

  startCreate() {
    this.editing.set(null);
    this.form.reset({
      name: '',
      email: '',
      phone: '',
      document: '',
      companyUUID: '',
      departmentUUID: '',
      positionUUID: '',
      hireDate: '',
      terminationDate: '',
      status: 1,
      notes: '',
    });
    this.openEmployeeDialog();
  }

  startEdit(employee: Employee) {
    this.editing.set(employee);
    this.form.reset({
      name: employee.Name ?? '',
      email: employee.Email ?? '',
      phone: employee.Phone ?? '',
      document: employee.Document ?? '',
      companyUUID: employee.CompanyUUID ?? '',
      departmentUUID: employee.DepartmentUUID ?? '',
      positionUUID: employee.PositionUUID ?? '',
      hireDate: this.toDateInput(employee.HireDate),
      terminationDate: this.toDateInput(employee.TerminationDate),
      status: Number(employee.Status) || 1,
      notes: employee.Notes ?? '',
    });
    this.openEmployeeDialog();
  }

  async saveEmployee(saveAndNew = false) {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const payload = {
      name: value.name.trim(),
      email: value.email.trim() || null,
      phone: value.phone.trim() || null,
      document: value.document.trim() || null,
      companyUUID: value.companyUUID || null,
      departmentUUID: value.departmentUUID || null,
      positionUUID: value.positionUUID || null,
      hireDate: value.hireDate || null,
      terminationDate: value.terminationDate || null,
      status: value.status,
      notes: value.notes.trim() || null,
    };
    const createMode = !this.editing();
    this.saving.set(true);
    try {
      const editing = this.editing();
      if (editing) {
        await this.api.put(`erp/human-resources/employees/${editing.EmployeeUUID}`, payload);
        this.snack.success('Employee updated successfully.');
      } else {
        await this.api.post('erp/human-resources/employees', payload);
        this.snack.success('Employee created successfully.');
      }
      await this.loadEmployees();
      if (saveAndNew && createMode) {
        this.startCreate();
        return;
      }
      this.closeEmployeeDialog();
      this.editing.set(null);
    } catch (err: any) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to save employee.'));
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNewEmployee() {
    void this.saveEmployee(true);
  }

  cancelForm() {
    this.closeEmployeeDialog();
    this.editing.set(null);
  }

  async deleteEmployee(employee: Employee) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete employee',
        message: `Are you sure you want to delete ${employee.Name}?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;
    try {
      await this.api.delete(`erp/human-resources/employees/${employee.EmployeeUUID}`);
      this.snack.success('Employee deleted successfully.');
      await this.loadEmployees();
    } catch (err: any) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to delete employee.'));
    }
  }

  async deleteSelectedEmployees() {
    const ids = Array.from(this.selectedEmployeeUUIDs());
    if (!ids.length) return;
    const labels = this.dataSource.data
      .filter((item) => ids.includes(item.EmployeeUUID))
      .slice(0, 3)
      .map((item) => item.Name)
      .join(', ');
    const suffix = labels ? ` Selected: ${labels}${ids.length > 3 ? ', ...' : ''}.` : '';
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete selected employees',
        message: `Are you sure you want to delete ${ids.length} selected employee(s)?${suffix}`,
        confirmLabel: 'Delete selected',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.loading.set(true);
    try {
      const response = await this.api.delete<any>('erp/human-resources/employees/bulk', { ids });
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      const failed = new Set<string>(
        (response?.data?.failed ?? [])
          .map((item: any) => item.EmployeeUUID)
          .filter((uuid: string | null): uuid is string => !!uuid),
      );
      this.dataSource.data = this.dataSource.data.filter((row) => !deleted.has(row.EmployeeUUID));
      this.selectedEmployeeUUIDs.set(failed);
      if (failed.size) {
        this.snack.error(`${failed.size} selected employee(s) could not be deleted.`);
      } else {
        this.snack.success(`${deleted.size || ids.length} selected employee(s) deleted.`);
      }
      await this.loadEmployees();
    } catch (err: any) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to delete selected employees.'));
    } finally {
      this.loading.set(false);
    }
  }

  onReferenceOpened(opened: boolean, control: FormControl<string | null>) {
    if (!opened) control.setValue('');
  }

  isActive(employee: Employee) {
    const status = String(employee.Status ?? '').toLowerCase();
    return status === '1' || status === 'active';
  }

  isSelected(employee: Employee) {
    return this.selectedEmployeeUUIDs().has(employee.EmployeeUUID);
  }

  toggleEmployeeSelection(employee: Employee, selected: boolean) {
    this.selectedEmployeeUUIDs.update((current) => {
      const next = new Set(current);
      if (selected) next.add(employee.EmployeeUUID);
      else next.delete(employee.EmployeeUUID);
      return next;
    });
  }

  visibleRows() {
    const rows = this.dataSource.filteredData?.length
      ? this.dataSource.filteredData
      : this.dataSource.data;
    if (!this.paginator) return rows;
    const start = this.paginator.pageIndex * this.paginator.pageSize;
    return rows.slice(start, start + this.paginator.pageSize);
  }

  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return (
      rows.length > 0 && rows.every((row) => this.selectedEmployeeUUIDs().has(row.EmployeeUUID))
    );
  }

  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    const selected = rows.filter((row) =>
      this.selectedEmployeeUUIDs().has(row.EmployeeUUID),
    ).length;
    return selected > 0 && selected < rows.length;
  }

  toggleVisibleSelection(selected: boolean) {
    const rows = this.visibleRows();
    this.selectedEmployeeUUIDs.update((current) => {
      const next = new Set(current);
      rows.forEach((row) => {
        if (selected) next.add(row.EmployeeUUID);
        else next.delete(row.EmployeeUUID);
      });
      return next;
    });
  }

  private filterOptions(options: OptionItem[], term: string) {
    const value = term.trim().toLowerCase();
    if (!value) return options;
    return options.filter((option) => option.name.toLowerCase().includes(value));
  }

  private openEmployeeDialog() {
    if (!this.employeeFormDialog || this.dialogBinding) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      this.employeeFormDialog,
      'crud-form-dialog',
      { onEscape: () => this.cancelForm() },
    );
    this.dialogBinding.ref.afterClosed().subscribe(() => {
      this.dialogBinding?.stop();
      this.dialogBinding = null;
    });
  }

  private closeEmployeeDialog() {
    if (!this.dialogBinding) return;
    this.dialogBinding.ref.close();
    this.dialogBinding.stop();
    this.dialogBinding = null;
  }

  private toDateInput(value?: string | null) {
    return value ? value.slice(0, 10) : '';
  }

  private extractErrorMessage(err: any, fallback: string) {
    return err?.error?.error || err?.error?.message || err?.message || fallback;
  }

  private reconcileSelection() {
    const available = new Set(this.dataSource.data.map((item) => item.EmployeeUUID));
    this.selectedEmployeeUUIDs.update((current) => {
      const next = new Set<string>();
      current.forEach((uuid) => {
        if (available.has(uuid)) next.add(uuid);
      });
      return next;
    });
  }
}
