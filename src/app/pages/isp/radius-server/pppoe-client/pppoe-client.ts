import {
  AfterViewInit,
  Component,
  OnDestroy,
  TemplateRef,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { firstValueFrom } from 'rxjs';

import { fadeIn } from '../../../../shared/animations/fade.animation';
import { ApiService } from '../../../../services/api.service';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';

type PppoeClientItem = {
  PpcUUID: string;
  PpcUsername: string;
  PpcPlanName?: string | null;
  PpcFramedIp?: string | null;
  If4UUID?: string | null;
  If4Cidr?: string | null;
  PpcStatus: number;
  PpcDateCreated?: string | null;
};

type FixedIpv4Option = {
  If4UUID: string;
  If4Name: string;
  If4Cidr: string;
  If4Status: number;
};

@Component({
  selector: 'app-pppoe-client',
  standalone: true,
  imports: [
    CommonModule,
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
    MatProgressSpinnerModule,
    MatTabsModule,
    TranslatePipe,
  ],
  templateUrl: './pppoe-client.html',
  styleUrls: ['./pppoe-client.scss'],
  animations: [fadeIn],
})
export class PppoeClientPage implements AfterViewInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly editing = signal<PppoeClientItem | null>(null);
  readonly hidePassword = signal(true);
  readonly fixedIpv4Options = signal<FixedIpv4Option[]>([]);

  readonly dataSource = new MatTableDataSource<PppoeClientItem>([]);
  readonly displayedColumns = ['username', 'plan', 'ip', 'status', 'actions'];
  search = '';
  searchInput = '';

  readonly pppoeForm = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(2)]],
    password: ['', [Validators.required, Validators.minLength(4)]],
    planName: [''],
    fixedIpv4UUID: [''],
    status: [1],
  });

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild('pppoeClientFormDialog') pppoeClientFormDialog?: TemplateRef<unknown>;
  private pppoeClientFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sort = this.sort ?? null;
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      return [data.PpcUsername, data.PpcPlanName, data.PpcFramedIp, data.If4Cidr]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    };

    setTimeout(() => {
      void Promise.all([this.loadClients(), this.loadFixedIpv4Options()]);
    }, 0);
  }

  ngOnDestroy() {
    this.stopDialogViewportObserver();
    this.closePppoeClientDialog();
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
    void Promise.all([this.loadClients(), this.loadFixedIpv4Options()]);
  }

  async loadClients() {
    this.loading.set(true);
    this.error.set(null);
    const start = performance.now();

    try {
      const response = await this.api.get<any>('isp/radius-servers/pppoe-clients');
      const items = response?.data?.items ?? [];
      this.dataSource.data = items;
      this.applySearchFilters();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to load PPPoE clients.'));
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
    this.pppoeForm.reset({
      username: '',
      password: '',
      planName: '',
      fixedIpv4UUID: '',
      status: 1,
    });
  }

  startEdit(client: PppoeClientItem) {
    this.editing.set(client);
    this.pppoeForm.reset({
      username: client.PpcUsername,
      password: '',
      planName: client.PpcPlanName ?? '',
      fixedIpv4UUID: client.If4UUID ?? '',
      status: client.PpcStatus ?? 1,
    });
    this.openPppoeClientDialog();
  }

  async saveClient(createAnother = false) {
    if (this.pppoeForm.invalid) return;

    const value = this.pppoeForm.getRawValue();
    const payload = {
      username: value.username.trim(),
      password: value.password.trim(),
      planName: value.planName?.trim() || null,
      fixedIpv4UUID: value.fixedIpv4UUID?.trim() || null,
      status: value.status,
    };

    this.saving.set(true);
    this.error.set(null);

    try {
      const editing = this.editing();
      if (editing) {
        await this.api.put<any>(`isp/radius-servers/pppoe-clients/${editing.PpcUUID}`, payload);
      } else {
        await this.api.post<any>('isp/radius-servers/pppoe-clients', payload);
      }

      await this.loadClients();
      if (createAnother) {
        this.startCreate();
        return;
      }
      this.closePppoeClientDialog();
      this.startCreate();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to save PPPoE client.'));
    } finally {
      this.saving.set(false);
    }
  }

  saveClientAndNew() {
    void this.saveClient(true);
  }

  async deleteClient(client: PppoeClientItem) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete PPPoE client',
        message: `Are you sure you want to delete "${client.PpcUsername}"?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.delete(`isp/radius-servers/pppoe-clients/${client.PpcUUID}`);
      this.dataSource.data = this.dataSource.data.filter((row) => row.PpcUUID !== client.PpcUUID);
    } catch (err) {
      console.error('Failed to delete PPPoE client.', err);
      alert('Failed to delete PPPoE client.');
    }
  }

  statusLabel(client: PppoeClientItem) {
    return client.PpcStatus === 1 ? 'Active' : 'Inactive';
  }

  togglePassword(event: MouseEvent) {
    event.stopPropagation();
    this.hidePassword.set(!this.hidePassword());
  }

  openCreateDialog() {
    this.startCreate();
    this.openPppoeClientDialog();
  }

  cancelPppoeClientForm() {
    this.closePppoeClientDialog();
    this.startCreate();
  }

  private openPppoeClientDialog() {
    if (!this.pppoeClientFormDialog || this.pppoeClientFormDialogRef) return;
    this.error.set(null);
    this.pppoeClientFormDialogRef = this.dialog.open(this.pppoeClientFormDialog, {
      ...this.getPppoeClientDialogViewportConfig(),
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'isp-pppoe-client-form-dialog',
    });
    this.pppoeClientFormDialogRef.keydownEvents().subscribe((event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.closePppoeClientDialog();
      }
    });
    this.startDialogViewportObserver();
    this.pppoeClientFormDialogRef.afterClosed().subscribe(() => {
      this.stopDialogViewportObserver();
      this.pppoeClientFormDialogRef = null;
    });
  }

  private closePppoeClientDialog() {
    if (!this.pppoeClientFormDialogRef) return;
    this.stopDialogViewportObserver();
    this.pppoeClientFormDialogRef.close();
    this.pppoeClientFormDialogRef = null;
  }

  private getPppoeClientDialogViewportConfig() {
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
    if (!this.pppoeClientFormDialogRef) return;

    const pageContent = document.querySelector('.page-content') as HTMLElement | null;
    if (!pageContent) return;

    this.dialogViewportObserver = new ResizeObserver(() => {
      this.updatePppoeClientDialogViewport();
    });
    this.dialogViewportObserver.observe(pageContent);
    this.updatePppoeClientDialogViewport();
  }

  private stopDialogViewportObserver() {
    if (!this.dialogViewportObserver) return;
    this.dialogViewportObserver.disconnect();
    this.dialogViewportObserver = null;
  }

  private updatePppoeClientDialogViewport() {
    if (!this.pppoeClientFormDialogRef) return;
    const config = this.getPppoeClientDialogViewportConfig();
    const width = typeof config.width === 'string' ? config.width : '';
    const maxHeight = typeof config.maxHeight === 'string' ? config.maxHeight : '';
    this.pppoeClientFormDialogRef.updateSize(width, maxHeight);
    if (config.position) {
      this.pppoeClientFormDialogRef.updatePosition(config.position);
    } else {
      this.pppoeClientFormDialogRef.updatePosition();
    }
  }

  private extractErrorMessage(err: any, fallback: string) {
    return err?.error?.error || err?.error?.message || err?.message || fallback;
  }

  private async loadFixedIpv4Options() {
    try {
      const response = await this.api.get<any>(
        'isp/fixed-ipv4-addresses?status=1&limit=1000&offset=0',
      );
      const items = Array.isArray(response?.data?.items) ? response.data.items : [];
      const options = items.filter((item: any) => String(item?.If4Cidr ?? '').endsWith('/32'));
      this.fixedIpv4Options.set(options);
    } catch {
      this.fixedIpv4Options.set([]);
    }
  }
}
