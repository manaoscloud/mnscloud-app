import { AfterViewInit, ChangeDetectorRef, Component, OnDestroy, OnInit, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

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
import { firstValueFrom, merge } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ApiService } from '../../../services/api.service';
import { PhoneInputComponent } from '../../../shared/phone-input/phone-input.component';
import { DateMaskDirective } from '../../../shared/date-mask/date-mask.directive';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';

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

const MIN_LOADING_MS = 600;

@Component({
    selector: 'app-support-tickets',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
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
        PhoneInputComponent,
        DateMaskDirective,
    ],
    templateUrl: './tickets.html',
    styleUrls: ['./tickets.scss'],
})
export class SupportTicketsPage implements OnInit, AfterViewInit, OnDestroy {
    private api = inject(ApiService);
    private cdr = inject(ChangeDetectorRef);
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
    loading = true;
    error = '';

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
    readonly emailControl = new FormControl('', [Validators.email]);
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

    @ViewChild(MatPaginator) paginator?: MatPaginator;
    @ViewChild(MatSort) sort?: MatSort;
    @ViewChild('ticketFormDialog') ticketFormDialog?: TemplateRef<unknown>;
    private ticketFormDialogRef: MatDialogRef<unknown> | null = null;
    private dialogViewportObserver: ResizeObserver | null = null;

    constructor() {
        merge(this.emailControl.statusChanges, this.emailControl.valueChanges)
            .pipe(takeUntilDestroyed())
            .subscribe(() => this.updateEmailError());
    }

    ngOnInit() {
        this.resetForm();
        void this.loadCustomers();
        void this.loadChannels();
        void this.loadTickets();
    }

    ngAfterViewInit() {
        this.dataSource.paginator = this.paginator ?? null;
        this.dataSource.sort = this.sort ?? null;
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
            let parsed: { q?: string; status?: string; priority?: string; customerUUID?: string; channelUUID?: string };
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

    }

    ngOnDestroy() {
        this.stopDialogViewportObserver();
        this.ticketFormDialogRef?.close();
    }

    onSearchChange(value: string) {
        this.searchInput = value;
    }

    onFilterChange() {
        return;
    }

    applySearchFilters() {
        this.search = this.searchInput.trim();
        this.applyFilter();
    }

    clearSearchFilters() {
        this.searchInput = '';
        this.search = '';
        this.filters.status = '';
        this.filters.priority = '';
        this.filters.customerUUID = '';
        this.filters.channelUUID = '';
        this.applyFilter();
    }

    refreshList() {
        void this.loadTickets();
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
        return this.customers.filter((customer) => (customer.label ?? '').toLowerCase().includes(value));
    }

    get filteredChannels() {
        const value = this.channelSearch.trim().toLowerCase();
        if (!value) return this.channels;
        return this.channels.filter((channel) => (channel.label ?? '').toLowerCase().includes(value));
    }

    get filteredFilterCustomers() {
        const value = this.filterCustomerSearch.trim().toLowerCase();
        if (!value) return this.customers;
        return this.customers.filter((customer) => (customer.label ?? '').toLowerCase().includes(value));
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
            await Promise.resolve();
            this.customers = mapped;
            this.customerMap = new Map(mapped.map((c: CustomerOption) => [c.value, c]));
            this.cdr.detectChanges();
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
            await Promise.resolve();
            this.channels = mapped;
            this.channelMap = new Map(mapped.map((c: ChannelOption) => [c.value, c]));
            this.cdr.detectChanges();
        } catch (err) {
            console.error('Failed to load channels.', err);
        }
    }

    async loadTickets() {
        const startedAt = Date.now();
        this.loading = true;
        this.error = '';
        try {
            const params = new URLSearchParams();
            if (this.filters.status) params.set('status', this.filters.status);
            if (this.filters.priority) params.set('priority', this.filters.priority);
            if (this.filters.customerUUID) params.set('customerUUID', this.filters.customerUUID);
            if (this.filters.channelUUID) params.set('channelUUID', this.filters.channelUUID);
            const query = params.toString();
            const res = await this.api.get<any>(`support/tickets${query ? `?${query}` : ''}`);
            this.tickets = res?.data?.items ?? [];
            this.dataSource.data = [...this.tickets];
            this.applyFilter();
        } catch (err: any) {
            this.error = err?.message ?? 'Failed to load tickets.';
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
        this.events = [];
        this.eventForm.message = '';
        this.eventForm.isInternal = true;
        this.emailControl.setValue('', { emitEvent: false });
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
        if (!this.ticketFormDialog) return;
        if (this.ticketFormDialogRef) return;
        this.ticketFormDialogRef = this.dialog.open(this.ticketFormDialog, {
            ...this.getDialogViewportConfig(),
            panelClass: 'support-ticket-form-dialog',
            disableClose: true,
            autoFocus: false,
            restoreFocus: true,
        });
        this.ticketFormDialogRef.keydownEvents().subscribe((event) => {
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
        this.emailControl.setValue(item.ContactEmail ?? '', { emitEvent: false });
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
        setTimeout(() => {
            void this.loadEvents(item.SupportTicketUUID);
        }, 0);
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

        setTimeout(() => {
            this.events = items;
            this.eventError = errorMessage;
            this.loadingEvents = false;
        }, 0);
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

        if (this.emailControl.value && this.emailControl.invalid) {
            this.error = 'Email is invalid.';
            return;
        }

        if (this.form.contactPhone && !/^\d{8,15}$/.test(this.form.contactPhone)) {
            this.error = 'Phone must contain 8 to 15 digits.';
            return;
        }

        this.loading = true;
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
                contactEmail: this.emailControl.value?.trim() || null,
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

            await this.loadTickets();
            if (createAndNew && !this.editing) {
                this.resetForm();
            } else {
                this.closeFormDialog();
                this.resetForm();
            }
        } catch (err: any) {
            this.error = err?.message ?? 'Failed to save ticket.';
        } finally {
            this.loading = false;
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
        this.loading = true;
        this.error = '';
        try {
            await this.api.delete(`support/tickets/${item.SupportTicketUUID}`);
            await this.loadTickets();
            this.resetForm();
        } catch (err: any) {
            this.error = err?.message ?? 'Failed to delete ticket.';
        } finally {
            this.loading = false;
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

    private updateEmailError() {
        if (this.emailControl.hasError('email')) {
            this.emailError.set('Email is invalid.');
        } else {
            this.emailError.set('');
        }
    }

}
