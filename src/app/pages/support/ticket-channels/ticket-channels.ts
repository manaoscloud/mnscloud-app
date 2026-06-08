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
import { TranslocoPipe } from '@jsverse/transloco';

type SupportTicketChannel = {
  SupportTicketChannelUUID: string;
  SupportTicketChannelID: string;
  Name: string;
  Code?: string | null;
  Description?: string | null;
  Status: number;
  DateCreated?: string | null;
};

const MIN_LOADING_MS = 600;

@Component({
  selector: 'app-support-ticket-channels',
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
    TranslocoPipe,
  ],
  templateUrl: './ticket-channels.html',
  styleUrls: ['./ticket-channels.scss'],
})
export class SupportTicketChannelsPage implements OnInit, AfterViewInit, OnDestroy {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);

  channels: SupportTicketChannel[] = [];
  dataSource = new MatTableDataSource<SupportTicketChannel>([]);
  displayedColumns: string[] = ['name', 'code', 'status', 'actions'];
  search = '';
  searchInput = '';
  loading = true;
  error = '';

  editing: SupportTicketChannel | null = null;

  statusOptions = [
    { value: 1, label: 'Active' },
    { value: 0, label: 'Inactive' },
  ];

  form = {
    name: '',
    code: '',
    description: '',
    status: 1,
  };

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild('ticketChannelFormDialog') ticketChannelFormDialog?: TemplateRef<unknown>;
  private ticketChannelFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;

  ngOnInit() {
    void this.loadChannels();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sort = this.sort ?? null;
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'name':
          return data.Name ?? '';
        case 'code':
          return data.Code ?? '';
        case 'status':
          return data.Status ?? 0;
        default:
          return '';
      }
    };
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      return [data.Name, data.Code, data.Description]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    };
  }

  ngOnDestroy() {
    this.stopDialogViewportObserver();
    this.ticketChannelFormDialogRef?.close();
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
    void this.loadChannels();
  }

  statusLabel(status: number) {
    return status === 1 ? 'Active' : 'Inactive';
  }

  async loadChannels() {
    const startedAt = Date.now();
    this.loading = true;
    this.error = '';
    try {
      const res = await this.api.get<any>('support/ticket-channels');
      this.channels = res?.data?.items ?? [];
      this.dataSource.data = [...this.channels];
      this.applySearchFilters();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to load channels.';
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
    this.form.name = '';
    this.form.code = '';
    this.form.description = '';
    this.form.status = 1;
  }

  private openFormDialog() {
    if (!this.ticketChannelFormDialog) return;
    if (this.ticketChannelFormDialogRef) return;
    this.ticketChannelFormDialogRef = this.dialog.open(this.ticketChannelFormDialog, {
      ...this.getDialogViewportConfig(),
      panelClass: 'support-ticket-channel-form-dialog',
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
    });
    this.ticketChannelFormDialogRef.keydownEvents().subscribe((event) => {
      if (event.key === 'Escape') this.ticketChannelFormDialogRef?.close();
    });
    this.startDialogViewportObserver();
    this.ticketChannelFormDialogRef.afterClosed().subscribe(() => {
      this.stopDialogViewportObserver();
      this.ticketChannelFormDialogRef = null;
    });
  }

  closeFormDialog() {
    this.stopDialogViewportObserver();
    this.ticketChannelFormDialogRef?.close();
    this.ticketChannelFormDialogRef = null;
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
    if (!this.ticketChannelFormDialogRef) return;

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
    if (!this.ticketChannelFormDialogRef) return;
    const config = this.getDialogViewportConfig();
    const width = typeof config.width === 'string' ? config.width : '';
    const maxHeight = typeof config.maxHeight === 'string' ? config.maxHeight : '';
    this.ticketChannelFormDialogRef.updateSize(width, maxHeight);
    if (config.position) {
      this.ticketChannelFormDialogRef.updatePosition(config.position);
    } else {
      this.ticketChannelFormDialogRef.updatePosition();
    }
  }

  startCreate() {
    this.resetForm();
    this.openFormDialog();
  }

  startEdit(item: SupportTicketChannel) {
    this.editing = item;
    this.form.name = item.Name ?? '';
    this.form.code = item.Code ?? '';
    this.form.description = item.Description ?? '';
    this.form.status = item.Status ?? 1;
    this.openFormDialog();
  }

  async saveChannel(createAndNew = false) {
    if (!this.form.name.trim()) {
      this.error = 'Name is required.';
      return;
    }

    this.loading = true;
    this.error = '';

    try {
      const payload = {
        name: this.form.name.trim(),
        code: this.form.code?.trim() || null,
        description: this.form.description?.trim() || null,
        status: this.form.status,
      };

      if (this.editing) {
        await this.api.put(
          `support/ticket-channels/${this.editing.SupportTicketChannelUUID}`,
          payload,
        );
      } else {
        await this.api.post('support/ticket-channels', payload);
      }

      await this.loadChannels();
      if (createAndNew && !this.editing) {
        this.resetForm();
      } else {
        this.closeFormDialog();
        this.resetForm();
      }
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to save channel.';
    } finally {
      this.loading = false;
    }
  }

  async deleteChannel(item: SupportTicketChannel) {
    const dialogRef = this.dialog.open(SlowConfirmDialogComponent, {
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
      data: {
        title: 'Delete ticket channel',
        message: `Do you want to delete "${item.Name}"? This action cannot be undone.`,
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
      await this.api.delete(`support/ticket-channels/${item.SupportTicketChannelUUID}`);
      await this.loadChannels();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to delete channel.';
    } finally {
      this.loading = false;
    }
  }
}
