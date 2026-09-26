import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

const ENDPOINT = 'settings/themes';

const jobStatuses = [
  { value: 'idle', label: 'Idle' },
  { value: 'queued', label: 'Queued' },
  { value: 'running', label: 'Running' },
  { value: 'done', label: 'Done' },
  { value: 'failed', label: 'Failed' },
];

const jobChipClass = (value: unknown) => {
  switch (String(value ?? 'idle')) {
    case 'queued':
      return 'chip-queued';
    case 'running':
    case 'provisioning':
      return 'chip-running';
    case 'done':
    case 'active':
      return 'chip-success';
    case 'failed':
      return 'chip-failed';
    default:
      return 'chip-skipped';
  }
};

const DOMAIN = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const HTTP_URL = /^https?:\/\/\S+$/i;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

// Public domains published through the Nginx edge and Certbot Agents. Web and certificate
// columns show the latest Agent job per domain; row actions queue new jobs through the API.
const config = defineCrud({
  endpoint: ENDPOINT,
  uuidField: 'ThemeUUID',
  pageTitle: 'Themes',
  pageDescription: 'Register and manage domains published through Nginx/Certbot.',
  searchPlaceholder: 'Domain or page title',
  emptyLabel: 'No domains found.',
  createTitle: 'New domain',
  editTitle: 'Edit domain',
  dialogDescription: 'Add a domain to publish your public theme context.',
  deleteTitle: 'Delete theme domain',
  deleteMessage: 'Delete this domain and queue provider cleanup?',
  deleteSelectedTitle: 'Delete selected theme domains',
  deleteSelectedMessage: 'Delete {count} selected theme domains and queue provider cleanup?',
  bulkDelete: true,
  statusFilter: false,
  initialValues: {
    domain: '',
    pageTitle: '',
    metaDescription: '',
    logoUrl: '',
    faviconUrl: '',
    primaryColor: '',
  },
  listFilters: [
    {
      key: 'jobStatus',
      label: 'Job Status',
      type: 'select',
      span: 1,
      options: jobStatuses,
    },
  ],
  columns: [
    {
      id: 'domain',
      label: 'Domain',
      field: 'Domain',
      uuidField: 'ThemeUUID',
      kind: 'identity',
      translateValue: false,
    },
    { id: 'title', label: 'Page Title', field: 'PageTitle' },
    {
      id: 'web',
      label: 'Web',
      field: 'WebStatus',
      kind: 'status',
      options: jobStatuses,
      chipClass: jobChipClass,
    },
    {
      id: 'certificate',
      label: 'Certificate',
      field: 'CertStatus',
      kind: 'status',
      options: jobStatuses,
      chipClass: jobChipClass,
    },
  ],
  fields: [
    {
      key: 'domain',
      source: 'Domain',
      label: 'Domain',
      required: true,
      span: 2,
    },
    { key: 'pageTitle', source: 'PageTitle', label: 'Page Title', required: true, span: 2 },
    {
      key: 'metaDescription',
      source: 'MetaDescription',
      label: 'Meta Description',
      type: 'textarea',
      rows: 3,
      span: 4,
    },
    {
      key: 'logoUrl',
      source: 'LogoUrl',
      label: 'Logo URL',
      span: 2,
    },
    {
      key: 'faviconUrl',
      source: 'FaviconUrl',
      label: 'Favicon URL',
      span: 2,
    },
    {
      key: 'primaryColor',
      source: 'PrimaryColor',
      label: 'Primary Color',
      span: 1,
    },
  ],
  rowActions: [
    { key: 'web', label: 'Queue web action', icon: 'public', tooltip: 'Queue web action' },
    {
      key: 'cert',
      label: 'Queue certificate action',
      icon: 'verified_user',
      tooltip: 'Queue certificate action',
    },
  ],
});

@Component({
  selector: 'app-settings-themes',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class SettingsThemesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  protected override validatePayload(payload: ConfigurableCrudRecord): boolean {
    const text = (key: string) => String(payload[key] ?? '').trim();
    if (!DOMAIN.test(text('domain').toLowerCase())) {
      this.snack.warning(this.t('Use only the hostname, without scheme, port, or path.'));
      return false;
    }
    if (['logoUrl', 'faviconUrl'].some((key) => text(key) && !HTTP_URL.test(text(key)))) {
      this.snack.warning(this.t('Please use valid http(s) URLs.'));
      return false;
    }
    if (text('primaryColor') && !HEX_COLOR.test(text('primaryColor'))) {
      this.snack.warning(this.t('Please use #RRGGBB format for the primary color.'));
      return false;
    }
    return super.validatePayload(payload);
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const optional = (key: string) => String(payload[key] ?? '').trim() || null;
    return {
      domain: String(payload['domain'] ?? '')
        .trim()
        .toLowerCase(),
      pageTitle: String(payload['pageTitle'] ?? '').trim(),
      metaDescription: optional('metaDescription'),
      logoUrl: optional('logoUrl'),
      faviconUrl: optional('faviconUrl'),
      primaryColor: optional('primaryColor')?.toLowerCase() ?? null,
    };
  }

  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: ConfigurableCrudRecord,
  ): Promise<void> {
    if (action.key !== 'web' && action.key !== 'cert') return;
    const path = action.key === 'web' ? 'web' : 'certificate';
    try {
      await this.api.post(`${ENDPOINT}/${row['ThemeUUID']}/${path}`, {});
      this.snack.success(
        this.t(
          action.key === 'web'
            ? 'Web event queued for {domain}.'
            : 'Certificate event queued for {domain}.',
          { domain: String(row['Domain'] ?? '') },
        ),
      );
      this.refreshList();
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error) || 'Failed to queue action.'));
    }
  }
}
