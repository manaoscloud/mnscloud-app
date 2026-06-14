import {
  Component,
  DestroyRef,
  TemplateRef,
  afterNextRender,
  computed,
  effect,
  inject,
  resource,
  signal,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';

import { FormField, form as createForm, minLength, required } from '@angular/forms/signals';
import { ActivatedRoute } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatDialogModule, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { firstValueFrom, takeUntil } from 'rxjs';

import { ApiService } from '../../../services/api.service';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../shared/refresh-button/refresh-button';

type IspRadiusServerItem = {
  IrsUUID: string;
  IrsID: string;
  IrsName: string;
  IrsHost: string;
  IrsAuthPort: number;
  IrsAcctPort: number;
  IrsNotes?: string | null;
  IrsStatus: number;
  IrsIsDefault: number;
  IrsDateCreated?: string | null;
  IrsDateUpdated?: string | null;
};

@Component({
  selector: 'app-isp-radius-server',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    FormField,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatTooltipModule,
    MatPaginatorModule,
    MatSortModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    TranslocoPipe,
  ],
  templateUrl: './radius-server.html',
  styleUrls: ['./radius-server.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IspRadiusServerPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  readonly isMaster = computed(() => this.scope() === 'master');
  readonly baseEndpoint = computed(() =>
    this.isMaster() ? 'system/isp/radius-servers' : 'isp/radius-servers',
  );

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly editing = signal<IspRadiusServerItem | null>(null);
  readonly hideSecret = signal(true);
  private readonly serversResource = resource({
    params: () => this.baseEndpoint(),
    defaultValue: [] as IspRadiusServerItem[],
    loader: ({ params }) => this.fetchServers(params),
  });
  readonly loading = this.serversResource.isLoading;

  readonly dataSource = new MatTableDataSource<IspRadiusServerItem>([]);
  readonly displayedColumns = [
    'name',
    'host',
    'authPort',
    'acctPort',
    'status',
    'default',
    'actions',
  ];
  search = '';
  searchInput = '';

  readonly serverFormModel = signal({
    name: '',
    host: '',
    authPort: 1812,
    acctPort: 1813,
    secret: '',
    notes: '',
    status: 1,
    isDefault: false,
  });
  readonly serverForm = createForm(this.serverFormModel, (schema) => {
    required(schema.name);
    minLength(schema.name, 2);
    required(schema.host);
    minLength(schema.host, 2);
    required(schema.authPort);
    required(schema.acctPort);
    required(schema.status);
  });

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly radiusServerFormDialog = viewChild<TemplateRef<unknown>>('radiusServerFormDialog');
  private radiusServerFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;
  private readonly syncServers = effect(() => {
    this.dataSource.data = this.serversResource.value();
    this.applySearchFilters();
  });
  private readonly reportServersError = effect(() => {
    const error = this.serversResource.error();
    if (error) {
      this.error.set(this.extractErrorMessage(error, 'Failed to load RADIUS servers.'));
      this.dataSource.data = [];
    }
  });

  private readonly setupTable = afterNextRender(() => {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      return [data.IrsName, data.IrsHost]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    };
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.stopDialogViewportObserver();
      this.closeRadiusServerDialog();
    });
  }

  onSearchChange(value: string) {
    this.searchInput = value;
  }

  applySearchFilters(value?: string) {
    if (value !== undefined) this.searchInput = value;
    this.search = this.searchInput.trim();
    this.dataSource.filter = this.search.toLowerCase();
    if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
  }

  clearSearchFilters() {
    this.searchInput = '';
    this.search = '';
    this.dataSource.filter = '';
    if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
  }

  refreshList() {
    this.serversResource.reload();
  }

  private async fetchServers(endpoint: string) {
    this.error.set(null);
    const response = await this.api.get<any>(endpoint);
    return response?.data?.items ?? [];
  }

  startCreate() {
    this.editing.set(null);
    this.serverFormModel.set({
      name: '',
      host: '',
      authPort: 1812,
      acctPort: 1813,
      secret: '',
      notes: '',
      status: 1,
      isDefault: false,
    });
  }

  startEdit(server: IspRadiusServerItem) {
    this.editing.set(server);
    this.serverFormModel.set({
      name: server.IrsName,
      host: server.IrsHost,
      authPort: server.IrsAuthPort ?? 1812,
      acctPort: server.IrsAcctPort ?? 1813,
      secret: '',
      notes: server.IrsNotes ?? '',
      status: server.IrsStatus ?? 1,
      isDefault: server.IrsIsDefault === 1,
    });
    this.openRadiusServerDialog();
  }

  async saveServer() {
    if (!this.serverForm().valid()) return;

    const value = this.serverFormModel();
    const secret = value.secret?.trim() || null;

    if (!this.editing() && !secret) {
      this.error.set('RADIUS secret is required.');
      return;
    }

    const payload: Record<string, unknown> = {
      name: value.name.trim(),
      host: value.host.trim(),
      authPort: Number(value.authPort),
      acctPort: Number(value.acctPort),
      notes: value.notes?.trim() || null,
      status: value.status,
      isDefault: value.isDefault ? 1 : 0,
    };

    if (secret) payload['secret'] = secret;

    this.saving.set(true);
    this.error.set(null);

    try {
      const editing = this.editing();
      if (editing) {
        await this.api.put<any>(`${this.baseEndpoint()}/${editing.IrsUUID}`, payload);
      } else {
        await this.api.post<any>(this.baseEndpoint(), payload);
      }

      this.serversResource.reload();
      this.closeRadiusServerDialog();
      this.startCreate();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to save RADIUS server.'));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteServer(server: IspRadiusServerItem) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete RADIUS server',
        message: `Are you sure you want to delete "${server.IrsName}"?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.delete(`${this.baseEndpoint()}/${server.IrsUUID}`);
      this.serversResource.reload();
    } catch (err) {
      console.error('Failed to delete RADIUS server.', err);
      alert('Failed to delete RADIUS server.');
    }
  }

  statusLabel(server: IspRadiusServerItem) {
    return server.IrsStatus === 1 ? 'Active' : 'Inactive';
  }

  defaultLabel(server: IspRadiusServerItem) {
    return server.IrsIsDefault === 1 ? 'Default' : '—';
  }

  toggleSecret(event: MouseEvent) {
    event.stopPropagation();
    this.hideSecret.set(!this.hideSecret());
  }

  openCreateDialog() {
    this.startCreate();
    this.openRadiusServerDialog();
  }

  cancelRadiusServerForm() {
    this.closeRadiusServerDialog();
    this.startCreate();
  }

  private openRadiusServerDialog() {
    const radiusServerFormDialog = this.radiusServerFormDialog();
    if (!radiusServerFormDialog || this.radiusServerFormDialogRef) return;
    this.error.set(null);
    this.radiusServerFormDialogRef = this.dialog.open(radiusServerFormDialog, {
      ...this.getRadiusServerDialogViewportConfig(),
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'isp-radius-server-form-dialog',
    });
    this.radiusServerFormDialogRef
      .keydownEvents()
      .pipe(takeUntil(this.radiusServerFormDialogRef.afterClosed()))
      .subscribe((event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          this.closeRadiusServerDialog();
        }
      });
    this.startDialogViewportObserver();
    this.radiusServerFormDialogRef.afterClosed().subscribe(() => {
      this.stopDialogViewportObserver();
      this.radiusServerFormDialogRef = null;
    });
  }

  private closeRadiusServerDialog() {
    if (!this.radiusServerFormDialogRef) return;
    this.stopDialogViewportObserver();
    this.radiusServerFormDialogRef.close();
    this.radiusServerFormDialogRef = null;
  }

  private getRadiusServerDialogViewportConfig() {
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
    if (!this.radiusServerFormDialogRef) return;

    const pageContent = document.querySelector('.page-content') as HTMLElement | null;
    if (!pageContent) return;

    this.dialogViewportObserver = new ResizeObserver(() => {
      this.updateRadiusServerDialogViewport();
    });
    this.dialogViewportObserver.observe(pageContent);
    this.updateRadiusServerDialogViewport();
  }

  private stopDialogViewportObserver() {
    if (!this.dialogViewportObserver) return;
    this.dialogViewportObserver.disconnect();
    this.dialogViewportObserver = null;
  }

  private updateRadiusServerDialogViewport() {
    if (!this.radiusServerFormDialogRef) return;
    const config = this.getRadiusServerDialogViewportConfig();
    const width = typeof config.width === 'string' ? config.width : '';
    const maxHeight = typeof config.maxHeight === 'string' ? config.maxHeight : '';
    this.radiusServerFormDialogRef.updateSize(width, maxHeight);
    if (config.position) {
      this.radiusServerFormDialogRef.updatePosition(config.position);
    } else {
      this.radiusServerFormDialogRef.updatePosition();
    }
  }

  private extractErrorMessage(err: any, fallback: string) {
    return err?.error?.error || err?.error?.message || err?.message || fallback;
  }
}
