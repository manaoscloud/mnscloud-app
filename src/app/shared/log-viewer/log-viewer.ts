import { Component, DestroyRef, ElementRef, computed, effect, inject, signal } from '@angular/core';
import { FieldInvalidDirective } from '../forms/field-invalid.directive';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { SnackbarService } from '../../services/snackbar.service';
import { hasEffectivePermission } from '../../core/guards/permission.guard';
import { PageShellComponent } from '../pages/page-shell';
import { GlobalTableComponent, defineGlobalTable } from '../crud/configurable-crud/global-table';
import { ConfigurableCrudRecord } from '../crud/configurable-crud/configurable-crud-page-base';
import { MnsSearchSelectFieldComponent } from '../forms/mns-search-select-field/mns-search-select-field';
import { openDataViewerDialog } from '../data-viewer-dialog/data-viewer-dialog';
import { ReportProblemButtonComponent } from '../support-report-dialog/report-problem-button';

type Row = Record<string, any>;
type Envelope<T> = { data: T };
type Bucket = { time: string; count: number };
const localTime = (time: number) => {
  const date = new Date(time);
  return new Date(time - date.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
};
/** Shared analytical table surface; see app.md, Global Table Component Baseline. */
@Component({
  selector: 'mns-log-viewer',
  standalone: true,
  imports: [
    FormsModule,
    FieldInvalidDirective,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    TranslocoPipe,
    PageShellComponent,
    GlobalTableComponent,
    MnsSearchSelectFieldComponent,
    ReportProblemButtonComponent,
  ],
  templateUrl: './log-viewer.html',
  styleUrl: './log-viewer.scss',
})
export class LogViewerComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);
  private readonly i18n = inject(TranslocoService);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly invalid = signal<string[]>([]);
  readonly account = signal('');
  readonly source = signal('');
  readonly dataset = signal('events');
  readonly datasetOptions = [
    { value: 'events', label: 'logs.search.events' },
    { value: 'audit', label: 'logs.search.audit' },
  ];
  readonly severity = signal<string>('');
  readonly from = signal(localTime(Date.now() - 3600000));
  readonly to = signal(localTime(Date.now()));
  readonly terms = signal('');
  private savedTerms: string[] = [];
  private savedFields: Record<string, string> = {};
  readonly viewName = signal('');
  readonly selectedView = signal('');
  readonly views = signal<Row[]>([]);
  readonly accounts = signal<Row[]>([]);
  readonly sources = signal<Row[]>([]);
  readonly rows = signal<ConfigurableCrudRecord[]>([]);
  readonly buckets = signal<Bucket[]>([]);
  readonly total = signal(0);
  readonly live = signal(false);
  readonly nextCursor = signal<string | null>(null);
  readonly previous = signal<string[]>([]);
  private currentCursor = '0';
  private searchUUID = '';
  private generation = 0;
  private environment: string | null | undefined;
  private destroyed = false;
  private timer?: ReturnType<typeof setTimeout>;
  readonly canSave = computed(() =>
    hasEffectivePermission(this.auth.user()?.permissions ?? [], 'tenant.logs.write'),
  );
  readonly accountOptions = computed(() =>
    this.accounts().map((row) => ({ value: row['LgaUUID'], label: row['LgaName'] })),
  );
  readonly sourceOptions = computed(() =>
    this.sources().map((row) => ({ value: row['LsrUUID'], label: row['LsrName'] })),
  );
  readonly viewOptions = computed(() =>
    this.views().map((row) => ({ value: row['uuid'], label: row['name'] })),
  );
  readonly levelOptions = Array.from({ length: 8 }, (_, value) => ({
    value: String(value),
    label: `logs.search.level${value}`,
  }));
  readonly maximum = computed(() => Math.max(1, ...this.buckets().map((bucket) => bucket.count)));
  readonly table = defineGlobalTable({
    key: 'logs-search',
    uuidField: 'key',
    emptyLabel: 'logs.search.empty',
    pagination: false,
    columns: [
      { id: 'ReceivedAt', field: 'ReceivedAt', label: 'logs.search.received', kind: 'datetime' },
      { id: 'Severity', field: 'Severity', label: 'logs.search.level', kind: 'number' },
      { id: 'Hostname', field: 'Hostname', label: 'logs.search.host' },
      { id: 'AppName', field: 'AppName', label: 'logs.search.application' },
      { id: 'Message', field: 'Message', label: 'logs.search.message' },
    ],
    rowActions: [
      {
        key: 'detail',
        icon: 'visibility',
        label: 'logs.search.detail',
        inline: true,
        run: (row) => {
          openDataViewerDialog(this.dialog, {
            title: 'logs.search.detail',
            description: 'logs.search.masked',
            sections: [
              { title: 'logs.search.message', code: { value: row, format: 'json', copy: false } },
            ],
          });
        },
      },
    ],
  });
  constructor() {
    effect(() => {
      const environment = this.auth.user()?.EnvironmentUUID;
      if (environment === this.environment) return;
      this.environment = environment;
      this.reset();
      this.account.set('');
      this.source.set('');
      this.dataset.set('events');
      this.severity.set('');
      this.terms.set('');
      this.savedTerms = [];
      this.savedFields = {};
      this.viewName.set('');
      this.selectedView.set('');
      this.from.set(localTime(Date.now() - 3600000));
      this.to.set(localTime(Date.now()));
      this.accounts.set([]);
      this.sources.set([]);
      this.views.set([]);
      void this.loadAccounts();
    });
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.reset();
    });
  }
  t(key: string) {
    return this.i18n.translate(key);
  }
  private reset() {
    this.generation++;
    clearTimeout(this.timer);
    this.live.set(false);
    this.loading.set(false);
    this.rows.set([]);
    this.buckets.set([]);
    this.total.set(0);
    this.searchUUID = '';
    this.nextCursor.set(null);
    this.previous.set([]);
    this.error.set('');
    this.invalid.set([]);
  }
  async loadAccounts(search = '') {
    const generation = this.generation;
    try {
      const result = await this.api.get<Envelope<{ items: Row[] }>>(
        `logs/accounts?limit=100&status=1&search=${encodeURIComponent(search)}`,
      );
      if (generation === this.generation && !this.destroyed) this.accounts.set(result.data.items);
    } catch {
      if (generation === this.generation) this.error.set('logs.search.unavailable');
    }
  }
  async chooseAccount(value: unknown) {
    this.reset();
    this.account.set(typeof value === 'string' ? value : '');
    this.source.set('');
    this.selectedView.set('');
    this.views.set([]);
    this.sources.set([]);
    if (!this.account()) return;
    const generation = this.generation;
    try {
      const [sources, views] = await Promise.all([
        this.api.get<Envelope<{ items: Row[] }>>(
          `logs/sources?accountUUID=${encodeURIComponent(this.account())}&limit=100`,
        ),
        this.api.get<Envelope<{ items: Row[] }>>(
          `logs/views?accountUUID=${encodeURIComponent(this.account())}`,
        ),
      ]);
      if (generation !== this.generation || this.destroyed) return;
      this.sources.set(sources.data.items);
      this.views.set(views.data.items);
    } catch {
      if (generation === this.generation) this.error.set('logs.search.unavailable');
    }
  }
  changeTerms(value: string) {
    this.terms.set(value);
    this.savedTerms = [];
  }
  async loadSources(search = '') {
    const generation = this.generation;
    if (!this.account()) return;
    try {
      const result = await this.api.get<Envelope<{ items: Row[] }>>(
        `logs/sources?accountUUID=${encodeURIComponent(this.account())}&limit=100&search=${encodeURIComponent(search)}`,
      );
      if (generation === this.generation && !this.destroyed) this.sources.set(result.data.items);
    } catch {
      if (generation === this.generation) this.error.set('logs.search.unavailable');
    }
  }
  private payload() {
    const enteredTerms = this.terms().trim() ? [this.terms().trim()] : [];
    return {
      dataset: this.dataset(),
      accountUUID: this.account(),
      sourceUUID: this.source() || null,
      severity: this.severity() === '' ? null : Number(this.severity()),
      from: new Date(this.from()).toISOString(),
      to: new Date(this.to()).toISOString(),
      terms: this.savedTerms.length ? this.savedTerms : enteredTerms,
      fields: this.savedFields,
      pageSize: 100,
    };
  }
  private validate(name = false) {
    const invalid: string[] = [];
    if (!this.account()) invalid.push('account');
    const from = new Date(this.from()).getTime(),
      to = new Date(this.to()).getTime();
    if (!Number.isFinite(from)) invalid.push('from');
    if (!Number.isFinite(to)) invalid.push('to');
    if (Number.isFinite(from) && Number.isFinite(to) && (to <= from || to - from > 86400000))
      invalid.push('from', 'to');
    if (name && !this.viewName().trim()) invalid.push('viewName');
    this.invalid.set(invalid);
    if (invalid.length) {
      this.snack.error('logs.search.invalid');
      this.element.nativeElement
        .querySelector<HTMLElement>(
          `[data-field="${invalid[0]}"] input, [data-field="${invalid[0]}"] mat-select`,
        )
        ?.focus();
    }
    return invalid.length === 0;
  }
  async search(tail = false) {
    if (this.loading()) return;
    if (tail) {
      this.to.set(localTime(Date.now()));
      this.from.set(localTime(Date.now() - 3600000));
    }
    if (!this.validate()) {
      this.live.set(false);
      return;
    }
    const generation = ++this.generation;
    clearTimeout(this.timer);
    this.loading.set(true);
    this.error.set('');
    this.previous.set([]);
    try {
      const result = await this.api.post<Envelope<Row>>('logs/searches', this.payload());
      if (generation !== this.generation || this.destroyed) return;
      this.searchUUID = result.data['uuid'];
      await this.waitPage(generation);
    } catch {
      if (generation === this.generation) {
        this.error.set('logs.search.unavailable');
        this.live.set(false);
      }
    } finally {
      if (generation === this.generation) {
        this.loading.set(false);
        if (this.live() && !this.destroyed)
          this.timer = setTimeout(() => void this.search(true), 5000);
      }
    }
  }
  private async waitPage(generation: number, attempt = 0): Promise<void> {
    if (generation !== this.generation || this.destroyed) return;
    if (await this.loadPage('0', generation)) return;
    if (attempt >= 59) throw new Error('Search did not complete within 60 seconds.');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await this.waitPage(generation, attempt + 1);
  }
  private async loadPage(cursor: string, generation: number) {
    const response = await this.api.get<Envelope<Row>>(
      `logs/searches/${encodeURIComponent(this.searchUUID)}?cursor=${cursor}`,
    );
    if (generation !== this.generation || this.destroyed) return true;
    const page = response.data;
    if (page['state'] === 'failed' || page['state'] === 'expired')
      throw new Error('Search failed or expired.');
    if (page['state'] !== 'complete') return false;
    this.rows.set(page['items']);
    this.total.set(page['total']);
    this.buckets.set(page['histogram']);
    this.nextCursor.set(page['nextCursor']);
    this.currentCursor = cursor;
    return true;
  }
  async page(next: boolean) {
    if (this.loading() || this.live()) return;
    const generation = this.generation;
    const history = [...this.previous()];
    const cursor = next ? this.nextCursor() : history.pop();
    if (cursor == null) return;
    if (next) history.push(this.currentCursor);
    this.loading.set(true);
    try {
      await this.loadPage(cursor, generation);
      if (generation !== this.generation || this.destroyed) return;
      this.previous.set(history);
    } catch {
      if (generation === this.generation) this.error.set('logs.search.unavailable');
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
  toggleLive() {
    this.live.set(!this.live());
    clearTimeout(this.timer);
    if (this.live()) void this.search(true);
  }
  async saveView() {
    if (!this.validate(true)) return;
    const generation = this.generation;
    const account = this.account();
    try {
      await this.api.post('logs/views', { name: this.viewName(), query: this.payload() });
      if (generation !== this.generation || this.destroyed) return;
      const result = await this.api.get<Envelope<{ items: Row[] }>>(
        `logs/views?accountUUID=${encodeURIComponent(account)}`,
      );
      if (generation !== this.generation || this.destroyed) return;
      this.views.set(result.data.items);
      this.snack.success('logs.search.saved');
    } catch {
      if (generation === this.generation) this.error.set('logs.search.unavailable');
    }
  }
  chooseView(value: unknown) {
    this.selectedView.set(typeof value === 'string' ? value : '');
    const view = this.views().find((row) => row['uuid'] === value);
    if (!view) return;
    const query = view['query'];
    this.dataset.set(query.dataset || 'events');
    const range = new Date(query.to).getTime() - new Date(query.from).getTime();
    this.from.set(localTime(Date.now() - range));
    this.to.set(localTime(Date.now()));
    this.source.set(query.sourceUUID || '');
    this.severity.set(query.severity == null ? '' : String(query.severity));
    this.savedTerms = [...(query.terms || [])];
    this.savedFields = { ...query.fields };
    this.terms.set(this.savedTerms.join(' · '));
  }
  async deleteView() {
    const view = this.views().find((row) => row['uuid'] === this.selectedView());
    if (!view) return;
    const generation = this.generation;
    try {
      await this.api.delete(`logs/views/${view['uuid']}`, { revision: view['revision'] });
      if (generation !== this.generation || this.destroyed) return;
      this.views.update((rows) => rows.filter((row) => row !== view));
      this.selectedView.set('');
    } catch {
      if (generation === this.generation) this.error.set('logs.search.unavailable');
    }
  }
}
