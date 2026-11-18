import { Component, computed, inject, resource, signal } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

import { PageShellComponent } from '../../../shared/pages/page-shell';
import { AppI18nService } from '../../../services/app-i18n.service';
import { AuthService } from '../../../services/auth.service';
import {
  RELEASE_NOTE_TYPES,
  ReleaseNote,
  ReleaseNoteDigest,
  ReleaseNoteLocale,
  ReleaseNoteService,
  releaseNotesRssUrl,
  localizedText,
  productLabel,
  releaseNoteIcon,
} from '../../../services/release-note.service';

type Scope = 'mine' | 'all';
type Status = 'live' | 'pending';

/** Module family of a note code: `module.hosting.vps.firewall` → `module.hosting`. */
export function moduleFamily(code: string) {
  return code === 'platform' ? code : code.split('.').slice(0, 2).join('.');
}

/**
 * What changed in the platform (App › Novidades), one entry per feature, shown only when every
 * component of the feature is deployed in this environment (DEV shows DEV, PROD shows PROD).
 * Tenants see platform notes and the modules they contract ("All modules" shows the rest). The
 * "Coming soon" tab lists entries received but not deployed here yet (never security ones, except
 * for the platform master, who also sees each component marked deployed or not). The same page serves the public
 * changelog (`/release-notes`, `data.publicFeed`, every module, no sign-in) with its RSS feed;
 * signed-in users can turn on the weekly e-mail digest. Contract: workspace docs/release-notes.md;
 * the API decides what exists and what is visible.
 */
@Component({
  selector: 'app-release-notes',
  standalone: true,
  imports: [
    PageShellComponent,
    MatButtonToggleModule,
    MatChipsModule,
    MatIconModule,
    MatSlideToggleModule,
    MatTabsModule,
    RouterLink,
    TranslocoPipe,
  ],
  templateUrl: './release-notes.html',
  styleUrl: './release-notes.scss',
})
export class ReleaseNotesPage {
  private readonly i18n = inject(AppI18nService);
  private readonly notes = inject(ReleaseNoteService);
  private readonly auth = inject(AuthService);
  /** Public changelog route (`/release-notes`): every module, no sign-in, no digest. */
  readonly publicFeed = inject(ActivatedRoute).snapshot.data['publicFeed'] === true;

  readonly isMaster = computed(
    () =>
      !this.publicFeed && (this.auth.user()?.permissions ?? []).includes('platform.master.access'),
  );
  readonly scope = signal<Scope>('mine');
  /** `?tab=upcoming` (link of the "idea being deployed" notice) opens the coming soon tab. */
  readonly status = signal<Status>(
    inject(ActivatedRoute).snapshot.queryParamMap.get('tab') === 'upcoming' ? 'pending' : 'live',
  );
  readonly module = signal<string>('');
  readonly type = signal<string>('');
  readonly types = RELEASE_NOTE_TYPES;

  readonly entries = resource({
    params: () => ({ scope: this.scope(), status: this.status() }),
    defaultValue: [] as ReleaseNote[],
    loader: ({ params }) => (this.publicFeed ? this.notes.publicList() : this.notes.list(params)),
  });

  readonly loading = computed(() => this.entries.isLoading());
  readonly failed = computed(() => this.entries.status() === 'error');
  /** Modules present in the loaded entries, one per family (`module.hosting`), for the filter. */
  readonly modules = computed(() =>
    [...new Set(this.entries.value().flatMap((entry) => entry.modules.map(moduleFamily)))].sort(
      (a, b) => this.moduleLabel(a).localeCompare(this.moduleLabel(b)),
    ),
  );
  readonly items = computed(() =>
    this.entries
      .value()
      .filter(
        (entry) =>
          !this.module() || entry.modules.some((code) => moduleFamily(code) === this.module()),
      )
      .filter((entry) => !this.type() || entry.type === this.type()),
  );

  readonly digest = resource({
    params: () => (this.publicFeed ? undefined : true),
    loader: () => this.notes.digest(),
  });
  readonly digestSaving = signal(false);

  readonly rssUrl = computed(() => releaseNotesRssUrl(this.i18n.language(), this.module()));

  reload() {
    this.entries.reload();
    if (!this.publicFeed) this.digest.reload();
  }

  async toggleDigest(enabled: boolean) {
    const current = this.digest.value();
    this.digestSaving.set(true);
    try {
      const saved = await this.notes.saveDigest({
        enabled,
        locale: this.i18n.language() as ReleaseNoteLocale,
        scope: current?.scope ?? 'mine',
      });
      this.digest.set(saved as ReleaseNoteDigest);
    } finally {
      this.digestSaving.set(false);
    }
  }

  setScope(scope: Scope) {
    this.module.set('');
    this.scope.set(scope);
  }

  setStatus(index: number) {
    this.module.set('');
    this.status.set(index === 1 ? 'pending' : 'live');
  }

  title(entry: ReleaseNote) {
    return localizedText(entry.title, this.i18n.language());
  }

  text(entry: ReleaseNote) {
    return localizedText(entry.text, this.i18n.language());
  }

  action(entry: ReleaseNote) {
    return localizedText(entry.action, this.i18n.language());
  }

  icon(entry: ReleaseNote) {
    return releaseNoteIcon(entry.type);
  }

  product(product: string) {
    return productLabel(product);
  }

  /** `module.dns` → the DNS menu name; `platform` → Platform. Family name only (filter chips). */
  moduleLabel(code: string) {
    if (code === 'platform') return this.i18n.t('releaseNotes.platform');
    const family = moduleFamily(code).replace(/^module\./, '');
    return this.navLabel(family) ?? family;
  }

  /**
   * Module tags of one card: family plus the sub-module menu name when it has one
   * (`module.hosting.vps.firewall` → "Hospedagem › VPS"), each tag once.
   */
  entryModules(entry: ReleaseNote) {
    return [...new Set(entry.modules.map((code) => this.moduleDetailLabel(code)))];
  }

  private moduleDetailLabel(code: string) {
    const family = this.moduleLabel(code);
    const [, sub] = code.replace(/^module\./, '').split('.');
    if (code === 'platform' || !sub) return family;
    const subLabel = this.navLabel(`${moduleFamily(code).replace(/^module\./, '')}.${sub}`);
    return subLabel ? `${family} › ${subLabel}` : family;
  }

  private navLabel(path: string) {
    const key = `nav.${path}`;
    const label = this.i18n.t(key);
    return label && label !== key ? label : null;
  }

  date(entry: ReleaseNote) {
    const value = entry.publishedAt ?? entry.createdAt;
    if (!value) return '';
    const date = new Date(value.replace(' ', 'T'));
    return Number.isNaN(date.getTime())
      ? ''
      : new Intl.DateTimeFormat(this.i18n.language(), { dateStyle: 'long' }).format(date);
  }
}
