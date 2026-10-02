import { Component, DestroyRef, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../services/api.service';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';

// crud-template-exempt: Master retention operations panel (dry-run counters, batch purge,
// storage scan and database maintenance) embedded in Parameters; not a resource CRUD list.

type RetentionRow = {
  key: string;
  kind: 'active' | 'orphan';
  orphanType: string | null;
  customerName: string | null;
  tenantName: string | null;
  serverName: string | null;
  pabxName: string | null;
  pabxDeletedAt: string | null;
  cdrDays: number;
  cdrSource: string;
  recordingDays: number;
  recordingSource: string;
  expiredCdrs: number;
  totalCdrs: number | null;
  expiredRecordings: number;
  totalRecordings: number | null;
  localOnlyRecordings: number;
};

type RetentionSummary = {
  totalPabxs: number;
  expiredCdrs: number;
  expiredRecordings: number;
  orphanRetentionDays: number;
  orphanCdrs: number;
  expiredOrphanCdrs: number;
  orphanRecordings: number;
  expiredOrphanRecordings: number;
  localOnlyOrphanRecordings: number;
  estimatedExpiredOrphanBytes: number;
};

type PurgeTotals = {
  purgedCdrs: number;
  purgedRecordings: number;
  purgedOrphanCdrs: number;
  purgedOrphanRecordings: number;
  errorsCount: number;
  rounds: number;
  running: boolean;
  stopped: boolean;
};

type StorageScanTarget = {
  tenantName: string | null;
  tenantUUID: string;
  storageAccountName: string | null;
  scannedObjects: number;
  scannedBytes: number;
  unreferencedObjects: number;
  unreferencedBytes: number;
  samples: Array<{ key: string; size: number }>;
  truncated: boolean;
  error: string | null;
};

type MaintenanceTable = {
  table: string;
  estimatedRows?: number;
  dataBytes?: number;
  indexBytes?: number;
  reclaimableBytes?: number;
  fileBytes?: number | null;
  fileBytesAfter?: number | null;
  reclaimedBytes?: number | null;
  status?: string;
  message?: string;
};

type MaintenanceJob = {
  jobUUID: string;
  agentName: string | null;
  action: string;
  status: string;
  progressPercent: number | null;
  progressMessage: string | null;
  errorMessage: string | null;
  createdAt: string | null;
  finishedAt: string | null;
  result: {
    freeBytesBefore?: number | null;
    freeBytesAfter?: number | null;
    totalReclaimedBytes?: number;
    tables?: MaintenanceTable[];
  } | null;
};

const ACTIVE_JOB_STATES = new Set(['pending', 'leased', 'running']);
const MAX_PURGE_ROUNDS = 500;

@Component({
  selector: 'mns-voip-pabx-retention-operations',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatButtonToggleModule,
    MatChipsModule,
    MatIconModule,
    MatProgressBarModule,
    MatSlideToggleModule,
    MatTableModule,
    TranslocoPipe,
  ],
  templateUrl: './retention-operations.html',
  styleUrls: ['./retention-operations.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class VoipPabxRetentionOperationsComponent {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  private readonly translation = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);
  private pollTimer?: ReturnType<typeof setTimeout>;
  private destroyed = false;

  readonly analyzing = signal(false);
  readonly purging = signal(false);
  readonly scanning = signal(false);
  readonly maintenanceBusy = signal(false);
  readonly feedback = signal<string | null>(null);
  readonly includeOrphans = signal(false);
  readonly stopRequested = signal(false);
  readonly filter = signal<'all' | 'active' | 'orphan'>('all');
  readonly summary = signal<RetentionSummary | null>(null);
  readonly rows = signal<RetentionRow[]>([]);
  readonly purgeTotals = signal<PurgeTotals | null>(null);
  readonly scan = signal<{
    targets: StorageScanTarget[];
    summary: {
      scannedObjects: number;
      scannedBytes: number;
      unreferencedObjects: number;
      unreferencedBytes: number;
      truncated: boolean;
      failedTargets: number;
    };
  } | null>(null);
  readonly maintenanceJobs = signal<MaintenanceJob[]>([]);
  readonly maintenanceAgents = signal<Array<{ agentName: string | null }>>([]);
  readonly maintenanceLoaded = signal(false);

  readonly busy = computed(
    () => this.analyzing() || this.purging() || this.scanning() || this.maintenanceBusy(),
  );
  readonly visibleRows = computed(() => {
    const mode = this.filter();
    return mode === 'all' ? this.rows() : this.rows().filter((row) => row.kind === mode);
  });
  readonly latestJob = computed(() => this.maintenanceJobs()[0] ?? null);
  readonly maintenanceActive = computed(() => {
    const job = this.latestJob();
    return !!job && ACTIVE_JOB_STATES.has(job.status);
  });
  readonly columns = [
    'customer',
    'pabx',
    'cdrRetention',
    'recRetention',
    'expiredCdrs',
    'expiredRecs',
  ];
  readonly scanColumns = ['tenant', 'storage', 'scanned', 'unreferenced'];
  readonly tableColumns = ['table', 'size', 'reclaimable', 'outcome'];

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      clearTimeout(this.pollTimer);
    });
    void this.loadMaintenance();
  }

  private t(key: string): string {
    return this.translation.translate(key);
  }

  private friendlyError(error: unknown, fallback: string): string {
    const message = (error as any)?.error?.error;
    return this.t(typeof message === 'string' && message.trim() ? message : fallback);
  }

  formatBytes(value: number | null | undefined): string {
    const bytes = Number(value ?? 0);
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const scaled = bytes / 1024 ** exponent;
    return `${scaled.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
  }

  retentionSourceLabel(source: string): string {
    const labels: Record<string, string> = {
      pabx: 'PABX',
      tenant: 'Tenant',
      global: 'Global',
      orphan: 'Orphan grace',
    };
    return labels[source] ?? 'Keep forever';
  }

  orphanTypeLabel(type: string | null): string {
    const labels: Record<string, string> = {
      pabx_deleted: 'PABX deleted',
      pabx_missing: 'PABX missing',
      no_pabx: 'No PABX',
    };
    return labels[type ?? ''] ?? 'Orphan';
  }

  async analyze(): Promise<void> {
    if (this.busy()) return;
    this.analyzing.set(true);
    this.feedback.set(null);
    try {
      await this.loadAnalysis();
    } catch (err) {
      this.feedback.set(this.friendlyError(err, 'Failed to analyze retention policies.'));
    } finally {
      this.analyzing.set(false);
    }
  }

  private async loadAnalysis(): Promise<void> {
    const res = await this.api.post<any>('system/voip/pabx/retention/analyze', {});
    const data = res?.data ?? {};
    const items: any[] = Array.isArray(data?.items) ? data.items : [];
    const orphans: any[] = Array.isArray(data?.orphans) ? data.orphans : [];
    const grace = Number(data?.summary?.orphanRetentionDays ?? 0);
    this.summary.set({
      totalPabxs: Number(data?.summary?.totalPabxCount ?? items.length),
      expiredCdrs: Number(data?.summary?.totalExpiredCdrs ?? 0),
      expiredRecordings: Number(data?.summary?.totalExpiredRecordings ?? 0),
      orphanRetentionDays: grace,
      orphanCdrs: Number(data?.summary?.totalOrphanCdrs ?? 0),
      expiredOrphanCdrs: Number(data?.summary?.totalExpiredOrphanCdrs ?? 0),
      orphanRecordings: Number(data?.summary?.totalOrphanRecordings ?? 0),
      expiredOrphanRecordings: Number(data?.summary?.totalExpiredOrphanRecordings ?? 0),
      localOnlyOrphanRecordings: Number(data?.summary?.totalLocalOnlyOrphanRecordings ?? 0),
      estimatedExpiredOrphanBytes: Number(data?.summary?.estimatedExpiredOrphanCdrBytes ?? 0),
    });
    this.rows.set([
      ...items.map((row): RetentionRow => ({
        key: `active:${row?.pabxUUID}`,
        kind: 'active',
        orphanType: null,
        customerName: row?.customerName ? String(row.customerName) : null,
        tenantName: null,
        serverName: null,
        pabxName: String(row?.pabxName ?? ''),
        pabxDeletedAt: null,
        cdrDays: Number(row?.effectiveCdrRetentionDays ?? 0),
        cdrSource: String(row?.cdrRetentionSource ?? 'disabled'),
        recordingDays: Number(row?.effectiveRecordingRetentionDays ?? 0),
        recordingSource: String(row?.recordingRetentionSource ?? 'disabled'),
        expiredCdrs: Number(row?.expiredCdrCount ?? 0),
        totalCdrs: null,
        expiredRecordings: Number(row?.expiredRecordingCount ?? 0),
        totalRecordings: null,
        localOnlyRecordings: 0,
      })),
      ...orphans.map((row, index): RetentionRow => ({
        key: `orphan:${row?.orphanType}:${row?.pabxUUID ?? ''}:${row?.serverUUID ?? ''}:${index}`,
        kind: 'orphan',
        orphanType: String(row?.orphanType ?? ''),
        customerName: row?.customerName ? String(row.customerName) : null,
        tenantName: row?.tenantName ? String(row.tenantName) : null,
        serverName: row?.serverName ? String(row.serverName) : null,
        pabxName: row?.pabxName ? String(row.pabxName) : null,
        pabxDeletedAt: row?.pabxDeletedAt ? String(row.pabxDeletedAt) : null,
        cdrDays: grace,
        cdrSource: grace > 0 ? 'orphan' : 'disabled',
        recordingDays: grace,
        recordingSource: grace > 0 ? 'orphan' : 'disabled',
        expiredCdrs: Number(row?.expiredCdrCount ?? 0),
        totalCdrs: Number(row?.cdrCount ?? 0),
        expiredRecordings: Number(row?.expiredRecordingCount ?? 0),
        totalRecordings: Number(row?.recordingCount ?? 0),
        localOnlyRecordings: Number(row?.localOnlyRecordingCount ?? 0),
      })),
    ]);
  }

  async purge(): Promise<void> {
    if (this.busy()) return;
    const summary = this.summary();
    const includeOrphans = this.includeOrphans();
    let message = this.t(
      'Permanently delete expired CDRs and call recordings across all active retention policies? This action is irreversible.',
    );
    if (includeOrphans) {
      message += ` ${this.t('Orphan records past the grace period are included')}: ${
        summary?.expiredOrphanCdrs ?? 0
      } CDRs, ${summary?.expiredOrphanRecordings ?? 0} ${this.t('recordings')}.`;
    }
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      width: '440px',
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
      data: {
        title: this.t('Purge expired VoIP data'),
        message,
        confirmLabel: this.t('Purge expired data'),
        translate: false,
      },
    });
    if (!(await firstValueFrom(ref.afterClosed()))) return;

    this.purging.set(true);
    this.stopRequested.set(false);
    this.feedback.set(null);
    const totals: PurgeTotals = {
      purgedCdrs: 0,
      purgedRecordings: 0,
      purgedOrphanCdrs: 0,
      purgedOrphanRecordings: 0,
      errorsCount: 0,
      rounds: 0,
      running: true,
      stopped: false,
    };
    this.purgeTotals.set({ ...totals });
    let idleRounds = 0;
    try {
      // Each call works for a bounded time; keep calling while the API reports more work.
      while (totals.rounds < MAX_PURGE_ROUNDS) {
        if (this.stopRequested() || this.destroyed) {
          totals.stopped = true;
          break;
        }
        const res = await this.api.post<any>('system/voip/pabx/retention/purge', {
          includeOrphans,
        });
        const data = res?.data ?? {};
        const round =
          Number(data?.purgedCdrsCount ?? 0) +
          Number(data?.purgedRecordingsCount ?? 0) +
          Number(data?.purgedOrphanCdrsCount ?? 0) +
          Number(data?.purgedOrphanRecordingsCount ?? 0);
        totals.rounds++;
        totals.purgedCdrs += Number(data?.purgedCdrsCount ?? 0);
        totals.purgedRecordings += Number(data?.purgedRecordingsCount ?? 0);
        totals.purgedOrphanCdrs += Number(data?.purgedOrphanCdrsCount ?? 0);
        totals.purgedOrphanRecordings += Number(data?.purgedOrphanRecordingsCount ?? 0);
        totals.errorsCount += Number(data?.failedRecordingsCount ?? 0);
        this.purgeTotals.set({ ...totals });
        idleRounds = round === 0 ? idleRounds + 1 : 0;
        if (!data?.hasMore || idleRounds >= 3) break;
      }
    } catch (err) {
      this.feedback.set(this.friendlyError(err, 'Failed to execute retention purge.'));
    } finally {
      totals.running = false;
      this.purgeTotals.set({ ...totals });
      this.purging.set(false);
    }
    await this.analyze();
  }

  stopPurge(): void {
    this.stopRequested.set(true);
  }

  async scanStorage(): Promise<void> {
    if (this.busy()) return;
    this.scanning.set(true);
    this.feedback.set(null);
    try {
      const res = await this.api.post<any>('system/voip/pabx/retention/storage-scan', {});
      const data = res?.data ?? {};
      const summary = data?.summary ?? {};
      this.scan.set({
        targets: (Array.isArray(data?.targets) ? data.targets : []).map(
          (target: any): StorageScanTarget => ({
            tenantName: target?.tenantName ? String(target.tenantName) : null,
            tenantUUID: String(target?.tenantUUID ?? ''),
            storageAccountName: target?.storageAccountName
              ? String(target.storageAccountName)
              : null,
            scannedObjects: Number(target?.scannedObjects ?? 0),
            scannedBytes: Number(target?.scannedBytes ?? 0),
            unreferencedObjects: Number(target?.unreferencedObjects ?? 0),
            unreferencedBytes: Number(target?.unreferencedBytes ?? 0),
            samples: Array.isArray(target?.samples) ? target.samples : [],
            truncated: Boolean(target?.truncated),
            error: target?.error ? String(target.error) : null,
          }),
        ),
        summary: {
          scannedObjects: Number(summary?.scannedObjects ?? 0),
          scannedBytes: Number(summary?.scannedBytes ?? 0),
          unreferencedObjects: Number(summary?.unreferencedObjects ?? 0),
          unreferencedBytes: Number(summary?.unreferencedBytes ?? 0),
          truncated: Boolean(summary?.truncated),
          failedTargets: Number(summary?.failedTargets ?? 0),
        },
      });
    } catch (err) {
      this.feedback.set(this.friendlyError(err, 'Failed to scan recording storage.'));
    } finally {
      this.scanning.set(false);
    }
  }

  private async loadMaintenance(): Promise<void> {
    try {
      const res = await this.api.get<any>('system/database/maintenance/jobs?limit=5');
      const data = res?.data ?? {};
      this.maintenanceJobs.set(
        (Array.isArray(data?.items) ? data.items : []).map((job: any): MaintenanceJob => ({
          jobUUID: String(job?.jobUUID ?? ''),
          agentName: job?.agentName ? String(job.agentName) : null,
          action: String(job?.action ?? ''),
          status: String(job?.status ?? ''),
          progressPercent: job?.progressPercent != null ? Number(job.progressPercent) : null,
          progressMessage: job?.progressMessage ? String(job.progressMessage) : null,
          errorMessage: job?.errorMessage ? String(job.errorMessage) : null,
          createdAt: job?.createdAt ? String(job.createdAt) : null,
          finishedAt: job?.finishedAt ? String(job.finishedAt) : null,
          result: job?.result && typeof job.result === 'object' ? job.result : null,
        })),
      );
      this.maintenanceAgents.set(Array.isArray(data?.agents) ? data.agents : []);
    } catch {
      // The panel stays usable for retention even when maintenance is unavailable.
      this.maintenanceAgents.set([]);
    } finally {
      this.maintenanceLoaded.set(true);
    }
    this.schedulePoll();
  }

  private schedulePoll(): void {
    clearTimeout(this.pollTimer);
    if (this.destroyed || !this.maintenanceActive()) return;
    this.pollTimer = setTimeout(() => void this.loadMaintenance(), 10_000);
  }

  async queueMaintenance(action: 'inspect' | 'optimize'): Promise<void> {
    if (this.busy() || this.maintenanceActive()) return;
    if (action === 'optimize') {
      const ref = this.dialog.open(SlowConfirmDialogComponent, {
        width: '440px',
        panelClass: 'slow-confirm-dialog',
        disableClose: true,
        data: {
          title: 'Compact database tables',
          message:
            'Rebuild the call history tables online so space freed by purges returns to the disk? The Agent skips any table without enough free disk. Large tables can take a long time.',
          confirmLabel: 'Compact tables',
          translate: true,
        },
      });
      if (!(await firstValueFrom(ref.afterClosed()))) return;
    }
    this.maintenanceBusy.set(true);
    this.feedback.set(null);
    try {
      await this.api.post<any>('system/database/maintenance/jobs', { action });
      await this.loadMaintenance();
    } catch (err) {
      this.feedback.set(this.friendlyError(err, 'Failed to queue database maintenance.'));
    } finally {
      this.maintenanceBusy.set(false);
    }
  }
}
