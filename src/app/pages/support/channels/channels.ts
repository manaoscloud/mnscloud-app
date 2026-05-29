import {
  AfterViewInit,
  Component,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../../services/api.service';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslatePipe } from '../../../shared/i18n/translate.pipe';

type SupportChannel = {
  SupportChannelUUID: string;
  Provider: string;
  DisplayName: string;
  Status: string;
  LastSyncAt?: string | null;
  DateCreated?: string | null;
};

type ProviderOption = { id: string; label: string };

type ChannelConfig = {
  phone_number_id?: string;
  business_account_id?: string;
  access_token?: string;
  verify_token?: string;
  account_sid?: string;
  auth_token?: string;
  whatsapp_number?: string;
  app_id?: string;
  app_secret?: string;
  page_id?: string;
  ig_user_id?: string;
  bot_token?: string;
  webchat_url?: string;
};

const MIN_LOADING_MS = 600;

@Component({
  selector: 'app-support-channels',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatChipsModule,
    MatTooltipModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    TranslatePipe,
  ],
  templateUrl: './channels.html',
  styleUrls: ['./channels.scss'],
})
export class SupportChannelsPage implements AfterViewInit, OnInit, OnDestroy {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);

  connections: SupportChannel[] = [];
  dataSource = new MatTableDataSource<SupportChannel>([]);
  displayedColumns: string[] = ['provider', 'displayName', 'status', 'lastSyncAt', 'actions'];
  search = '';
  searchInput = '';
  loading = true;
  error = '';

  editing: SupportChannel | null = null;

  providers: ProviderOption[] = [
    { id: 'whatsapp-cloud', label: 'WhatsApp Cloud API' },
    { id: 'whatsapp-twilio', label: 'WhatsApp Twilio' },
    { id: 'messenger', label: 'Messenger' },
    { id: 'instagram', label: 'Instagram' },
    { id: 'telegram', label: 'Telegram' },
    { id: 'webchat', label: 'Webchat' },
  ];

  statusOptions = ['connected', 'disconnected', 'pending', 'error'];

  form: {
    provider: string;
    displayName: string;
    status: string;
    config: ChannelConfig;
  } = {
    provider: 'whatsapp-cloud',
    displayName: '',
    status: 'pending',
    config: {
      phone_number_id: '',
      business_account_id: '',
      access_token: '',
      verify_token: '',
      account_sid: '',
      auth_token: '',
      whatsapp_number: '',
      app_id: '',
      app_secret: '',
      page_id: '',
      ig_user_id: '',
      bot_token: '',
      webchat_url: '',
    },
  };

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild('channelFormDialog') channelFormDialog?: TemplateRef<unknown>;
  private channelFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;

  ngOnInit() {
    void this.loadConnections();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sort = this.sort ?? null;
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      return [data.Provider, data.DisplayName, data.Status]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    };
  }

  ngOnDestroy() {
    this.stopDialogViewportObserver();
    this.channelFormDialogRef?.close();
  }

  onSearchChange(value: string) {
    this.searchInput = value;
  }

  applySearchFilters() {
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
    void this.loadConnections();
  }

  providerLabel(provider: string) {
    return this.providers.find((item) => item.id === provider)?.label ?? provider;
  }

  onProviderChange() {
    this.form.displayName = '';
    this.form.status = 'pending';
  }

  buildConfig() {
    const c = this.form.config;
    switch (this.form.provider) {
      case 'whatsapp-cloud':
        return {
          phone_number_id: c['phone_number_id'],
          business_account_id: c['business_account_id'],
          access_token: c['access_token'],
          verify_token: c['verify_token'],
        };
      case 'whatsapp-twilio':
        return {
          account_sid: c['account_sid'],
          auth_token: c['auth_token'],
          whatsapp_number: c['whatsapp_number'],
        };
      case 'messenger':
        return {
          app_id: c['app_id'],
          app_secret: c['app_secret'],
          page_id: c['page_id'],
          access_token: c['access_token'],
          verify_token: c['verify_token'],
        };
      case 'instagram':
        return {
          app_id: c['app_id'],
          app_secret: c['app_secret'],
          ig_user_id: c['ig_user_id'],
          access_token: c['access_token'],
          verify_token: c['verify_token'],
        };
      case 'telegram':
        return {
          bot_token: c['bot_token'],
        };
      case 'webchat':
        return {
          webchat_url: c['webchat_url'],
        };
      default:
        return {};
    }
  }

  async loadConnections() {
    const startedAt = Date.now();
    this.loading = true;
    this.error = '';
    try {
      const res = await this.api.get<any>('support/channels');
      this.connections = res?.data?.items ?? [];
      this.dataSource.data = [...this.connections];
      this.applySearchFilters();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to load support channels.';
      this.dataSource.data = [];
    } finally {
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_LOADING_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_LOADING_MS - elapsed));
      }
      this.loading = false;
    }
  }

  private resetForm() {
    this.editing = null;
    this.form.provider = 'whatsapp-cloud';
    this.form.displayName = '';
    this.form.status = 'pending';
    this.form.config = {
      phone_number_id: '',
      business_account_id: '',
      access_token: '',
      verify_token: '',
      account_sid: '',
      auth_token: '',
      whatsapp_number: '',
      app_id: '',
      app_secret: '',
      page_id: '',
      ig_user_id: '',
      bot_token: '',
      webchat_url: '',
    };
  }

  private openFormDialog() {
    if (!this.channelFormDialog) return;
    if (this.channelFormDialogRef) return;
    this.channelFormDialogRef = this.dialog.open(this.channelFormDialog, {
      ...this.getDialogViewportConfig(),
      panelClass: 'support-channel-form-dialog',
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
    });
    this.channelFormDialogRef.keydownEvents().subscribe((event) => {
      if (event.key === 'Escape') this.channelFormDialogRef?.close();
    });
    this.startDialogViewportObserver();
    this.channelFormDialogRef.afterClosed().subscribe(() => {
      this.stopDialogViewportObserver();
      this.channelFormDialogRef = null;
    });
  }

  closeFormDialog() {
    this.stopDialogViewportObserver();
    this.channelFormDialogRef?.close();
    this.channelFormDialogRef = null;
  }

  private getDialogViewportConfig() {
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
    if (!this.channelFormDialogRef) return;

    const pageContent = document.querySelector('.page-content') as HTMLElement | null;
    if (!pageContent) return;

    this.dialogViewportObserver = new ResizeObserver(() => {
      this.updateDialogViewport();
    });
    this.dialogViewportObserver.observe(pageContent);
    this.updateDialogViewport();
  }

  private stopDialogViewportObserver() {
    if (!this.dialogViewportObserver) return;
    this.dialogViewportObserver.disconnect();
    this.dialogViewportObserver = null;
  }

  private updateDialogViewport() {
    if (!this.channelFormDialogRef) return;
    const config = this.getDialogViewportConfig();
    const width = typeof config.width === 'string' ? config.width : '';
    const maxHeight = typeof config.maxHeight === 'string' ? config.maxHeight : '';
    this.channelFormDialogRef.updateSize(width, maxHeight);
    if (config.position) {
      this.channelFormDialogRef.updatePosition(config.position);
    } else {
      this.channelFormDialogRef.updatePosition();
    }
  }

  startCreate() {
    this.resetForm();
    this.openFormDialog();
  }

  startEdit(item: SupportChannel) {
    this.editing = item;
    this.form.provider = item.Provider;
    this.form.displayName = item.DisplayName;
    this.form.status = item.Status || 'pending';
    this.openFormDialog();
  }

  async saveConnection(createAndNew = false) {
    if (!this.form.displayName.trim()) {
      this.error = 'Display name is required.';
      return;
    }

    this.loading = true;
    this.error = '';

    try {
      const payload = {
        displayName: this.form.displayName.trim(),
        status: this.form.status,
        config: this.buildConfig(),
      };

      if (this.editing) {
        await this.api.put(
          `support/channels/${this.form.provider}/${this.editing.SupportChannelUUID}`,
          payload,
        );
      } else {
        await this.api.post(`support/channels/${this.form.provider}`, payload);
      }

      await this.loadConnections();
      if (createAndNew && !this.editing) {
        this.resetForm();
      } else {
        this.closeFormDialog();
        this.resetForm();
      }
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to save support channel.';
    } finally {
      this.loading = false;
    }
  }

  async deleteConnection(item: SupportChannel) {
    const dialogRef = this.dialog.open(SlowConfirmDialogComponent, {
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
      data: {
        title: 'Delete support channel',
        message: `Do you want to delete "${item.DisplayName}"? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        countdownSeconds: 3,
      },
    });
    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (!confirmed) return;
    this.loading = true;
    this.error = '';
    try {
      await this.api.delete(`support/channels/${item.Provider}/${item.SupportChannelUUID}`);
      await this.loadConnections();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to delete support channel.';
    } finally {
      this.loading = false;
    }
  }
}
