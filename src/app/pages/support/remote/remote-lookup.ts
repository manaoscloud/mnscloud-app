import {
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';

import { ApiService } from '../../../services/api.service';
import {
  MnsSearchSelectFieldComponent,
  MnsSearchSelectFieldOption,
} from '../../../shared/forms/mns-search-select-field/mns-search-select-field';
import { RemoteRecord, text, unwrap } from './remote-session';

export type RemoteLookupSpec = {
  endpoint: string;
  uuidField: string;
  labelField: string;
};

/** Lookups of the support remote forms (same endpoints and fields the CRUD pages use). */
export const REMOTE_LOOKUPS = {
  customer: { endpoint: 'registry/customers', uuidField: 'CustomerUUID', labelField: 'Name' },
  ticket: { endpoint: 'support/tickets', uuidField: 'SupportTicketUUID', labelField: 'Subject' },
  user: { endpoint: 'user/access/members', uuidField: 'UserUUID', labelField: 'Name' },
  device: { endpoint: 'network/devices', uuidField: 'NwdUUID', labelField: 'NwdName' },
} as const satisfies Record<string, RemoteLookupSpec>;

const PAGE_SIZE = 50;

/**
 * Search-select over a list endpoint (search + paging by the API), for forms that are not CRUD
 * pages. The value is a UUID, or a UUID list with `multiple`.
 */
@Component({
  selector: 'mns-remote-lookup',
  standalone: true,
  imports: [MnsSearchSelectFieldComponent],
  template: `
    <mns-search-select-field
      [label]="label()"
      [options]="options()"
      [value]="value()"
      [multiple]="multiple()"
      [clearable]="!multiple() && !required()"
      [remoteSearch]="true"
      [loading]="loading()"
      [loadError]="failed()"
      [hasNext]="hasNext()"
      [hasPrevious]="page() > 0"
      [invalid]="invalid()"
      (valueChange)="valueChange.emit($event)"
      (searchChange)="search($event)"
      (pageChange)="move($event)"
      (openedChange)="opened($event)"
    />
  `,
})
export class RemoteLookupComponent {
  readonly label = input.required<string>();
  readonly spec = input.required<RemoteLookupSpec>();
  readonly value = input<string | readonly string[]>('');
  readonly multiple = input(false);
  readonly required = input(false);
  readonly invalid = input(false);
  /** UUIDs to hide (already members, already added). */
  readonly exclude = input<readonly string[]>([]);
  readonly valueChange = output<string | readonly string[] | null | unknown>();

  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  readonly options = signal<readonly MnsSearchSelectFieldOption[]>([]);
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly hasNext = signal(false);
  readonly page = signal(0);
  private term = '';
  private loadedOnce = false;
  private sequence = 0;
  private readonly known = new Map<string, string>();

  constructor() {
    // Loads the first page once the inputs exist (and again if the lookup changes).
    effect(() => {
      this.spec();
      untracked(() => void this.load());
    });
  }

  opened(open: boolean) {
    if (open && !this.loadedOnce) void this.load();
  }

  search(term: string) {
    this.term = term;
    this.page.set(0);
    void this.load();
  }

  move(delta: number) {
    this.page.update((page) => Math.max(0, page + delta));
    void this.load();
  }

  private async load() {
    const ticket = ++this.sequence;
    const spec = this.spec();
    const separator = spec.endpoint.includes('?') ? '&' : '?';
    this.loading.set(true);
    this.failed.set(false);
    try {
      const response = await this.api.get<unknown>(
        `${spec.endpoint}${separator}limit=${PAGE_SIZE}&offset=${this.page() * PAGE_SIZE}&search=${encodeURIComponent(this.term)}`,
        { silent: true },
      );
      if (ticket !== this.sequence || this.destroyRef.destroyed) return;
      const body = unwrap<{ items?: RemoteRecord[]; total?: number }>(response);
      const hidden = new Set(this.exclude());
      const page = (body?.items ?? [])
        .map((item) => ({
          value: text(item[spec.uuidField]),
          label: text(item[spec.labelField]) || text(item[spec.uuidField]),
        }))
        .filter((option) => option.value && !hidden.has(option.value));
      for (const option of page) this.known.set(option.value, option.label);
      // A chosen value stays listed when it is not on the current page.
      const chosen = ([] as unknown[])
        .concat(this.value())
        .map(text)
        .filter((uuid) => uuid && !page.some((option) => option.value === uuid));
      this.options.set([
        ...chosen.map((uuid) => ({ value: uuid, label: this.known.get(uuid) ?? uuid })),
        ...page,
      ]);
      this.hasNext.set((this.page() + 1) * PAGE_SIZE < Number(body?.total ?? 0));
      this.loadedOnce = true;
    } catch {
      if (ticket === this.sequence) this.failed.set(true);
    } finally {
      if (ticket === this.sequence) this.loading.set(false);
    }
  }
}
