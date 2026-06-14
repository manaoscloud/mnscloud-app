import {
  Component,
  DestroyRef,
  TemplateRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  ChangeDetectionStrategy,
  viewChild,
  afterNextRender,
} from '@angular/core';
import { DatePipe } from '@angular/common';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { firstValueFrom, takeUntil } from 'rxjs';

import { ApiService } from '../../../services/api.service';
import { PhoneInputComponent } from '../../../shared/phone-input/phone-input.component';
import { DateMaskDirective } from '../../../shared/date-mask/date-mask.directive';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../shared/refresh-button/refresh-button';

type Ticket = {
  SupportTicketUUID: string;
  SupportTicketID: string;
  CustomerUUID: string;
  ChannelUUID: string;
  Subject: string;
  Description: string;
  Status: string;
  Priority: string;
  Severity?: string | null;
  Type?: string | null;
  Tags?: string | null;
  InternalNotes?: string | null;
  OpenedAt?: string | null;
  FirstResponseAt?: string | null;
  ResolvedAt?: string | null;
  ClosedAt?: string | null;
  SlaPlan?: string | null;
  SlaResponseDeadline?: string | null;
  SlaResolutionDeadline?: string | null;
  SlaBreached?: number | null;
  ContactName?: string | null;
  ContactEmail?: string | null;
  ContactPhone?: string | null;
  CustomerName?: string | null;
  ChannelName?: string | null;
  AssignedToUserUUID?: string | null;
  DateCreated?: string | null;
};

type TicketEvent = {
  SupportTicketEventUUID: string;
  SupportTicketUUID: string;
  Type: string;
  StatusFrom?: string | null;
  StatusTo?: string | null;
  Message?: string | null;
  IsInternal?: number | null;
  CreatedByUserUUID?: string | null;
  DateCreated?: string | null;
};

type Option = { value: string; label: string };

type CustomerOption = { value: string; label: string };

type ChannelOption = { value: string; label: string };

type TicketFilters = {
  status: string;
  priority: string;
  customerUUID: string;
  channelUUID: string;
};

const emptyTicketFilters = (): TicketFilters => ({
  status: '',
  priority: '',
  customerUUID: '',
  channelUUID: '',
});

@Component({
  selector: 'app-support-tickets',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatChipsModule,
    MatTooltipModule,
    MatCheckboxModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    TranslocoPipe,
    PhoneInputComponent,
    DateMaskDirective,
    DatePipe,
  ],
  templateUrl: './tickets.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./tickets.scss'],
})
export class SupportTicketsPage {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);

  tickets: Ticket[] = [];
  dataSource = new MatTableDataSource<Ticket>([]);
  displayedColumns: string[] = [
    'protocol',
    'subject',
    'customer',
    'channel',
    'priority',
    'status',
    'openedAt',
    'actions',
  ];
  search = '';
  searchInput = '';
  error = '';
  private readonly saving = signal(false);
  private readonly appliedFilters = signal<TicketFilters>(emptyTicketFilters());
  private readonly ticketsResource = resource({
    params: () => this.appliedFilters(),
    defaultValue: [] as Ticket[],
    loader: ({ params }) => this.fetchTickets(params),
  });
  readonly loading = computed(() => this.ticketsResource.isLoading() || this.saving());
  private readonly ticketsEffect = effect(() => {
    this.tickets = this.ticketsResource.value();
    this.dataSource.data = [...this.tickets];
    this.applyFilter();
  });
  private readonly ticketsErrorEffect = effect(() => {
    const error = this.ticketsResource.error();
    if (!error) return;
    this.error = error instanceof Error ? error.message : 'Failed to load tickets.';
    this.tickets = [];
    this.dataSource.data = [];
  });

  editing: Ticket | null = null;
  events: TicketEvent[] = [];
  loadingEvents = false;
  eventError = '';

  customers: CustomerOption[] = [];
  customerMap = new Map<string, CustomerOption>();
  channels: ChannelOption[] = [];
  channelMap = new Map<string, ChannelOption>();
  customerSearch = '';
  channelSearch = '';
  filterCustomerSearch = '';
  filterChannelSearch = '';
  readonly contactEmail = signal('');
  readonly emailError = signal('');

  statusOptions: Option[] = [
    { value: 'open', label: 'Open' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'pending', label: 'Pending' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'closed', label: 'Closed' },
    { value: 'canceled', label: 'Canceled' },
  ];

  priorityOptions: Option[] = [
    { value: 'low', label: 'Low' },
    { value: 'normal', label: 'Normal' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ];

  severityOptions: Option[] = [
    { value: 'minor', label: 'Minor' },
    { value: 'major', label: 'Major' },
    { value: 'critical', label: 'Critical' },
  ];

  typeOptions: Option[] = [
    { value: 'incident', label: 'Incident' },
    { value: 'request', label: 'Request' },
    { value: 'question', label: 'Question' },
    { value: 'problem', label: 'Problem' },
  ];

  filters = {
    status: '',
    priority: '',
    customerUUID: '',
    channelUUID: '',
  };

  form = {
    customerUUID: '',
    channelUUID: '',
    subject: '',
    description: '',
    status: 'open',
    priority: 'normal',
    severity: '',
    type: 'incident',
    tags: '',
    internalNotes: '',
    contactName: '',
    contactPhone: '',
    openedAt: null as Date | null,
    firstResponseAt: null as Date | null,
    resolvedAt: null as Date | null,
    closedAt: null as Date | null,
    slaPlan: '',
    slaResponseDeadline: null as Date | null,
    slaResolutionDeadline: null as Date | null,
    slaBreached: false,
    assignedToUserUUID: '',
  };

  eventForm = {
    message: '',
    isInternal: true,
  };

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly ticketFormDialog = viewChild<TemplateRef<unknown>>('ticketFormDialog');
  private ticketFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;

  private readonly initializePage = (() => {
    this.resetForm();
    void this.loadCustomers();
    void this.loadChannels();

    return true;
  })();

  private readonly afterViewReady = afterNextRender(() => {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'protocol':
          return data.SupportTicketID ?? '';
        case 'subject':
          return data.Subject ?? '';
        case 'customer':
          return this.customerLabel(data.CustomerUUID) ?? data.CustomerName ?? '';
        case 'channel':
          return this.channelLabel(data.ChannelUUID) ?? data.ChannelName ?? '';
        case 'priority':
          return data.Priority ?? '';
        case 'status':
          return data.Status ?? '';
        case 'openedAt':
          return data.OpenedAt ?? '';
        default:
          return '';
      }
    };
    this.dataSource.filterPredicate = (data, filter) => {
      let parsed: {
        q?: string;
        status?: string;
        priority?: string;
        customerUUID?: string;
        channelUUID?: string;
      };
      try {
        parsed = JSON.parse(filter || '{}');
      } catch {
        parsed = { q: filter };
      }
      const value = (parsed.q ?? '').trim().toLowerCase();
      const status = parsed.status ?? '';
      const priority = parsed.priority ?? '';
      const customerUUID = parsed.customerUUID ?? '';
      const channelUUID = parsed.channelUUID ?? '';

      if (status && data.Status !== status) return false;
      if (priority && data.Priority !== priority) return false;
      if (customerUUID && data.CustomerUUID !== customerUUID) return false;
      if (channelUUID && data.ChannelUUID !== channelUUID) return false;
      if (!value) return true;
      const customer = this.customerLabel(data.CustomerUUID) ?? data.CustomerName ?? '';
      const channel = this.channelLabel(data.ChannelUUID) ?? data.ChannelName ?? '';
      return [data.SupportTicketID, data.Subject, customer, channel]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    };
  });

  private readonly cleanupOnDestroy = inject(DestroyRef).onDestroy(() => {
    this.stopDialogViewportObserver();
    this.ticketFormDialogRef?.close();
  });

  onSearchChange(value: string) {
    this.searchInput = value;
  }

  onFilterChange() {
    return;
  }

  applySearchFilters() {
    this.search = this.searchInput.trim();
    const nextFilters = this.currentTicketFilters();
    if (this.sameTicketFilters(nextFilters, this.appliedFilters())) {
      this.ticketsResource.reload();
    } else {
      this.appliedFilters.set(nextFilters);
    }
    this.applyFilter();
  }

  clearSearchFilters() {
    this.searchInput = '';
    this.search = '';
    this.filters.status = '';
    this.filters.priority = '';
    this.filters.customerUUID = '';
    this.filters.channelUUID = '';
    const nextFilters = emptyTicketFilters();
    if (this.sameTicketFilters(nextFilters, this.appliedFilters())) {
      this.ticketsResource.reload();
    } else {
      this.appliedFilters.set(nextFilters);
    }
    this.applyFilter();
  }

  refreshList() {
    this.ticketsResource.reload();
  }

  applyFilter() {
    const payload = {
      q: this.search.trim().toLowerCase(),
      status: this.filters.status,
      priority: this.filters.priority,
      customerUUID: this.filters.customerUUID,
      channelUUID: this.filters.channelUUID,
    };
    this.dataSource.filter = JSON.stringify(payload);
    if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
  }

  customerLabel(customerUUID: string) {
    return this.customerMap.get(customerUUID)?.label ?? '';
  }

  channelLabel(channelUUID: string) {
    return this.channelMap.get(channelUUID)?.label ?? '';
  }

  statusLabel(value: string) {
    return this.statusOptions.find((opt) => opt.value === value)?.label ?? value;
  }

  priorityLabel(value: string) {
    return this.priorityOptions.find((opt) => opt.value === value)?.label ?? value;
  }

  get filteredCustomers() {
    const value = this.customerSearch.trim().toLowerCase();
    if (!value) return this.customers;
    return this.customers.filter((customer) =>
      (customer.label ?? '').toLowerCase().includes(value),
    );
  }

  get filteredChannels() {
    const value = this.channelSearch.trim().toLowerCase();
    if (!value) return this.channels;
    return this.channels.filter((channel) => (channel.label ?? '').toLowerCase().includes(value));
  }

  get filteredFilterCustomers() {
    const value = this.filterCustomerSearch.trim().toLowerCase();
    if (!value) return this.customers;
    return this.customers.filter((customer) =>
      (customer.label ?? '').toLowerCase().includes(value),
    );
  }

  get filteredFilterChannels() {
    const value = this.filterChannelSearch.trim().toLowerCase();
    if (!value) return this.channels;
    return this.channels.filter((channel) => (channel.label ?? '').toLowerCase().includes(value));
  }

  onCustomerOpened(opened: boolean) {
    if (opened) {
      this.customerSearch = '';
    }
  }

  onChannelOpened(opened: boolean) {
    if (opened) {
      this.channelSearch = '';
    }
  }

  onFilterCustomerOpened(opened: boolean) {
    if (opened) {
      this.filterCustomerSearch = '';
    }
  }

  onFilterChannelOpened(opened: boolean) {
    if (opened) {
      this.filterChannelSearch = '';
    }
  }

  async loadCustomers() {
    try {
      const res = await this.api.get<any>('erp/customers');
      const items = res?.data?.items ?? [];
      const mapped: CustomerOption[] = items.map((item: any) => ({
        value: item.CustomerUUID,
        label: item.Name,
      }));
      this.customers = mapped;
      this.customerMap = new Map(mapped.map((c: CustomerOption) => [c.value, c]));
    } catch (err) {
      console.error('Failed to load customers.', err);
    }
  }

  async loadChannels() {
    try {
      const res = await this.api.get<any>('support/ticket-channels');
      const items = res?.data?.items ?? [];
      const mapped: ChannelOption[] = items.map((item: any) => ({
        value: item.SupportTicketChannelUUID,
        label: item.Name,
      }));
      this.channels = mapped;
      this.channelMap = new Map(mapped.map((c: ChannelOption) => [c.value, c]));
    } catch (err) {
      console.error('Failed to load channels.', err);
    }
  }

  private async fetchTickets(filters: TicketFilters): Promise<Ticket[]> {
    this.error = '';
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.priority) params.set('priority', filters.priority);
    if (filters.customerUUID) params.set('customerUUID', filters.customerUUID);
    if (filters.channelUUID) params.set('channelUUID', filters.channelUUID);
    const query = params.toString();
    const res = await this.api.get<any>(`support/tickets${query ? `?${query}` : ''}`);
    return res?.data?.items ?? [];
  }

  private currentTicketFilters(): TicketFilters {
    return {
      status: this.filters.status,
      priority: this.filters.priority,
      customerUUID: this.filters.customerUUID,
      channelUUID: this.filters.channelUUID,
    };
  }

  private sameTicketFilters(left: TicketFilters, right: TicketFilters) {
    return (
      left.status === right.status &&
      left.priority === right.priority &&
      left.customerUUID === right.customerUUID &&
      left.channelUUID === right.channelUUID
    );
  }

  private resetForm() {
    this.editing = null;
    this.events = [];
    this.eventForm.message = '';
    this.eventForm.isInternal = true;
    this.contactEmail.set('');
    this.updateEmailError();
    this.form = {
      customerUUID: '',
      channelUUID: '',
      subject: '',
      description: '',
      status: 'open',
      priority: 'normal',
      severity: '',
      type: 'incident',
      tags: '',
      internalNotes: '',
      contactName: '',
      contactPhone: '',
      openedAt: null,
      firstResponseAt: null,
      resolvedAt: null,
      closedAt: null,
      slaPlan: '',
      slaResponseDeadline: null,
      slaResolutionDeadline: null,
      slaBreached: false,
      assignedToUserUUID: '',
    };
  }

  private openFormDialog() {
    const ticketFormDialog = this.ticketFormDialog();
    if (!ticketFormDialog) return;
    if (this.ticketFormDialogRef) return;
    this.ticketFormDialogRef = this.dialog.open(ticketFormDialog, {
      ...this.getDialogViewportConfig(),
      panelClass: 'support-ticket-form-dialog',
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
    });
    this.ticketFormDialogRef
      .keydownEvents()
      .pipe(takeUntil(this.ticketFormDialogRef.afterClosed()))
      .subscribe((event) => {
        if (event.key === 'Escape') this.ticketFormDialogRef?.close();
      });
    this.startDialogViewportObserver();
    this.ticketFormDialogRef.afterClosed().subscribe(() => {
      this.stopDialogViewportObserver();
      this.ticketFormDialogRef = null;
    });
  }

  closeFormDialog() {
    this.stopDialogViewportObserver();
    this.ticketFormDialogRef?.close();
    this.ticketFormDialogRef = null;
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
    if (!this.ticketFormDialogRef) return;

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
    if (!this.ticketFormDialogRef) return;
    const config = this.getDialogViewportConfig();
    const width = typeof config.width === 'string' ? config.width : '';
    const maxHeight = typeof config.maxHeight === 'string' ? config.maxHeight : '';
    this.ticketFormDialogRef.updateSize(width, maxHeight);
    if (config.position) {
      this.ticketFormDialogRef.updatePosition(config.position);
    } else {
      this.ticketFormDialogRef.updatePosition();
    }
  }

  startCreate() {
    this.resetForm();
    this.openFormDialog();
  }

  async startEdit(item: Ticket) {
    this.editing = item;
    this.form.customerUUID = item.CustomerUUID ?? '';
    this.form.channelUUID = item.ChannelUUID ?? '';
    this.form.subject = item.Subject ?? '';
    this.form.description = item.Description ?? '';
    this.form.status = item.Status ?? 'open';
    this.form.priority = item.Priority ?? 'normal';
    this.form.severity = item.Severity ?? '';
    this.form.type = item.Type ?? 'incident';
    this.form.tags = item.Tags ?? '';
    this.form.internalNotes = item.InternalNotes ?? '';
    this.form.contactName = item.ContactName ?? '';
    this.contactEmail.set(item.ContactEmail ?? '');
    this.updateEmailError();
    this.form.contactPhone = item.ContactPhone ?? '';
    this.form.openedAt = this.parseDateInput(item.OpenedAt);
    this.form.firstResponseAt = this.parseDateInput(item.FirstResponseAt);
    this.form.resolvedAt = this.parseDateInput(item.ResolvedAt);
    this.form.closedAt = this.parseDateInput(item.ClosedAt);
    this.form.slaPlan = item.SlaPlan ?? '';
    this.form.slaResponseDeadline = this.parseDateInput(item.SlaResponseDeadline);
    this.form.slaResolutionDeadline = this.parseDateInput(item.SlaResolutionDeadline);
    this.form.slaBreached = Number(item.SlaBreached ?? 0) === 1;
    this.form.assignedToUserUUID = item.AssignedToUserUUID ?? '';
    void this.loadEvents(item.SupportTicketUUID);
    this.openFormDialog();
  }

  async loadEvents(ticketUUID: string) {
    this.loadingEvents = true;
    this.eventError = '';
    let items: TicketEvent[] = [];
    let errorMessage = '';
    try {
      const res = await this.api.get<any>(`support/tickets/${ticketUUID}/events`);
      items = res?.data?.items ?? [];
    } catch (err: any) {
      errorMessage = err?.message ?? 'Failed to load events.';
    }

    this.events = items;
    this.eventError = errorMessage;
    this.loadingEvents = false;
  }

  async saveTicket(createAndNew = false) {
    if (!this.form.customerUUID) {
      this.error = 'Customer is required.';
      return;
    }

    if (!this.form.channelUUID) {
      this.error = 'Channel is required.';
      return;
    }

    if (!this.form.subject.trim()) {
      this.error = 'Subject is required.';
      return;
    }

    if (!this.form.description.trim()) {
      this.error = 'Description is required.';
      return;
    }

    this.updateEmailError();
    if (this.emailError()) {
      this.error = 'Email is invalid.';
      return;
    }

    if (this.form.contactPhone && !/^\d{8,15}$/.test(this.form.contactPhone)) {
      this.error = 'Phone must contain 8 to 15 digits.';
      return;
    }

    this.saving.set(true);
    this.error = '';

    try {
      const payload = {
        customerUUID: this.form.customerUUID,
        channelUUID: this.form.channelUUID,
        subject: this.form.subject.trim(),
        description: this.form.description.trim(),
        status: this.form.status,
        priority: this.form.priority,
        severity: this.form.severity || null,
        type: this.form.type || null,
        tags: this.form.tags?.trim() || null,
        internalNotes: this.form.internalNotes?.trim() || null,
        contactName: this.form.contactName?.trim() || null,
        contactEmail: this.contactEmail().trim() || null,
        contactPhone: this.form.contactPhone?.trim() || null,
        openedAt: this.formatDateInput(this.form.openedAt),
        firstResponseAt: this.formatDateInput(this.form.firstResponseAt),
        resolvedAt: this.formatDateInput(this.form.resolvedAt),
        closedAt: this.formatDateInput(this.form.closedAt),
        slaPlan: this.form.slaPlan?.trim() || null,
        slaResponseDeadline: this.formatDateInput(this.form.slaResponseDeadline),
        slaResolutionDeadline: this.formatDateInput(this.form.slaResolutionDeadline),
        slaBreached: this.form.slaBreached ? 1 : 0,
        assignedToUserUUID: this.form.assignedToUserUUID?.trim() || null,
      };

      if (this.editing) {
        await this.api.put(`support/tickets/${this.editing.SupportTicketUUID}`, payload);
      } else {
        await this.api.post('support/tickets', payload);
      }

      this.ticketsResource.reload();
      if (createAndNew && !this.editing) {
        this.resetForm();
      } else {
        this.closeFormDialog();
        this.resetForm();
      }
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to save ticket.';
    } finally {
      this.saving.set(false);
    }
  }

  async deleteTicket(item: Ticket) {
    const dialogRef = this.dialog.open(SlowConfirmDialogComponent, {
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
      data: {
        title: 'Delete support ticket',
        message: `Do you want to delete ticket "${item.SupportTicketID}"? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        countdownSeconds: 3,
      },
    });
    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (!confirmed) return;
    this.saving.set(true);
    this.error = '';
    try {
      await this.api.delete(`support/tickets/${item.SupportTicketUUID}`);
      this.ticketsResource.reload();
      this.resetForm();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to delete ticket.';
    } finally {
      this.saving.set(false);
    }
  }

  async addEvent() {
    if (!this.editing) return;
    if (!this.eventForm.message.trim()) {
      this.eventError = 'Message is required.';
      return;
    }

    this.loadingEvents = true;
    this.eventError = '';
    try {
      await this.api.post(`support/tickets/${this.editing.SupportTicketUUID}/events`, {
        type: 'note',
        message: this.eventForm.message.trim(),
        isInternal: this.eventForm.isInternal ? 1 : 0,
      });
      this.eventForm.message = '';
      await this.loadEvents(this.editing.SupportTicketUUID);
    } catch (err: any) {
      this.eventError = err?.message ?? 'Failed to add event.';
    } finally {
      this.loadingEvents = false;
    }
  }

  private parseDateInput(value?: string | null) {
    if (!value) return null;
    const trimmed = value.trim();
    const [datePart] = trimmed.split('T');
    if (!datePart) return null;
    const [year, month, day] = datePart.split('-').map((part) => Number(part));
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }

  private formatDateInput(value: Date | null) {
    if (!value) return null;
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  updateEmailError() {
    const value = this.contactEmail().trim();
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      this.emailError.set('Email is invalid.');
    } else {
      this.emailError.set('');
    }
  }
}
