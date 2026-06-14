import {
  Component,
  TemplateRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  ChangeDetectionStrategy,
  viewChild,
  afterNextRender,
  DestroyRef,
} from '@angular/core';
import { FormField, email, form as createForm, minLength, required } from '@angular/forms/signals';

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
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../shared/dialog/crud-dialog.util';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';

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

type EmployeeListParams = {
  search: string;
  status: number | null;
  companyUUID: string;
  departmentUUID: string;
  positionUUID: string;
};

type EmployeeFormModel = {
  name: string;
  email: string;
  phone: string;
  document: string;
  companyUUID: string;
  departmentUUID: string;
  positionUUID: string;
  hireDate: string;
  terminationDate: string;
  status: number;
  notes: string;
};

@Component({
  selector: 'app-erp-hr-employees',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    FormField,
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
    TranslocoPipe,
    MatTooltipModule,
  ],
  templateUrl: './employees.html',
  styleUrls: ['../shared/human-resources-crud.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpHumanResourcesEmployeesPage {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);
  private readonly listLimit = 200;

  readonly saving = signal(false);
  readonly editing = signal<Employee | null>(null);
  readonly searchInput = signal('');
  readonly search = signal('');
  readonly selectedEmployeeUUIDs = signal<Set<string>>(new Set());
  readonly statusFilter = signal<number | null>(null);
  readonly companyFilter = signal('');
  readonly departmentFilter = signal('');
  readonly positionFilter = signal('');
  private readonly mutating = signal(false);
  private readonly employeeListParams = signal<EmployeeListParams>({
    search: '',
    status: null,
    companyUUID: '',
    departmentUUID: '',
    positionUUID: '',
  });
  private readonly employeesResource = resource({
    params: () => this.employeeListParams(),
    defaultValue: [] as Employee[],
    loader: ({ params }) => this.fetchEmployees(params),
  });
  readonly loading = computed(() => this.employeesResource.isLoading() || this.mutating());

  readonly companySearch = signal('');
  readonly departmentSearch = signal('');
  readonly positionSearch = signal('');
  readonly filterCompanySearch = signal('');
  readonly filterDepartmentSearch = signal('');
  readonly filterPositionSearch = signal('');

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

  readonly formModel = signal<EmployeeFormModel>(this.emptyForm());
  readonly form = createForm(this.formModel, (schema) => {
    required(schema.name);
    minLength(schema.name, 2);
    email(schema.email);
    required(schema.status);
  });

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly employeeFormDialog = viewChild<TemplateRef<unknown>>('employeeFormDialog');

  private dialogBinding: CrudDialogBinding | null = null;
  private lastLoadError = '';
  private readonly syncEmployees = effect(() => {
    this.dataSource.data = this.employeesResource.value();
    this.reconcileSelection();
  });
  private readonly reportEmployeesError = effect(() => {
    const error = this.employeesResource.error();
    if (!error) {
      this.lastLoadError = '';
      return;
    }
    const message = this.extractErrorMessage(error, 'Failed to load employees.');
    if (message !== this.lastLoadError) {
      this.lastLoadError = message;
      this.snack.error(message);
    }
    this.dataSource.data = [];
    this.reconcileSelection();
  });

  get selectedCount() {
    return this.selectedEmployeeUUIDs().size;
  }

  get filteredCompanies() {
    return this.filterOptions(this.companies(), this.companySearch());
  }

  get filteredCompaniesForFilter() {
    return this.filterOptions(this.companies(), this.filterCompanySearch());
  }

  get filteredDepartments() {
    return this.filterOptions(this.departments(), this.departmentSearch());
  }

  get filteredDepartmentsForFilter() {
    return this.filterOptions(this.departments(), this.filterDepartmentSearch());
  }

  get filteredPositions() {
    return this.filterOptions(this.positions(), this.positionSearch());
  }

  get filteredPositionsForFilter() {
    return this.filterOptions(this.positions(), this.filterPositionSearch());
  }

  private readonly afterViewReady = afterNextRender(() => {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
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
    void this.fetchReferences();
  });

  private readonly cleanupOnDestroy = inject(DestroyRef).onDestroy(() => {
    this.closeEmployeeDialog();
  });

  applySearchFilters() {
    this.search.set(this.searchInput().trim());
    this.employeeListParams.set({
      search: this.search(),
      status: this.statusFilter(),
      companyUUID: this.companyFilter(),
      departmentUUID: this.departmentFilter(),
      positionUUID: this.positionFilter(),
    });
  }

  clearSearchFilters() {
    this.searchInput.set('');
    this.search.set('');
    this.statusFilter.set(null);
    this.companyFilter.set('');
    this.departmentFilter.set('');
    this.positionFilter.set('');
    this.employeeListParams.set({
      search: '',
      status: null,
      companyUUID: '',
      departmentUUID: '',
      positionUUID: '',
    });
  }

  refreshList() {
    this.employeesResource.reload();
  }

  async fetchReferences() {
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

  private async fetchEmployees(paramsValue: EmployeeListParams) {
    const params = new URLSearchParams();
    params.set('limit', String(this.listLimit));
    if (paramsValue.search) params.set('q', paramsValue.search);
    if (paramsValue.status !== null) params.set('status', String(paramsValue.status));
    if (paramsValue.companyUUID) params.set('companyUUID', paramsValue.companyUUID);
    if (paramsValue.departmentUUID) params.set('departmentUUID', paramsValue.departmentUUID);
    if (paramsValue.positionUUID) params.set('positionUUID', paramsValue.positionUUID);
    const response = await this.api.get<any>(`erp/human-resources/employees?${params.toString()}`);
    return response?.data?.items ?? [];
  }

  startCreate() {
    this.editing.set(null);
    this.formModel.set(this.emptyForm());
    this.openEmployeeDialog();
  }

  startEdit(employee: Employee) {
    this.editing.set(employee);
    this.formModel.set({
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
    if (!this.form().valid()) return;
    const value = this.formModel();
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
      this.employeesResource.reload();
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
      this.employeesResource.reload();
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

    this.mutating.set(true);
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
      this.employeesResource.reload();
    } catch (err: any) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to delete selected employees.'));
    } finally {
      this.mutating.set(false);
    }
  }

  onReferenceOpened(opened: boolean, search: { set(value: string): void }) {
    if (!opened) search.set('');
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
    const paginator = this.paginator();
    if (!paginator) return rows;
    const start = paginator.pageIndex * paginator.pageSize;
    return rows.slice(start, start + paginator.pageSize);
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
    const employeeFormDialog = this.employeeFormDialog();
    if (!employeeFormDialog || this.dialogBinding) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      employeeFormDialog,
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

  private emptyForm(): EmployeeFormModel {
    return {
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
    };
  }
}
