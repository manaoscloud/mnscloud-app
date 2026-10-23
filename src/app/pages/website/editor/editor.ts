import { Component, ViewEncapsulation, computed, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

import { apiErrorFields } from '../../../services/api-error-fields';
import { SnackbarService } from '../../../services/snackbar.service';
import { BreadcrumbLabelsService } from '../../../shared/breadcrumb/breadcrumb-labels.service';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { FieldHelpComponent } from '../../../shared/forms/field-help';
import { FieldInvalidDirective } from '../../../shared/forms/field-invalid.directive';
import { injectRevealInvalidFields } from '../../../shared/forms/reveal-invalid-fields';
import { MnsSearchSelectFieldComponent } from '../../../shared/forms/mns-search-select-field/mns-search-select-field';
import { PageShellComponent } from '../../../shared/pages/page-shell';
import {
  REQUIRED_MESSAGE,
  WEBSITE_LOCALE_OPTIONS,
  WEBSITE_SECTION_TYPES_WITH_ITEMS,
  WEBSITE_SECTION_TYPE_OPTIONS,
  WEBSITE_SOCIAL_OPTIONS,
  WebsiteContent,
  WebsiteContentError,
  WebsiteLocale,
  WebsiteLocaleContent,
  WebsiteSectionType,
  contentPathLocale,
  emptyLocaleContent,
  moveEntry,
  newSection,
  normalizeWebsiteContent,
  orderedLocales,
  setContentValue,
  updateLocaleContent,
  validateWebsiteContent,
  websiteContentPayload,
  websiteSiteUrl,
} from '../website-content';
import {
  WebsiteService,
  WebsiteSite,
  WebsiteSiteDetail,
  isRevisionConflict,
  websiteContentErrorPath,
} from '../website.service';
import { WEBSITE_DNS_STATE_OPTIONS, WEBSITE_SITE_STATUS_OPTIONS } from '../sites/sites';

type Busy = 'loading' | 'saving' | 'publishing' | 'unpublishing' | null;

/**
 * Website › List › Edit content: the draft content of one site per enabled language (SEO, hero,
 * sections, footer, legal texts) plus the shared identity (theme, contact, social links).
 * Save draft keeps the revision the user loaded; Publish publishes the saved draft.
 */
@Component({
  selector: 'app-website-editor',
  standalone: true,
  imports: [
    PageShellComponent,
    MnsSearchSelectFieldComponent,
    FieldHelpComponent,
    FieldInvalidDirective,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTabsModule,
    MatTooltipModule,
    RouterLink,
    TranslocoPipe,
  ],
  templateUrl: './editor.html',
  styleUrl: './editor.scss',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'app-fade-in-host' },
})
export class WebsiteEditorPage {
  private readonly website = inject(WebsiteService);
  private readonly snack = inject(SnackbarService);
  private readonly transloco = inject(TranslocoService);
  private readonly dialog = inject(MatDialog);
  private readonly breadcrumbLabels = inject(BreadcrumbLabelsService);
  private readonly revealInvalid = injectRevealInvalidFields();

  readonly uuid = inject(ActivatedRoute).snapshot.paramMap.get('uuid') ?? '';

  readonly sectionTypeOptions = WEBSITE_SECTION_TYPE_OPTIONS;
  readonly socialOptions = WEBSITE_SOCIAL_OPTIONS;
  readonly statusOptions = WEBSITE_SITE_STATUS_OPTIONS;

  readonly site = signal<WebsiteSite | null>(null);
  readonly content = signal<WebsiteContent>(normalizeWebsiteContent(null, ['pt-BR']));
  readonly baseline = signal('');
  readonly hasUnpublishedChanges = signal(false);
  readonly busy = signal<Busy>('loading');
  readonly loadError = signal(false);
  readonly selectedTab = signal(0);
  readonly newSectionType = signal<WebsiteSectionType>('features');
  /** Validation shown after a save/publish attempt; `publish` adds the required titles. */
  readonly attempt = signal<'save' | 'publish' | null>(null);
  readonly serverInvalid = signal<ReadonlySet<string>>(new Set());

  readonly locales = computed<WebsiteLocale[]>(() => {
    const site = this.site();
    return site ? orderedLocales(site.locales ?? [], site.defaultLocale) : [];
  });
  readonly dirty = computed(() => JSON.stringify(this.content()) !== this.baseline());
  readonly working = computed(() => this.busy() !== null);
  readonly loading = computed(() => this.busy() === 'loading');
  readonly published = computed(() => this.site()?.status === 'published');
  readonly suspended = computed(() => this.site()?.status === 'suspended');
  /** Automatic address and, when bound, the custom domain (the API `siteUrl` prefers it). */
  readonly siteUrl = computed(() => {
    const site = this.site();
    return site ? websiteSiteUrl({ autoDomain: site.autoDomain }) : null;
  });
  readonly customUrl = computed(() => {
    const site = this.site();
    return site?.themeDomain ? websiteSiteUrl({ customDomain: site.themeDomain }) : null;
  });
  readonly dnsError = computed(() => this.site()?.dns?.error ?? null);
  readonly errors = computed<WebsiteContentError[]>(() => {
    const attempt = this.attempt();
    if (!attempt) return [];
    return validateWebsiteContent(this.content(), this.locales(), attempt === 'publish');
  });
  private readonly errorByPath = computed(
    () => new Map(this.errors().map((error) => [error.path, error.message])),
  );

  constructor() {
    void this.load();
    effect((onCleanup) => {
      const name = this.site()?.name;
      if (name) onCleanup(this.breadcrumbLabels.register(`/website/sites/${this.uuid}`, name));
    });
  }

  // ---- read helpers -------------------------------------------------------------------------

  block(locale: WebsiteLocale): WebsiteLocaleContent {
    return this.content().locales[locale] ?? emptyLocaleContent();
  }

  localeLabel(locale: WebsiteLocale): string {
    return WEBSITE_LOCALE_OPTIONS.find((option) => option.value === locale)?.label ?? locale;
  }

  isDefaultLocale(locale: WebsiteLocale): boolean {
    return this.site()?.defaultLocale === locale;
  }

  statusLabel(): string {
    const status = this.site()?.status ?? '';
    return this.statusOptions.find((option) => option.value === status)?.label ?? status;
  }

  dnsLabel(): string {
    const state = this.site()?.dns?.status || 'external';
    return WEBSITE_DNS_STATE_OPTIONS.find((option) => option.value === state)?.label ?? state;
  }

  hasItems(type: WebsiteSectionType): boolean {
    return WEBSITE_SECTION_TYPES_WITH_ITEMS.includes(type);
  }

  invalid(path: string): boolean {
    return this.errorByPath().has(path) || this.serverInvalid().has(path);
  }

  errorText(path: string): string {
    return (
      this.errorByPath().get(path) ??
      (this.serverInvalid().has(path) ? 'form.validation.serverRejected' : REQUIRED_MESSAGE)
    );
  }

  tabInvalid(index: number): boolean {
    const locale = index === 0 ? null : this.locales()[index - 1];
    return [...this.errorByPath().keys(), ...this.serverInvalid()].some(
      (path) => contentPathLocale(path) === locale,
    );
  }

  // ---- edits --------------------------------------------------------------------------------

  set(path: string, value: unknown): void {
    this.content.update((content) => setContentValue(content, path, value));
    if (this.serverInvalid().has(path)) {
      this.serverInvalid.update((set) => new Set([...set].filter((key) => key !== path)));
    }
  }

  setText(path: string, event: Event): void {
    this.set(path, (event.target as HTMLInputElement | HTMLTextAreaElement).value);
  }

  addSection(locale: WebsiteLocale): void {
    const type = this.newSectionType();
    this.content.update((content) =>
      updateLocaleContent(content, locale, (block) => ({
        ...block,
        sections: [...block.sections, newSection(type, block.sections)],
      })),
    );
  }

  moveSection(locale: WebsiteLocale, index: number, delta: number): void {
    this.content.update((content) =>
      updateLocaleContent(content, locale, (block) => ({
        ...block,
        sections: moveEntry(block.sections, index, delta),
      })),
    );
  }

  removeSection(locale: WebsiteLocale, index: number): void {
    this.content.update((content) =>
      updateLocaleContent(content, locale, (block) => ({
        ...block,
        sections: block.sections.filter((_, position) => position !== index),
      })),
    );
  }

  setSectionType(locale: WebsiteLocale, index: number, value: unknown): void {
    const type = String(value) as WebsiteSectionType;
    this.content.update((content) =>
      updateLocaleContent(content, locale, (block) => ({
        ...block,
        sections: block.sections.map((entry, position) =>
          position === index
            ? {
                ...entry,
                type,
                items:
                  this.hasItems(type) && !entry.items.length
                    ? [{ title: '', text: '' }]
                    : entry.items,
              }
            : entry,
        ),
      })),
    );
  }

  addItem(locale: WebsiteLocale, sectionIndex: number): void {
    this.changeItems(locale, sectionIndex, (items) => [...items, { title: '', text: '' }]);
  }

  moveItem(locale: WebsiteLocale, sectionIndex: number, index: number, delta: number): void {
    this.changeItems(locale, sectionIndex, (items) => moveEntry(items, index, delta));
  }

  removeItem(locale: WebsiteLocale, sectionIndex: number, index: number): void {
    this.changeItems(locale, sectionIndex, (items) =>
      items.filter((_, position) => position !== index),
    );
  }

  addSocial(): void {
    this.content.update((content) => {
      const used = new Set(content.social.map((entry) => entry.network));
      const network = this.socialOptions.find((option) => !used.has(option.value))?.value;
      return network ? { ...content, social: [...content.social, { network, url: '' }] } : content;
    });
  }

  removeSocial(index: number): void {
    this.content.update((content) => ({
      ...content,
      social: content.social.filter((_, position) => position !== index),
    }));
  }

  canAddSocial(): boolean {
    return this.content().social.length < this.socialOptions.length;
  }

  // ---- lifecycle ----------------------------------------------------------------------------

  async refresh(): Promise<void> {
    if (this.working()) return;
    if (
      this.dirty() &&
      !(await this.confirm('website.discardTitle', 'website.discardMessage', 'website.discard'))
    ) {
      return;
    }
    await this.load();
  }

  discard(): void {
    this.content.set(JSON.parse(this.baseline()));
    this.attempt.set(null);
    this.serverInvalid.set(new Set());
  }

  async saveDraft(): Promise<boolean> {
    if (this.working() || !this.site()) return false;
    this.attempt.set('save');
    if (!this.reveal()) return false;
    this.busy.set('saving');
    try {
      const saved = await this.persistDraft();
      if (!saved) return false;
      this.snack.success(this.transloco.translate('website.draftSaved'));
      return true;
    } finally {
      this.busy.set(null);
    }
  }

  async publish(): Promise<void> {
    const site = this.site();
    if (this.working() || !site) return;
    this.attempt.set('publish');
    if (!this.reveal()) return;
    if (!(await this.confirm('website.publish', 'website.publishConfirm', 'website.publish')))
      return;
    this.busy.set('publishing');
    try {
      if (this.dirty() && !(await this.persistDraft())) return;
      const current = this.site() ?? site;
      const result = await this.website.publish(this.uuid, Number(current.revision));
      this.snack.success(this.transloco.translate('website.published'));
      await this.afterMutation(result);
    } catch (error) {
      await this.mutationFailed(error);
    } finally {
      this.busy.set(null);
    }
  }

  async unpublish(): Promise<void> {
    const site = this.site();
    if (this.working() || !site) return;
    if (
      !(await this.confirm('website.unpublish', 'website.unpublishConfirm', 'website.unpublish'))
    ) {
      return;
    }
    this.busy.set('unpublishing');
    try {
      const result = await this.website.unpublish(this.uuid, Number(site.revision));
      this.snack.success(this.transloco.translate('website.unpublished'));
      await this.afterMutation(result, true);
    } catch (error) {
      await this.mutationFailed(error);
    } finally {
      this.busy.set(null);
    }
  }

  // ---- internals ----------------------------------------------------------------------------

  private async load(): Promise<void> {
    this.busy.set('loading');
    this.loadError.set(false);
    try {
      this.apply(await this.website.get(this.uuid));
    } catch {
      this.loadError.set(true);
    } finally {
      this.busy.set(null);
    }
  }

  private apply(detail: WebsiteSiteDetail, keepContent = false): void {
    const locales = orderedLocales(detail.site.locales ?? [], detail.site.defaultLocale);
    this.site.set(detail.site);
    this.hasUnpublishedChanges.set(detail.hasUnpublishedChanges);
    if (!keepContent) {
      const content = normalizeWebsiteContent(detail.draftContent, locales);
      this.content.set(content);
      this.baseline.set(JSON.stringify(content));
      this.attempt.set(null);
      this.serverInvalid.set(new Set());
    }
    if (this.selectedTab() > locales.length) this.selectedTab.set(0);
  }

  /** PUT content with the loaded revision; a stale revision reloads the site and says why. */
  private async persistDraft(): Promise<boolean> {
    const site = this.site();
    if (!site) return false;
    const content = websiteContentPayload(this.content(), this.locales());
    try {
      const result = await this.website.saveContent(this.uuid, Number(site.revision), content);
      const detail = result ?? (await this.website.get(this.uuid));
      this.apply(detail);
      return true;
    } catch (error) {
      await this.mutationFailed(error);
      return false;
    }
  }

  private async afterMutation(result: WebsiteSiteDetail | null, keepContent = false) {
    if (result) this.apply(result, keepContent && this.dirty());
    else {
      const detail = await this.website.get(this.uuid);
      this.apply(detail, keepContent && this.dirty());
    }
  }

  private async mutationFailed(error: unknown): Promise<void> {
    if (isRevisionConflict(error)) {
      this.snack.warning('website.revisionConflict', 8000);
      await this.load();
      return;
    }
    const path = websiteContentErrorPath(error);
    const fields = path ? [path] : apiErrorFields(error).filter((field) => field !== 'content');
    if (fields.length) {
      this.serverInvalid.set(new Set(fields));
      this.selectTabOf(fields[0]);
      this.revealInvalid();
    }
  }

  /** True when the attempt is valid; otherwise opens the tab of the first error and focuses it. */
  private reveal(): boolean {
    const first = this.errors()[0];
    if (!first) return true;
    this.selectTabOf(first.path);
    this.revealInvalid();
    return false;
  }

  private selectTabOf(path: string): void {
    const locale = contentPathLocale(path);
    const index = locale ? this.locales().indexOf(locale) + 1 : 0;
    this.selectedTab.set(Math.max(0, index));
  }

  private changeItems(
    locale: WebsiteLocale,
    sectionIndex: number,
    change: (
      items: WebsiteLocaleContent['sections'][number]['items'],
    ) => WebsiteLocaleContent['sections'][number]['items'],
  ): void {
    this.content.update((content) =>
      updateLocaleContent(content, locale, (block) => ({
        ...block,
        sections: block.sections.map((entry, position) =>
          position === sectionIndex ? { ...entry, items: change(entry.items) } : entry,
        ),
      })),
    );
  }

  private async confirm(title: string, message: string, confirmLabel: string): Promise<boolean> {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      width: '420px',
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
      data: {
        title: this.transloco.translate(title),
        message: this.transloco.translate(message),
        confirmLabel: this.transloco.translate(confirmLabel),
      },
    });
    return Boolean(await firstValueFrom(ref.afterClosed()));
  }
}
