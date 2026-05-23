import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  TemplateRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { fadeIn } from '../../../../shared/animations/fade.animation';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { VoipPabxExtensionItem, VoipPabxExtensionService } from '../extension/extension.service';
import { VoipPabxQueueAgentItem, VoipPabxQueueAgentService } from './queue-agent.service';

type EmployeeOption = {
  uuid: string;
  label: string;
  email?: string | null;
};

type ExtensionOption = {
  uuid: string;
  label: string;
  pabx?: string | null;
};

@Component({
  selector: 'app-voip-pabx-queue-agent',
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
    MatTabsModule,
    MatTableModule,
    MatTooltipModule,
  ],
  template: `
    <section class="page-shell" @fadeIn>
      <header class="page-header">
        <div>
          <p class="eyebrow">VoIP / PABX</p>
          <h1>Queue Agents</h1>
          <p>Manage queue agents linked to employees and extensions.</p>
        </div>
        <div class="header-actions">
          <button mat-stroked-button color="primary" type="button" (click)="refreshList()">
            <mat-icon>refresh</mat-icon>
            Refresh
          </button>
          <button mat-stroked-button color="primary" type="button" (click)="startCreate()">
            <mat-icon>add</mat-icon>
            New
          </button>
        </div>
      </header>

      <mat-card class="toolbar-card">
        <div class="toolbar-grid">
          <mat-form-field appearance="outline">
            <mat-label>Search agents</mat-label>
            <mat-icon matPrefix>search</mat-icon>
            <input
              matInput
              [(ngModel)]="searchInput"
              placeholder="Employee, extension, login code..."
              (keyup.enter)="applySearch()"
            />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Runtime</mat-label>
            <mat-select [(ngModel)]="runtimeFilter">
              <mat-option value="">All</mat-option>
              <mat-option value="LOGGED_OUT">Logged out</mat-option>
              <mat-option value="AVAILABLE">Available</mat-option>
              <mat-option value="PAUSED">Paused</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
        <div class="filter-actions">
          @if (selectedCount()) {
            <span class="selected-count">{{ selectedCount() }} selected</span>
            <button
              mat-stroked-button
              color="warn"
              type="button"
              [disabled]="deletingSelected()"
              (click)="deleteSelected()"
            >
              <mat-icon>delete</mat-icon>
              Delete selected
            </button>
          }
          <button mat-stroked-button color="primary" type="button" (click)="applySearch()">
            <mat-icon>filter_alt</mat-icon>
            Apply
          </button>
          <button mat-stroked-button color="primary" type="button" (click)="clearFilters()">
            <mat-icon>backspace</mat-icon>
            Clear
          </button>
        </div>
      </mat-card>

      <mat-card class="table-card">
        @if (loading()) {
          <div class="loading-state">
            <mat-spinner diameter="36"></mat-spinner>
          </div>
        }

        <table mat-table [dataSource]="dataSource" matSort>
          <ng-container matColumnDef="select">
            <th mat-header-cell *matHeaderCellDef>
              <mat-checkbox
                [checked]="isAllVisibleSelected()"
                [indeterminate]="isSomeVisibleSelected()"
                (change)="toggleVisibleSelection($event.checked)"
                aria-label="Select visible queue agents"
              ></mat-checkbox>
            </th>
            <td mat-cell *matCellDef="let row">
              <mat-checkbox
                [checked]="isSelected(row)"
                (change)="toggleSelection(row, $event.checked)"
                aria-label="Select queue agent"
              ></mat-checkbox>
            </td>
          </ng-container>

          <ng-container matColumnDef="loginCode">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Code</th>
            <td mat-cell *matCellDef="let row">{{ row.VqaLoginCode }}</td>
          </ng-container>

          <ng-container matColumnDef="employee">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Employee</th>
            <td mat-cell *matCellDef="let row">
              <strong>{{ row.EmployeeName || row.VqaDisplayName || '-' }}</strong>
              <span>{{ row.EmployeeEmail || '-' }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="extension">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Extension</th>
            <td mat-cell *matCellDef="let row">
              <strong>{{ row.ExtensionUsername || '-' }}</strong>
              <span>{{ row.PabxName || '-' }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="runtime">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Runtime</th>
            <td mat-cell *matCellDef="let row">
              <mat-chip
                class="status-pill"
                [class.is-active]="row.VqaRuntimeStatus === 'AVAILABLE'"
                [class.is-paused]="row.VqaRuntimeStatus === 'PAUSED'"
              >
                {{ runtimeLabel(row.VqaRuntimeStatus) }}
              </mat-chip>
              @if (row.VqaPauseReason) {
                <span>{{ row.VqaPauseReason }}</span>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Status</th>
            <td mat-cell *matCellDef="let row">
              <mat-chip class="status-pill" [class.is-active]="row.VqaEnabled === 1">
                {{ row.VqaEnabled === 1 ? 'ACTIVE' : 'INACTIVE' }}
              </mat-chip>
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let row" class="actions-cell">
              <button mat-icon-button matTooltip="Edit" type="button" (click)="startEdit(row)">
                <mat-icon>edit</mat-icon>
              </button>
              @if (row.VqaRuntimeStatus === 'LOGGED_OUT') {
                <button
                  mat-icon-button
                  matTooltip="Log in"
                  type="button"
                  (click)="setRuntime(row, 'login')"
                >
                  <mat-icon>login</mat-icon>
                </button>
              } @else {
                <button
                  mat-icon-button
                  matTooltip="Log out"
                  type="button"
                  (click)="setRuntime(row, 'logout')"
                >
                  <mat-icon>logout</mat-icon>
                </button>
              }
              @if (row.VqaRuntimeStatus === 'PAUSED') {
                <button
                  mat-icon-button
                  matTooltip="Unpause"
                  type="button"
                  (click)="setRuntime(row, 'unpause')"
                >
                  <mat-icon>play_arrow</mat-icon>
                </button>
              } @else if (row.VqaRuntimeStatus === 'AVAILABLE') {
                <button
                  mat-icon-button
                  matTooltip="Pause"
                  type="button"
                  (click)="setRuntime(row, 'pause')"
                >
                  <mat-icon>pause</mat-icon>
                </button>
              }
              <button mat-icon-button matTooltip="Delete" type="button" (click)="deleteAgent(row)">
                <mat-icon>delete</mat-icon>
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
        </table>

        @if (!loading() && dataSource.data.length === 0) {
          <div class="empty-state">No queue agents found.</div>
        }

        <mat-paginator
          class="mobile-paginator"
          [pageSize]="25"
          [pageSizeOptions]="[10, 25, 50, 100]"
        ></mat-paginator>
      </mat-card>
    </section>

    <ng-template #agentDialog>
      <form class="dialog-form" [formGroup]="form" (ngSubmit)="saveAgent()">
        <header class="dialog-header">
          <h2>{{ editing() ? 'Edit Queue Agent' : 'New Queue Agent' }}</h2>
          <button mat-icon-button type="button" mat-dialog-close>
            <mat-icon>close</mat-icon>
          </button>
        </header>

        <div class="dialog-content">
          <mat-tab-group class="form-tabs">
            <mat-tab label="Data">
              <div class="tab-content">
                <mat-form-field appearance="outline">
                  <mat-label>Employee</mat-label>
                  <mat-select
                    formControlName="employeeUUID"
                    (openedChange)="clearEmployeeSearch(!$event)"
                  >
                    <mat-option class="select-search-option" disabled>
                      <input
                        class="select-search-field"
                        matInput
                        placeholder="Search employee"
                        [ngModel]="employeeSearch()"
                        [ngModelOptions]="{ standalone: true }"
                        (ngModelChange)="employeeSearch.set($event)"
                        (click)="$event.stopPropagation()"
                        (keydown)="$event.stopPropagation()"
                      />
                    </mat-option>
                    @for (option of filteredEmployees(); track option.uuid) {
                      <mat-option [value]="option.uuid">{{ option.label }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Extension</mat-label>
                  <mat-select
                    formControlName="extensionUUID"
                    (openedChange)="clearExtensionSearch(!$event)"
                  >
                    <mat-option class="select-search-option" disabled>
                      <input
                        class="select-search-field"
                        matInput
                        placeholder="Search extension"
                        [ngModel]="extensionSearch()"
                        [ngModelOptions]="{ standalone: true }"
                        (ngModelChange)="extensionSearch.set($event)"
                        (click)="$event.stopPropagation()"
                        (keydown)="$event.stopPropagation()"
                      />
                    </mat-option>
                    @for (option of filteredExtensions(); track option.uuid) {
                      <mat-option [value]="option.uuid">{{ option.label }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Login Code</mat-label>
                  <input matInput formControlName="loginCode" maxlength="32" />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Display Name</mat-label>
                  <input matInput formControlName="displayName" maxlength="150" />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Runtime</mat-label>
                  <mat-select formControlName="runtimeStatus">
                    <mat-option value="LOGGED_OUT">Logged out</mat-option>
                    <mat-option value="AVAILABLE">Available</mat-option>
                    <mat-option value="PAUSED">Paused</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Pause Reason</mat-label>
                  <input matInput formControlName="pauseReason" maxlength="120" />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Status</mat-label>
                  <mat-select formControlName="enabled">
                    <mat-option [value]="true">Active</mat-option>
                    <mat-option [value]="false">Inactive</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>
            </mat-tab>
          </mat-tab-group>
        </div>

        <footer class="form-actions">
          <div class="secondary-actions">
            <button mat-stroked-button type="button" mat-dialog-close>Cancel</button>
          </div>
          <div class="primary-actions">
            @if (!editing()) {
              <div class="save-split-action">
                <button
                  mat-flat-button
                  color="primary"
                  type="submit"
                  [disabled]="form.invalid || saving()"
                >
                  <mat-icon>save</mat-icon>
                  Save
                </button>
                <button
                  mat-flat-button
                  color="primary"
                  type="button"
                  [disabled]="form.invalid || saving()"
                  [matMenuTriggerFor]="saveMenu"
                  aria-label="More save actions"
                >
                  <mat-icon>expand_more</mat-icon>
                </button>
              </div>
              <mat-menu #saveMenu="matMenu" xPosition="before" yPosition="below">
                <button mat-menu-item type="button" (click)="saveAndNew()">Save/New</button>
              </mat-menu>
            } @else {
              <button
                mat-flat-button
                color="primary"
                type="submit"
                [disabled]="form.invalid || saving()"
              >
                <mat-icon>save</mat-icon>
                Save
              </button>
            }
          </div>
        </footer>
      </form>
    </ng-template>
  `,
  styles: [
    `
      .page-shell {
        display: grid;
        gap: 20px;
        padding: 32px;
      }
      .page-header {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: flex-start;
      }
      .header-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
      .page-header h1 {
        margin: 0;
        font-size: 32px;
      }
      .page-header p {
        margin: 6px 0 0;
        color: var(--text-muted, #a8b2b1);
      }
      .eyebrow {
        margin: 0 0 4px !important;
        color: var(--primary-color, #46d7d9) !important;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
      }
      .toolbar-card,
      .table-card {
        border-radius: 8px;
      }
      .toolbar-grid {
        display: grid;
        grid-template-columns: minmax(240px, 1fr) minmax(180px, 260px);
        gap: 12px;
      }
      .filter-actions {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 10px;
        grid-column: 1 / -1;
      }
      .selected-count {
        color: var(--text-muted, #a8b2b1);
        font-size: 13px;
      }
      .table-card {
        overflow: auto;
        position: relative;
      }
      table {
        width: 100%;
      }
      td strong,
      td span {
        display: block;
      }
      td span {
        color: var(--text-muted, #a8b2b1);
        font-size: 12px;
        margin-top: 2px;
      }
      .actions-cell {
        text-align: right;
        white-space: nowrap;
      }
      .status-pill {
        border-radius: 999px;
      }
      .status-pill.is-active {
        background: rgba(70, 215, 217, 0.18);
        color: var(--primary-color, #46d7d9);
      }
      .status-pill.is-paused {
        background: rgba(245, 158, 11, 0.14);
        color: #b7791f;
      }
      .loading-state,
      .empty-state {
        display: grid;
        min-height: 160px;
        place-items: center;
      }
      .dialog-form {
        display: flex;
        flex-direction: column;
        height: 100%;
        max-height: min(92vh, 1100px);
        min-width: min(760px, 90vw);
      }
      .dialog-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 18px 24px;
      }
      .dialog-header h2 {
        margin: 0;
      }
      .dialog-content {
        flex: 1 1 auto;
        min-height: 0;
        padding: 0 24px 8px;
        overflow: hidden;
      }
      .form-tabs {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
      }
      .tab-content {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
        padding: 12px 0 4px;
      }
      .form-actions {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 12px;
        margin: auto 0 0;
        padding: 14px 24px 16px;
        border-top: 1px solid rgba(148, 163, 184, 0.22);
        background: rgba(255, 255, 255, 0.84);
        backdrop-filter: blur(8px);
      }
      .secondary-actions {
        grid-row: 1;
        justify-self: start;
      }
      .primary-actions {
        grid-row: 1;
        justify-self: end;
      }
      .save-split-action {
        display: grid;
        grid-template-columns: minmax(160px, auto) 44px;
        gap: 0;
        overflow: hidden;
        border-radius: 999px;
      }
      .save-split-action button {
        border-radius: 0;
        height: 40px;
      }
      .save-split-action button:first-child {
        border-radius: 999px 0 0 999px;
      }
      .save-split-action button:last-child {
        min-width: 44px;
        padding: 0;
        border-radius: 0 999px 999px 0;
      }
      .select-search-option {
        height: auto;
        padding: 8px 12px;
      }
      .select-search-field {
        width: 100%;
        border: 0;
        outline: 0;
      }
      @media (max-width: 720px) {
        .page-shell {
          padding: 20px;
        }
        .page-header {
          flex-direction: column;
        }
        .header-actions,
        .filter-actions {
          justify-content: flex-end;
        }
        .toolbar-grid,
        .tab-content {
          grid-template-columns: 1fr;
        }
        .dialog-form {
          min-width: 92vw;
        }
        .form-actions {
          grid-template-columns: 1fr;
        }
        .primary-actions,
        .secondary-actions {
          justify-self: stretch;
        }
        .primary-actions {
          grid-row: 1;
        }
        .secondary-actions {
          grid-row: 2;
        }
        .primary-actions button,
        .secondary-actions button,
        .save-split-action {
          width: 100%;
        }
      }
    `,
  ],
  animations: [fadeIn],
})
export class VoipPabxQueueAgentPage implements AfterViewInit {
  private readonly api = inject(VoipPabxQueueAgentService);
  private readonly extensionApi = inject(VoipPabxExtensionService);
  private readonly genericApi = inject(ApiService);
  private readonly snack = inject(SnackbarService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild('agentDialog') agentDialog?: TemplateRef<unknown>;

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly deletingSelected = signal(false);
  readonly editing = signal<VoipPabxQueueAgentItem | null>(null);
  readonly selectedUUIDs = signal<Set<string>>(new Set());
  readonly employees = signal<EmployeeOption[]>([]);
  readonly extensions = signal<ExtensionOption[]>([]);
  readonly employeeSearch = signal('');
  readonly extensionSearch = signal('');
  readonly dataSource = new MatTableDataSource<VoipPabxQueueAgentItem>([]);
  readonly displayedColumns = [
    'select',
    'loginCode',
    'employee',
    'extension',
    'runtime',
    'status',
    'actions',
  ];

  searchInput = '';
  runtimeFilter = '';

  readonly form = this.fb.nonNullable.group({
    employeeUUID: ['', Validators.required],
    extensionUUID: ['', Validators.required],
    loginCode: ['', [Validators.required, Validators.maxLength(32)]],
    displayName: [''],
    runtimeStatus: ['LOGGED_OUT', Validators.required],
    pauseReason: [''],
    enabled: [true],
  });

  readonly filteredEmployees = computed(() => {
    const term = this.employeeSearch().toLowerCase();
    return this.employees().filter((item) => item.label.toLowerCase().includes(term));
  });

  readonly filteredExtensions = computed(() => {
    const term = this.extensionSearch().toLowerCase();
    return this.extensions().filter((item) => item.label.toLowerCase().includes(term));
  });

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sort = this.sort ?? null;
    this.dataSource.sortingDataAccessor = (row, column) => {
      if (column === 'employee') return row.EmployeeName ?? '';
      if (column === 'extension') return row.ExtensionUsername ?? '';
      if (column === 'runtime') return row.VqaRuntimeStatus ?? '';
      if (column === 'status') return row.VqaEnabled ?? 0;
      return (row as any)[column] ?? '';
    };
    void this.bootstrap();
  }

  async bootstrap() {
    await Promise.all([this.loadLookups(), this.loadAgents()]);
  }

  async loadLookups() {
    try {
      const [employeesResponse, extensionsResponse] = await Promise.all([
        this.genericApi.get<any>('erp/human-resources/employees?limit=500'),
        this.extensionApi.list(new URLSearchParams({ limit: '1000' })),
      ]);
      this.employees.set(
        ((employeesResponse?.data?.items ?? []) as any[]).map((item) => ({
          uuid: item.EmployeeUUID,
          label: item.Name ?? item.EmployeeName ?? item.EmpName ?? item.EmployeeUUID,
          email: item.Email ?? null,
        })),
      );
      this.extensions.set(
        ((extensionsResponse?.data?.items ?? []) as VoipPabxExtensionItem[]).map((item) => ({
          uuid: item.VpeUUID,
          label: `${item.VpeUsername}${item.PabxName ? ` - ${item.PabxName}` : ''}`,
          pabx: item.PabxName ?? null,
        })),
      );
    } catch (err) {
      this.snack.error(this.extractError(err, 'Failed to load employees and extensions.'));
    }
  }

  async loadAgents() {
    this.loading.set(true);
    try {
      const params = new URLSearchParams({ limit: '500' });
      if (this.searchInput.trim()) params.set('search', this.searchInput.trim());
      if (this.runtimeFilter) params.set('runtimeStatus', this.runtimeFilter);
      const response = await this.api.list(params);
      this.dataSource.data = (response?.data?.items ?? []) as VoipPabxQueueAgentItem[];
      this.reconcileSelection();
    } catch (err) {
      this.snack.error(this.extractError(err, 'Failed to load queue agents.'));
    } finally {
      this.loading.set(false);
    }
  }

  applySearch() {
    void this.loadAgents();
  }

  refreshList() {
    void this.loadAgents();
  }

  clearFilters() {
    this.searchInput = '';
    this.runtimeFilter = '';
    void this.loadAgents();
  }

  startCreate() {
    this.editing.set(null);
    this.form.reset({
      employeeUUID: '',
      extensionUUID: '',
      loginCode: '',
      displayName: '',
      runtimeStatus: 'LOGGED_OUT',
      pauseReason: '',
      enabled: true,
    });
    this.openDialog();
  }

  startEdit(row: VoipPabxQueueAgentItem) {
    this.editing.set(row);
    this.form.reset({
      employeeUUID: row.ErpHrEmployeeEmpUUID,
      extensionUUID: row.VoipPabxExtensionVpeUUID,
      loginCode: row.VqaLoginCode,
      displayName: row.VqaDisplayName ?? '',
      runtimeStatus: row.VqaRuntimeStatus,
      pauseReason: row.VqaPauseReason ?? '',
      enabled: row.VqaEnabled === 1,
    });
    this.openDialog();
  }

  async saveAgent(keepOpen = false) {
    if (this.form.invalid) return;
    this.saving.set(true);
    const value = this.form.getRawValue();
    const payload = {
      employeeUUID: value.employeeUUID,
      extensionUUID: value.extensionUUID,
      loginCode: value.loginCode,
      displayName: value.displayName || null,
      runtimeStatus: value.runtimeStatus,
      pauseReason: value.pauseReason || null,
      enabled: value.enabled,
    };
    try {
      const editing = this.editing();
      if (editing) await this.api.update(editing.VqaUUID, payload);
      else await this.api.create(payload);
      this.snack.success(editing ? 'Queue agent updated.' : 'Queue agent created.');
      if (keepOpen && !editing) {
        this.form.reset({
          employeeUUID: '',
          extensionUUID: '',
          loginCode: '',
          displayName: '',
          runtimeStatus: 'LOGGED_OUT',
          pauseReason: '',
          enabled: true,
        });
      } else {
        this.dialog.closeAll();
      }
      await this.loadAgents();
    } catch (err) {
      this.snack.error(this.extractError(err, 'Failed to save queue agent.'));
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNew() {
    void this.saveAgent(true);
  }

  async deleteAgent(row: VoipPabxQueueAgentItem) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      width: '420px',
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
      data: {
        title: 'Delete queue agent',
        message: `Delete queue agent ${row.EmployeeName ?? row.VqaLoginCode}?`,
        confirmLabel: 'Delete',
      },
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;
    try {
      await this.api.remove(row.VqaUUID);
      this.snack.success('Queue agent deleted.');
      this.selectedUUIDs.update((set) => {
        const next = new Set(set);
        next.delete(row.VqaUUID);
        return next;
      });
      await this.loadAgents();
    } catch (err) {
      this.snack.error(this.extractError(err, 'Failed to delete queue agent.'));
    }
  }

  selectedCount() {
    return this.selectedUUIDs().size;
  }

  visibleRows() {
    const rows = this.dataSource.filteredData.length
      ? this.dataSource.filteredData
      : this.dataSource.data;
    if (!this.paginator) return rows;
    const start = this.paginator.pageIndex * this.paginator.pageSize;
    return rows.slice(start, start + this.paginator.pageSize);
  }

  isSelected(row: VoipPabxQueueAgentItem) {
    return this.selectedUUIDs().has(row.VqaUUID);
  }

  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  toggleSelection(row: VoipPabxQueueAgentItem, checked: boolean) {
    this.selectedUUIDs.update((set) => {
      const next = new Set(set);
      if (checked) next.add(row.VqaUUID);
      else next.delete(row.VqaUUID);
      return next;
    });
  }

  toggleVisibleSelection(checked: boolean) {
    this.visibleRows().forEach((row) => this.toggleSelection(row, checked));
  }

  async deleteSelected() {
    const ids = Array.from(this.selectedUUIDs());
    if (!ids.length) return;
    const names = this.dataSource.data
      .filter((row) => ids.includes(row.VqaUUID))
      .slice(0, 3)
      .map((row) => row.EmployeeName || row.VqaDisplayName || row.VqaLoginCode)
      .join(', ');
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      width: '420px',
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
      data: {
        title: 'Delete selected queue agents',
        message: `Delete ${ids.length} selected queue agent(s)?${names ? ` Examples: ${names}.` : ''}`,
        confirmLabel: 'Delete selected',
      },
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.deletingSelected.set(true);
    try {
      const response = await this.api.removeMany(ids);
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      const failed = this.failedUUIDs(response?.data?.failed ?? []);
      this.dataSource.data = this.dataSource.data.filter((row) => !deleted.has(row.VqaUUID));
      this.selectedUUIDs.set(new Set(failed));
      if (failed.length)
        this.snack.warning(`${failed.length} queue agent(s) could not be deleted.`);
      else this.snack.success(`${deleted.size} queue agent(s) deleted successfully.`);
    } catch (err) {
      this.snack.error(this.extractError(err, 'Failed to delete selected queue agents.'));
    } finally {
      this.deletingSelected.set(false);
    }
  }

  async setRuntime(row: VoipPabxQueueAgentItem, action: 'login' | 'logout' | 'pause' | 'unpause') {
    try {
      await this.api.setStatus(
        row.VqaUUID,
        action,
        action === 'pause' ? 'Manual pause' : undefined,
      );
      this.snack.success('Queue agent status updated.');
      await this.loadAgents();
    } catch (err) {
      this.snack.error(this.extractError(err, 'Failed to update queue agent status.'));
    }
  }

  runtimeLabel(status: string) {
    if (status === 'AVAILABLE') return 'AVAILABLE';
    if (status === 'PAUSED') return 'PAUSED';
    return 'LOGGED OUT';
  }

  clearEmployeeSearch(closed: boolean) {
    if (closed) this.employeeSearch.set('');
  }

  clearExtensionSearch(closed: boolean) {
    if (closed) this.extensionSearch.set('');
  }

  private openDialog() {
    if (!this.agentDialog) return;
    const ref = this.dialog.open(this.agentDialog, {
      width: '820px',
      maxWidth: '94vw',
      maxHeight: '88vh',
      autoFocus: false,
      disableClose: true,
      panelClass: 'voip-pabx-queue-agent-dialog',
    });
    ref.updateSize('820px', '88vh');
  }

  private reconcileSelection() {
    const valid = new Set(this.dataSource.data.map((row) => row.VqaUUID));
    this.selectedUUIDs.set(new Set([...this.selectedUUIDs()].filter((uuid) => valid.has(uuid))));
  }

  private failedUUIDs(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => item?.VqaUUID ?? item?.uuid ?? item)
      .filter((item): item is string => typeof item === 'string' && item.length > 0);
  }

  private extractError(err: unknown, fallback: string) {
    if (err && typeof err === 'object' && 'error' in err) {
      const value = (err as any).error;
      if (typeof value === 'string') return value;
      if (value?.error) return value.error;
      if (value?.message) return value.message;
    }
    return fallback;
  }
}
