import { AfterViewInit, Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';

type AttendanceStatus = 'automation' | 'waiting' | 'serving';

type AttendanceItem = {
  ConversationUUID?: string;
  Status?: string;
  Stage?: string;
  Name?: string;
  ContactName?: string;
  Identifier?: string;
  Channel?: string;
  Source?: string;
  Sector?: string;
  AssignedTo?: string | null;
  LastMessageAt?: string | null;
  QueueEnteredAt?: string | null;
  Priority?: string | null;
  Identified?: boolean;
};

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  automation: 'In Automation',
  waiting: 'Waiting for Agent',
  serving: 'In Service',
};

@Component({
  selector: 'app-support-attendance',
  standalone: true,
  imports: [
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    DatePipe,
  ],
  templateUrl: './attendance.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./attendance.scss'],
})
export class SupportAttendancePage implements AfterViewInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  items: AttendanceItem[] = [];
  loading = false;
  error = '';
  actionLoadingId: string | null = null;

  filters = {
    search: '',
    channel: '',
    sector: '',
    agent: '',
  };

  channelOptions: string[] = [];
  sectorOptions: string[] = [];
  agentOptions: string[] = [];

  lanes: Record<AttendanceStatus, AttendanceItem[]> = {
    automation: [],
    waiting: [],
    serving: [],
  };
  laneOrder: AttendanceStatus[] = ['automation', 'waiting', 'serving'];

  ngAfterViewInit() {
    setTimeout(() => {
      this.loadAttendance();
    }, 0);
  }

  statusLabel(status: AttendanceStatus) {
    return STATUS_LABELS[status];
  }

  trackByConversation(index: number, item: AttendanceItem) {
    return item.ConversationUUID ?? item.Identifier ?? item.Name ?? index;
  }

  onSearchChange(value: string) {
    this.filters.search = value;
    this.applyFilters();
  }

  onFilterChange() {
    this.applyFilters();
  }

  clearFilters() {
    this.filters = { search: '', channel: '', sector: '', agent: '' };
    this.applyFilters();
  }

  async loadAttendance() {
    this.loading = true;
    this.error = '';
    try {
      const res = await this.api.get<any>('support/attendance');
      this.items = res?.data?.items ?? [];
      this.updateFilterOptions();
      this.applyFilters();
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Failed to load attendance.';
    } finally {
      this.loading = false;
    }
  }

  laneItems(status: AttendanceStatus) {
    return this.lanes[status];
  }

  displayName(item: AttendanceItem) {
    return item.ContactName || item.Name || item.Identifier || 'Guest';
  }

  displayChannel(item: AttendanceItem) {
    return item.Channel || item.Source || 'Unknown channel';
  }

  displaySector(item: AttendanceItem) {
    return item.Sector || 'No sector';
  }

  displayAgent(item: AttendanceItem) {
    return item.AssignedTo || 'Unassigned';
  }

  displayQueueTime(item: AttendanceItem) {
    return item.QueueEnteredAt || item.LastMessageAt || null;
  }

  statusOf(item: AttendanceItem): AttendanceStatus {
    return this.resolveStatus(item);
  }

  canAssign(item: AttendanceItem) {
    const name = this.currentUserName();
    if (!name) return false;
    return item.AssignedTo !== name;
  }

  assignToMe(item: AttendanceItem) {
    const name = this.currentUserName();
    if (!name) {
      this.error = 'Unable to assign: user profile not loaded.';
      return;
    }

    this.actionLoadingId = this.itemKey(item);
    item.AssignedTo = name;
    item.Status = 'serving';
    item.Stage = 'serving';
    this.applyFilters();
    this.actionLoadingId = null;
  }

  moveTo(item: AttendanceItem, status: AttendanceStatus) {
    this.actionLoadingId = this.itemKey(item);
    item.Status = status;
    item.Stage = status;
    if (status !== 'serving') {
      item.AssignedTo = null;
    }
    this.applyFilters();
    this.actionLoadingId = null;
  }

  closeConversation(item: AttendanceItem) {
    this.actionLoadingId = this.itemKey(item);
    this.items = this.items.filter((entry) => entry !== item);
    this.applyFilters();
    this.actionLoadingId = null;
  }

  private updateFilterOptions() {
    this.channelOptions = this.uniqueValues(this.items.map((item) => this.displayChannel(item)));
    this.sectorOptions = this.uniqueValues(
      this.items.map((item) => item.Sector).filter(Boolean) as string[],
    );
    this.agentOptions = this.uniqueValues(
      this.items.map((item) => item.AssignedTo).filter(Boolean) as string[],
    );
  }

  private uniqueValues(values: string[]) {
    return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }

  private applyFilters() {
    const search = this.filters.search.trim().toLowerCase();
    const channel = this.filters.channel;
    const sector = this.filters.sector;
    const agent = this.filters.agent;

    const filtered = this.items.filter((item) => {
      const name = this.displayName(item).toLowerCase();
      const ch = this.displayChannel(item);
      const sec = item.Sector || '';
      const ag = item.AssignedTo || '';

      if (channel && ch !== channel) return false;
      if (sector && sec !== sector) return false;
      if (agent && ag !== agent) return false;

      if (search) {
        const haystack = [name, ch, sec, ag, item.Identifier]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      return true;
    });

    const lanes: Record<AttendanceStatus, AttendanceItem[]> = {
      automation: [],
      waiting: [],
      serving: [],
    };

    for (const item of filtered) {
      const status = this.resolveStatus(item);
      lanes[status].push(item);
    }

    this.lanes = lanes;
  }

  private resolveStatus(item: AttendanceItem): AttendanceStatus {
    const raw = `${item.Status ?? ''} ${item.Stage ?? ''}`.toLowerCase();

    if (raw.includes('automation') || raw.includes('auto') || raw.includes('bot')) {
      return 'automation';
    }
    if (raw.includes('wait') || raw.includes('queue') || raw.includes('pending')) {
      return 'waiting';
    }
    if (
      raw.includes('service') ||
      raw.includes('attendance') ||
      raw.includes('serving') ||
      raw.includes('active')
    ) {
      return 'serving';
    }

    if (item.AssignedTo) return 'serving';
    if (item.Sector || item.Identified) return 'waiting';
    return 'automation';
  }

  itemKey(item: AttendanceItem) {
    return item.ConversationUUID ?? item.Identifier ?? item.Name ?? '';
  }

  private currentUserName() {
    const user = this.auth.user();
    if (!user) return '';
    return `${user.firstName} ${user.lastName}`.trim() || user.email;
  }
}
