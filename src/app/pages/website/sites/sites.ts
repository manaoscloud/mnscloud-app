import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudFilters,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { quickCreateFor } from '../../../shared/crud/configurable-crud/quick-create';
import { WEBSITE_LOCALE_OPTIONS, isWebsiteLocale } from '../website-content';
import { WEBSITE_SITES_ENDPOINT, WebsiteService } from '../website.service';

export const WEBSITE_SITE_STATUS_OPTIONS: ConfigurableCrudOption[] = [
  { value: 'draft', label: 'website.status.draft' },
  { value: 'published', label: 'website.status.published' },
  { value: 'suspended', label: 'website.status.suspended' },
];

/** Managed DNS publication of the automatic domain; `external` when the platform does not publish. */
export const WEBSITE_DNS_STATE_OPTIONS: ConfigurableCrudOption[] = [
  { value: 'external', label: 'External' },
  { value: 'pending', label: 'Pending' },
  { value: 'queued', label: 'Queued' },
  { value: 'published', label: 'Published' },
  { value: 'failed', label: 'Failed' },
  { value: 'blocked', label: 'Needs review' },
  { value: 'conflict', label: 'Conflict' },
  { value: 'deleted', label: 'Removed' },
];

function statusChip(value: unknown): string {
  const status = String(value ?? '');
  if (status === 'published') return 'chip-success';
  if (status === 'suspended' || status === 'failed' || status === 'conflict') return 'chip-failed';
  if (status === 'pending' || status === 'queued') return 'chip-queued';
  if (status === 'blocked') return 'chip-running';
  return 'chip-skipped';
}

type SiteDns = { status?: unknown; error?: unknown; canRetry?: unknown } | null | undefined;

/** List row with the nested `dns` object flattened for the shared columns. */
export function websiteSiteRow(item: ConfigurableCrudRecord): ConfigurableCrudRecord {
  const dns = item['dns'] as SiteDns;
  return {
    ...item,
    dnsState: String(dns?.status ?? '') || 'external',
    dnsError: dns?.error ? String(dns.error) : '',
    dnsCanRetry: dns?.canRetry === true,
    publishedVersion: Number(item['publishedVersion'] ?? 0) || null,
  };
}

/** Name, languages and optional custom domain; the API sends only the revision on update. */
export function websiteSitePayload(
  values: ConfigurableCrudRecord,
  editing: boolean,
): ConfigurableCrudRecord {
  const defaultLocale = String(values['defaultLocale'] ?? '');
  const selected = Array.isArray(values['locales']) ? values['locales'].map(String) : [];
  const locales = [...new Set([defaultLocale, ...selected])].filter(isWebsiteLocale);
  return {
    name: String(values['name'] ?? '').trim(),
    defaultLocale,
    locales,
    themeDomainUUID: String(values['themeDomainUUID'] ?? '') || null,
    ...(editing ? { revision: Number(values['revision']) } : {}),
  };
}

function websiteSitesConfig(): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: WEBSITE_SITES_ENDPOINT,
    uuidField: 'siteUUID',
    pageTitle: 'website.sites',
    pageDescription: 'website.sitesDescription',
    createTitle: 'website.newSite',
    editTitle: 'website.editSite',
    dialogDescription: 'website.siteDialogDescription',
    searchPlaceholder: 'website.searchSites',
    emptyLabel: 'website.noSites',
    deleteTitle: 'website.deleteSite',
    deleteMessage: 'website.deleteSiteMessage',
    savedMessage: 'website.siteSaved',
    deletedMessage: 'website.siteDeleted',
    deleteFailedMessage: 'website.siteDeleteFailed',
    // The list API has no status filter: load the tenant sites (up to 500) and filter them here.
    initialPageSize: 25,
    // Revision-checked deletes, one record at a time (no bulk contract with revisions).
    bulkDelete: false,
    deletePayload: (row) => ({ revision: Number(row['revision']) }),
    statusMode: 'string',
    activeValue: 'published',
    inactiveValue: 'draft',
    statusOptions: WEBSITE_SITE_STATUS_OPTIONS,
    statusFilter: true,
    initialValues: {
      name: '',
      defaultLocale: 'pt-BR',
      locales: ['pt-BR'],
      themeDomainUUID: '',
      revision: 1,
    },
    payload: websiteSitePayload,
    fields: [
      { key: 'revision', source: 'revision', label: 'Revision', type: 'number', hidden: true },
      {
        key: 'name',
        source: 'name',
        label: 'Name',
        required: true,
        span: 2,
        help: 'website.nameHelp',
      },
      {
        key: 'defaultLocale',
        source: 'defaultLocale',
        label: 'website.defaultLocale',
        type: 'select',
        options: WEBSITE_LOCALE_OPTIONS,
        translateOptions: true,
        required: true,
        span: 1,
        help: 'website.defaultLocaleHelp',
      },
      {
        key: 'locales',
        source: 'locales',
        label: 'website.locales',
        type: 'multi-select',
        options: WEBSITE_LOCALE_OPTIONS,
        translateOptions: true,
        required: true,
        span: 1,
        help: 'website.localesHelp',
      },
      {
        key: 'themeDomainUUID',
        source: 'themeDomainUUID',
        label: 'website.customDomain',
        type: 'search-select',
        remoteLookup: {
          endpoint: 'settings/themes',
          uuidField: 'ThemeUUID',
          labelField: 'Domain',
          selectedLabelField: 'themeDomain',
        },
        quickCreate: quickCreateFor('ThemeDomainTdoUUID'),
        span: 2,
        help: 'website.customDomainHelp',
      },
    ],
    columns: [
      { id: 'name', field: 'name', label: 'Name', kind: 'identity', uuidField: 'siteUUID' },
      {
        id: 'autoDomain',
        field: 'autoDomain',
        label: 'website.autoDomain',
        kind: 'text',
        copyable: true,
        width: 'xl',
      },
      {
        id: 'customDomain',
        field: 'themeDomain',
        label: 'website.customDomain',
        kind: 'related',
        uuidField: 'themeDomainUUID',
      },
      {
        id: 'defaultLocale',
        field: 'defaultLocale',
        label: 'website.defaultLocale',
        kind: 'text',
        width: 'sm',
        value: (row, translate) => {
          const option = WEBSITE_LOCALE_OPTIONS.find((o) => o.value === row['defaultLocale']);
          return option ? translate(option.label) : String(row['defaultLocale'] ?? '');
        },
      },
      {
        id: 'publishedVersion',
        field: 'publishedVersion',
        label: 'website.publishedVersion',
        kind: 'number',
        width: 'sm',
      },
      {
        id: 'publishedAt',
        field: 'publishedAt',
        label: 'website.publishedAt',
        kind: 'datetime',
        optional: true,
      },
      {
        id: 'dnsState',
        field: 'dnsState',
        label: 'DNS',
        kind: 'status',
        options: WEBSITE_DNS_STATE_OPTIONS,
        chipClass: statusChip,
      },
      {
        id: 'dnsError',
        field: 'dnsError',
        label: 'website.dnsError',
        kind: 'text',
        optional: true,
      },
      {
        id: 'status',
        field: 'status',
        label: 'Status',
        kind: 'status',
        options: WEBSITE_SITE_STATUS_OPTIONS,
        className: 'status-col',
        chipClass: statusChip,
      },
    ],
  });
}

const EDIT_CONTENT_ACTION: ConfigurableCrudRowAction = {
  key: 'editContent',
  label: 'website.editContent',
  icon: 'edit_note',
  tooltip: 'website.editContentTooltip',
};
const PUBLISH_ACTION: ConfigurableCrudRowAction = {
  key: 'publish',
  label: 'website.publish',
  icon: 'publish',
  tooltip: 'website.publishTooltip',
};
const UNPUBLISH_ACTION: ConfigurableCrudRowAction = {
  key: 'unpublish',
  label: 'website.unpublish',
  icon: 'unpublished',
  tooltip: 'website.unpublishTooltip',
};
const RETRY_DNS_ACTION: ConfigurableCrudRowAction = {
  key: 'retryDns',
  label: 'website.retryDns',
  icon: 'refresh',
  tooltip: 'website.retryDnsTooltip',
};

/**
 * Website › List (tenant): the tenant's storefront sites with their automatic address, custom
 * domain, DNS and publication state. Content is edited in the site editor page.
 */
@Component({
  selector: 'app-website-sites',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class WebsiteSitesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly router = inject(Router);
  private readonly website = inject(WebsiteService);

  constructor() {
    super(websiteSitesConfig());
  }

  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    return (await super.fetchItems(filters)).map(websiteSiteRow);
  }

  override rowActions(row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    const status = String(row['status'] ?? '');
    return [
      EDIT_CONTENT_ACTION,
      ...(status !== 'suspended' ? [PUBLISH_ACTION] : []),
      ...(status === 'published' ? [UNPUBLISH_ACTION] : []),
      ...(row['dnsCanRetry'] === true ? [RETRY_DNS_ACTION] : []),
    ];
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    const uuid = this.recordUUID(row);
    if (!uuid) return;
    if (action.key === 'editContent') {
      await this.router.navigate(['/website/sites', uuid, 'editor']);
      return;
    }
    const revision = Number(row['revision']);
    try {
      if (action.key === 'publish') {
        const confirmed = await this.confirmAction(
          'website.publish',
          'website.publishConfirm',
          'website.publish',
        );
        if (!confirmed) return;
        await this.website.publish(uuid, revision);
        this.snack.success(this.t('website.published'));
      } else if (action.key === 'unpublish') {
        const confirmed = await this.confirmAction(
          'website.unpublish',
          'website.unpublishConfirm',
          'website.unpublish',
        );
        if (!confirmed) return;
        await this.website.unpublish(uuid, revision);
        this.snack.success(this.t('website.unpublished'));
      } else if (action.key === 'retryDns') {
        await this.website.retryDns(uuid);
        this.snack.success(this.t('website.dnsRetryQueued'));
      } else {
        return;
      }
      this.refreshList();
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
      this.refreshList();
    }
  }

  protected override validatePayload(payload: ConfigurableCrudRecord): boolean {
    if (!super.validatePayload(payload)) return false;
    const selected = this.formValues()['locales'];
    const locales = Array.isArray(selected) ? selected.map(String) : [];
    if (!locales.includes(String(this.formValues()['defaultLocale'] ?? ''))) {
      return this.rejectField('locales', 'website.validation.localesIncludeDefault');
    }
    return true;
  }
}
