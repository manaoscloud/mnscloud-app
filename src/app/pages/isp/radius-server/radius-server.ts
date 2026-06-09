import {
  AfterViewInit,
  Component,
  OnDestroy,
  TemplateRef,
  ViewChild,
  computed,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';

import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { firstValueFrom } from 'rxjs';

import { fadeIn } from '../../../shared/animations/fade.animation';
import { ApiService } from '../../../services/api.service';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslocoPipe } from '@jsverse/transloco';

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
    ReactiveFormsModule,
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
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [fadeIn],
})
export class IspRadiusServerPage implements AfterViewInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);

  readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  readonly isMaster = computed(() => this.scope() === 'master');
  readonly baseEndpoint = computed(() =>
    this.isMaster() ? 'system/isp/radius-servers' : 'isp/radius-servers',
  );

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly editing = signal<IspRadiusServerItem | null>(null);
  readonly hideSecret = signal(true);

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

  readonly serverForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    host: ['', [Validators.required, Validators.minLength(2)]],
    authPort: [1812, [Validators.required]],
    acctPort: [1813, [Validators.required]],
    secret: [''],
    notes: [''],
    status: [1],
    isDefault: [false],
  });

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild('radiusServerFormDialog') radiusServerFormDialog?: TemplateRef<unknown>;
  private radiusServerFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sort = this.sort ?? null;
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      return [data.IrsName, data.IrsHost]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    };

    setTimeout(() => this.loadServers(), 0);
  }

  ngOnDestroy() {
    this.stopDialogViewportObserver();
    this.closeRadiusServerDialog();
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
    void this.loadServers();
  }

  async loadServers() {
    this.loading.set(true);
    this.error.set(null);
    const start = performance.now();

    try {
      const response = await this.api.get<any>(this.baseEndpoint());
      const items = response?.data?.items ?? [];
      this.dataSource.data = items;
      this.applySearchFilters();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to load RADIUS servers.'));
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

  startCreate() {
    this.editing.set(null);
    this.serverForm.reset({
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
    this.serverForm.reset({
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
    if (this.serverForm.invalid) return;

    const value = this.serverForm.getRawValue();
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

      await this.loadServers();
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
      await this.loadServers();
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
    if (!this.radiusServerFormDialog || this.radiusServerFormDialogRef) return;
    this.error.set(null);
    this.radiusServerFormDialogRef = this.dialog.open(this.radiusServerFormDialog, {
      ...this.getRadiusServerDialogViewportConfig(),
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'isp-radius-server-form-dialog',
    });
    this.radiusServerFormDialogRef.keydownEvents().subscribe((event: KeyboardEvent) => {
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
