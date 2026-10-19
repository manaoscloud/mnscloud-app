import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
  ConfigurableCrudSaveContext,
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
// External image (http/https) or an image uploaded to the theme (same origin).
const IMAGE_URL = /^(https?:\/\/\S+|\/api\/v1\/public\/theme\/assets\/[0-9a-f]{32})$/i;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

const LOGO_ACCEPT = 'image/png,image/jpeg,image/webp';
const FAVICON_ACCEPT = 'image/png,image/x-icon,.ico';

type BrandModule = 'app' | 'pos' | 'pulse';
type BrandTab = 'brandApp' | 'brandPos' | 'brandPulse';

/** Web modules with their own brand; every empty field inherits the App brand. */
const BRAND_MODULES = [
  { module: 'pos', tab: 'brandPos' },
  { module: 'pulse', tab: 'brandPulse' },
] as const;

/** Form key of a brand field: App fields keep their names, module fields get the module prefix. */
const brandKey = (module: BrandModule, name: string) =>
  module === 'app' ? name : `${module}${name[0].toUpperCase()}${name.slice(1)}`;

const moduleValue =
  (module: BrandModule, name: string) => (_: unknown, row: ConfigurableCrudRecord) => {
    const modules = (row['Modules'] ?? {}) as Record<string, Record<string, unknown> | undefined>;
    return modules[module]?.[name] ?? '';
  };

/** Image fields of one brand tab: URL in use (uploaded or external) and the file to upload. */
function imageFields(module: BrandModule, tab: BrandTab, kind: 'logo' | 'favicon') {
  const label = kind === 'logo' ? 'Logo' : 'Favicon';
  const inherit = module === 'app' ? '' : ' Empty uses the App image.';
  return [
    {
      key: brandKey(module, `${kind}Url`),
      ...(module === 'app'
        ? { source: kind === 'logo' ? 'LogoUrl' : 'FaviconUrl' }
        : { source: 'Modules', fromRecord: moduleValue(module, `${kind}Url`) }),
      label: `${label} URL`,
      tab,
      span: 2 as const,
      help: `Image in use: uploaded here or an https address. Clear it to remove.${inherit}`,
    },
    {
      key: brandKey(module, `${kind}File`),
      label: `Upload ${label.toLowerCase()}`,
      type: 'file' as const,
      accept: kind === 'logo' ? LOGO_ACCEPT : FAVICON_ACCEPT,
      tab,
      span: 2 as const,
      help:
        kind === 'logo'
          ? 'PNG, JPEG or WebP up to 512 KB. Sent when you save.'
          : 'Square PNG or ICO up to 128 KB (32x32 or larger). Sent when you save.',
    },
  ];
}

function moduleBrandFields(module: 'pos' | 'pulse', tab: BrandTab) {
  return [
    {
      key: brandKey(module, 'pageTitle'),
      source: 'Modules',
      fromRecord: moduleValue(module, 'pageTitle'),
      label: 'Page Title',
      tab,
      span: 2 as const,
      help: 'Browser tab title of this module. Empty uses the App title.',
    },
    {
      key: brandKey(module, 'primaryColor'),
      source: 'Modules',
      fromRecord: moduleValue(module, 'primaryColor'),
      label: 'Primary Color',
      tab,
      span: 2 as const,
      help: 'Main color of this module (#RRGGBB). Empty uses the App color.',
    },
    ...imageFields(module, tab, 'logo'),
    ...imageFields(module, tab, 'favicon'),
  ];
}

// Public domains published through the Nginx edge and Certbot Agents. Web and certificate
// columns show the latest Agent job per domain; row actions queue new jobs through the API.
const config = defineCrud({
  endpoint: ENDPOINT,
  uuidField: 'ThemeUUID',
  pageTitle: 'Themes',
  pageDescription: 'settings.description.themes',
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
      key: 'primaryColor',
      source: 'PrimaryColor',
      label: 'Primary Color',
      tab: 'brandApp',
      span: 2,
      help: 'Main color of the App and of every module without its own color (#RRGGBB).',
    },
    ...imageFields('app', 'brandApp', 'logo'),
    ...imageFields('app', 'brandApp', 'favicon'),
    ...BRAND_MODULES.flatMap(({ module, tab }) => moduleBrandFields(module, tab)),
  ],
  tabLabels: { record: 'Domain', brandApp: 'App', brandPos: 'POS', brandPulse: 'Pulse' },
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
  /** Images chosen in the form; uploaded right after the record is saved. */
  private pendingImages: { module: BrandModule; kind: 'logo' | 'favicon'; file: File }[] = [];

  constructor() {
    super(config);
  }

  protected override validatePayload(payload: ConfigurableCrudRecord): boolean {
    if (!super.validatePayload(payload)) return false;
    const text = (key: string) => String(payload[key] ?? '').trim();
    if (!DOMAIN.test(text('domain').toLowerCase())) {
      return this.rejectField('domain', 'Use only the hostname, without scheme, port, or path.');
    }
    for (const module of ['app', ...BRAND_MODULES.map((item) => item.module)] as BrandModule[]) {
      const invalidUrl = [brandKey(module, 'logoUrl'), brandKey(module, 'faviconUrl')].find(
        (key) => text(key) && !IMAGE_URL.test(text(key)),
      );
      if (invalidUrl) {
        return this.rejectField(invalidUrl, 'Use an image uploaded here or an http(s) URL.');
      }
      const color = brandKey(module, 'primaryColor');
      if (text(color) && !HEX_COLOR.test(text(color))) {
        return this.rejectField(color, 'Please use #RRGGBB format for the primary color.');
      }
    }
    return true;
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const optional = (key: string) => String(payload[key] ?? '').trim() || null;
    this.pendingImages = (['app', ...BRAND_MODULES.map((item) => item.module)] as BrandModule[])
      .flatMap((module) =>
        (['logo', 'favicon'] as const).map((kind) => ({
          module,
          kind,
          file: payload[brandKey(module, `${kind}File`)],
        })),
      )
      .filter(
        (item): item is { module: BrandModule; kind: 'logo' | 'favicon'; file: File } =>
          item.file instanceof File,
      );
    return {
      domain: String(payload['domain'] ?? '')
        .trim()
        .toLowerCase(),
      pageTitle: String(payload['pageTitle'] ?? '').trim(),
      metaDescription: optional('metaDescription'),
      logoUrl: optional('logoUrl'),
      faviconUrl: optional('faviconUrl'),
      primaryColor: optional('primaryColor')?.toLowerCase() ?? null,
      modules: Object.fromEntries(
        BRAND_MODULES.map(({ module }) => [
          module,
          {
            pageTitle: optional(brandKey(module, 'pageTitle')),
            logoUrl: optional(brandKey(module, 'logoUrl')),
            faviconUrl: optional(brandKey(module, 'faviconUrl')),
            primaryColor: optional(brandKey(module, 'primaryColor'))?.toLowerCase() ?? null,
          },
        ]),
      ),
    };
  }

  protected override async afterSave(
    context: ConfigurableCrudSaveContext<ConfigurableCrudRecord>,
  ): Promise<void> {
    const images = this.pendingImages;
    this.pendingImages = [];
    if (!images.length) return;
    const created = (context.response as { data?: { ThemeUUID?: string }[] } | null)?.data?.[0];
    const themeUUID = String(context.record?.['ThemeUUID'] ?? created?.ThemeUUID ?? '');
    if (!themeUUID) return;
    const failed: string[] = [];
    for (const image of images) {
      const body = new FormData();
      body.append('module', image.module);
      body.append('kind', image.kind);
      body.append('file', image.file);
      try {
        await this.runManagedFileUpload(
          this.api.postFormWithProgress(`${ENDPOINT}/${themeUUID}/assets`, body),
          image.file.size,
        );
      } catch (error) {
        failed.push(`${image.file.name}: ${this.t(this.errorMessage(error))}`);
      }
    }
    this.refreshList();
    if (failed.length) {
      this.snack.error(
        this.t('Theme saved, but some images were not uploaded: {list}', {
          list: failed.join('; '),
        }),
      );
    } else {
      this.snack.success(this.t('Theme images uploaded.'));
    }
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
