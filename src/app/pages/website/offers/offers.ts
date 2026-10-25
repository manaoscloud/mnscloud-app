import { Component, inject } from '@angular/core';

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
import { WEBSITE_OFFERS_ENDPOINT, WebsiteService } from '../website.service';

export const WEBSITE_OFFER_STATUS_OPTIONS: ConfigurableCrudOption[] = [
  { value: 'draft', label: 'website.offerStatus.draft' },
  { value: 'published', label: 'website.offerStatus.published' },
  { value: 'archived', label: 'website.offerStatus.archived' },
];
export const WEBSITE_OFFER_KIND_OPTIONS: ConfigurableCrudOption[] = [
  { value: 'vps', label: 'website.offerKind.vps' },
  { value: 'webhost', label: 'website.offerKind.webhost' },
];
export const WEBSITE_OFFER_CYCLE_OPTIONS: ConfigurableCrudOption[] = [
  { value: 'monthly', label: 'website.offerCycle.monthly' },
  { value: 'quarterly', label: 'website.offerCycle.quarterly' },
  { value: 'semiannual', label: 'website.offerCycle.semiannual' },
  { value: 'yearly', label: 'website.offerCycle.yearly' },
];

/** Copy per locale as flat form fields (`name_pt-BR`, `summary_pt-BR`, `features_pt-BR`). */
const OFFER_LOCALES = [
  { code: 'pt-BR', suffix: 'Pt' },
  { code: 'en-US', suffix: 'En' },
  { code: 'es-ES', suffix: 'Es' },
] as const;

type OfferTexts = Record<string, { name?: string; summary?: string; features?: string[] }>;

/** API offer → form values (texts flattened per locale, features one per line). */
export function websiteOfferRow(item: ConfigurableCrudRecord): ConfigurableCrudRecord {
  const texts = (item['texts'] ?? {}) as OfferTexts;
  const row: ConfigurableCrudRecord = { ...item };
  for (const locale of OFFER_LOCALES) {
    const copy = texts[locale.code] ?? {};
    row[`name${locale.suffix}`] = copy.name ?? '';
    row[`summary${locale.suffix}`] = copy.summary ?? '';
    row[`features${locale.suffix}`] = (copy.features ?? []).join('\n');
  }
  const pt = texts['pt-BR'] ?? texts['en-US'] ?? texts['es-ES'] ?? {};
  row['displayName'] = pt.name ?? String(item['slug'] ?? '');
  return row;
}

/** Form values → API body (every field is replaced on update; empty locales are left out). */
export function websiteOfferPayload(
  values: ConfigurableCrudRecord,
  editing: boolean,
): ConfigurableCrudRecord {
  const texts: OfferTexts = {};
  for (const locale of OFFER_LOCALES) {
    const name = String(values[`name${locale.suffix}`] ?? '').trim();
    if (!name) continue;
    texts[locale.code] = {
      name,
      summary: String(values[`summary${locale.suffix}`] ?? '').trim(),
      features: String(values[`features${locale.suffix}`] ?? '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 10),
    };
  }
  const number = (key: string) => {
    const value = Number(values[key] ?? 0);
    return Number.isFinite(value) ? value : 0;
  };
  return {
    slug: String(values['slug'] ?? '')
      .trim()
      .toLowerCase(),
    kind: String(values['kind'] ?? 'vps'),
    planUUID: String(values['planUUID'] ?? ''),
    currency: 'BRL',
    price: number('price'),
    setupFee: number('setupFee'),
    cycle: String(values['cycle'] ?? 'monthly'),
    trialDays: Math.trunc(number('trialDays')),
    commitmentMonths: Math.trunc(number('commitmentMonths')),
    approvalRequired: values['approvalRequired'] === true || values['approvalRequired'] === 'true',
    sortOrder: Math.trunc(number('sortOrder')),
    texts,
    ...(editing ? { revision: Number(values['revision']) } : {}),
  };
}

function statusChip(value: unknown): string {
  const status = String(value ?? '');
  if (status === 'published') return 'chip-success';
  if (status === 'archived') return 'chip-failed';
  return 'chip-skipped';
}

function localeFields(): ConfigurableCrudConfig['fields'] {
  return OFFER_LOCALES.flatMap((locale) => [
    {
      key: `name${locale.suffix}`,
      source: `name${locale.suffix}`,
      label: `website.offerName${locale.suffix}`,
      tab: 'public' as const,
      span: 2,
      help: 'website.offerNameHelp',
    },
    {
      key: `summary${locale.suffix}`,
      source: `summary${locale.suffix}`,
      label: `website.offerSummary${locale.suffix}`,
      type: 'textarea' as const,
      tab: 'public' as const,
      span: 2,
      help: 'website.offerSummaryHelp',
    },
    {
      key: `features${locale.suffix}`,
      source: `features${locale.suffix}`,
      label: `website.offerFeatures${locale.suffix}`,
      type: 'textarea' as const,
      tab: 'public' as const,
      span: 2,
      help: 'website.offerFeaturesHelp',
    },
  ]);
}

function websiteOffersConfig(): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: WEBSITE_OFFERS_ENDPOINT,
    uuidField: 'offerUUID',
    pageTitle: 'website.offers',
    pageDescription: 'website.offersDescription',
    createTitle: 'website.newOffer',
    editTitle: 'website.editOffer',
    dialogDescription: 'website.offerDialogDescription',
    searchPlaceholder: 'website.searchOffers',
    emptyLabel: 'website.noOffers',
    deleteTitle: 'website.deleteOffer',
    deleteMessage: 'website.deleteOfferMessage',
    savedMessage: 'website.offerSaved',
    deletedMessage: 'website.offerDeleted',
    deleteFailedMessage: 'website.offerDeleteFailed',
    initialPageSize: 25,
    bulkDelete: false,
    deletePayload: (row) => ({ revision: Number(row['revision']) }),
    statusMode: 'string',
    activeValue: 'published',
    inactiveValue: 'draft',
    statusOptions: WEBSITE_OFFER_STATUS_OPTIONS,
    statusFilter: true,
    initialValues: {
      slug: '',
      kind: 'vps',
      planUUID: '',
      price: 0,
      setupFee: 0,
      cycle: 'monthly',
      trialDays: 0,
      commitmentMonths: 0,
      approvalRequired: false,
      sortOrder: 0,
      revision: 1,
      namePt: '',
      summaryPt: '',
      featuresPt: '',
      nameEn: '',
      summaryEn: '',
      featuresEn: '',
      nameEs: '',
      summaryEs: '',
      featuresEs: '',
    },
    payload: websiteOfferPayload,
    fields: [
      { key: 'revision', source: 'revision', label: 'Revision', type: 'number', hidden: true },
      {
        key: 'slug',
        source: 'slug',
        label: 'website.offerSlug',
        required: true,
        span: 1,
        help: 'website.offerSlugHelp',
      },
      {
        key: 'kind',
        source: 'kind',
        label: 'website.offerKindLabel',
        type: 'select',
        options: WEBSITE_OFFER_KIND_OPTIONS,
        translateOptions: true,
        required: true,
        span: 1,
        help: 'website.offerKindHelp',
      },
      {
        key: 'planUUID',
        source: 'planUUID',
        label: 'website.offerPlan',
        type: 'search-select',
        remoteLookup: {
          endpoint: 'website/offers/plans',
          uuidField: 'planUUID',
          labelField: 'name',
          selectedLabelField: 'planName',
          parameters: { kind: 'kind' },
        },
        quickCreate: false,
        quickCreateExemptReason:
          'Platform VPS and hosting plans are created by the platform master.',
        required: true,
        span: 2,
        help: 'website.offerPlanHelp',
      },
      {
        key: 'price',
        source: 'price',
        label: 'website.offerPrice',
        type: 'currency',
        required: true,
        span: 1,
        help: 'website.offerPriceHelp',
      },
      {
        key: 'cycle',
        source: 'cycle',
        label: 'website.offerCycleLabel',
        type: 'select',
        options: WEBSITE_OFFER_CYCLE_OPTIONS,
        translateOptions: true,
        required: true,
        span: 1,
        help: 'website.offerCycleHelp',
      },
      {
        key: 'setupFee',
        source: 'setupFee',
        label: 'website.offerSetupFee',
        type: 'currency',
        span: 1,
        help: 'website.offerSetupFeeHelp',
      },
      {
        key: 'trialDays',
        source: 'trialDays',
        label: 'website.offerTrialDays',
        type: 'number',
        span: 1,
        help: 'website.offerTrialDaysHelp',
      },
      {
        key: 'commitmentMonths',
        source: 'commitmentMonths',
        label: 'website.offerCommitment',
        type: 'number',
        span: 1,
        help: 'website.offerCommitmentHelp',
      },
      {
        key: 'approvalRequired',
        source: 'approvalRequired',
        label: 'website.offerApproval',
        type: 'select',
        options: [
          { value: false, label: 'No' },
          { value: true, label: 'Yes' },
        ],
        translateOptions: true,
        span: 1,
        help: 'website.offerApprovalHelp',
      },
      {
        key: 'sortOrder',
        source: 'sortOrder',
        label: 'website.offerSortOrder',
        type: 'number',
        span: 1,
        help: 'website.offerSortOrderHelp',
      },
      ...localeFields(),
    ],
    columns: [
      {
        id: 'displayName',
        field: 'displayName',
        label: 'website.offerName',
        kind: 'identity',
        uuidField: 'offerUUID',
      },
      { id: 'slug', field: 'slug', label: 'website.offerSlug', kind: 'text', copyable: true },
      {
        id: 'kind',
        field: 'kind',
        label: 'website.offerKindLabel',
        kind: 'text',
        width: 'sm',
        value: (row, translate) => {
          const option = WEBSITE_OFFER_KIND_OPTIONS.find((o) => o.value === row['kind']);
          return option ? translate(option.label) : String(row['kind'] ?? '');
        },
      },
      { id: 'planName', field: 'planName', label: 'website.offerPlan', kind: 'text' },
      { id: 'price', field: 'price', label: 'website.offerPrice', kind: 'currency', width: 'sm' },
      {
        id: 'cycle',
        field: 'cycle',
        label: 'website.offerCycleLabel',
        kind: 'text',
        width: 'sm',
        value: (row, translate) => {
          const option = WEBSITE_OFFER_CYCLE_OPTIONS.find((o) => o.value === row['cycle']);
          return option ? translate(option.label) : String(row['cycle'] ?? '');
        },
      },
      {
        id: 'visible',
        field: 'visible',
        label: 'website.offerVisible',
        kind: 'text',
        width: 'sm',
        value: (row, translate) => translate(row['visible'] === true ? 'Yes' : 'No'),
      },
      {
        id: 'status',
        field: 'status',
        label: 'Status',
        kind: 'status',
        options: WEBSITE_OFFER_STATUS_OPTIONS,
        className: 'status-col',
        chipClass: statusChip,
      },
    ],
  });
}

const PUBLISH_ACTION: ConfigurableCrudRowAction = {
  key: 'publish',
  label: 'website.publishOffer',
  icon: 'publish',
  tooltip: 'website.publishOfferTooltip',
};
const DRAFT_ACTION: ConfigurableCrudRowAction = {
  key: 'draft',
  label: 'website.unpublishOffer',
  icon: 'unpublished',
  tooltip: 'website.unpublishOfferTooltip',
};
const ARCHIVE_ACTION: ConfigurableCrudRowAction = {
  key: 'archive',
  label: 'website.archiveOffer',
  icon: 'inventory_2',
  tooltip: 'website.archiveOfferTooltip',
};

/**
 * Website › Offers (tenant): what the tenant sells on its sites, each offer bound to a VPS or
 * Webhost plan with the customer price, cycle and copy per language. Published offers appear in
 * the "Offers" sections and get their own page; the site is rendered again on every change.
 */
@Component({
  selector: 'app-website-offers',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class WebsiteOffersPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly website = inject(WebsiteService);

  constructor() {
    super(websiteOffersConfig());
  }

  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    return (await super.fetchItems(filters)).map(websiteOfferRow);
  }

  override rowActions(row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    const status = String(row['status'] ?? '');
    return [
      ...(status !== 'published' ? [PUBLISH_ACTION] : [DRAFT_ACTION]),
      ...(status !== 'archived' ? [ARCHIVE_ACTION] : []),
    ];
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    const uuid = this.recordUUID(row);
    if (!uuid) return;
    const status =
      action.key === 'publish' ? 'published' : action.key === 'archive' ? 'archived' : 'draft';
    try {
      await this.website.setOfferStatus(uuid, Number(row['revision']), status);
      this.snack.success(this.t('website.offerStatusSaved'));
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    }
    this.refreshList();
  }

  protected override validatePayload(payload: ConfigurableCrudRecord): boolean {
    if (!super.validatePayload(payload)) return false;
    if (!Object.keys((payload['texts'] ?? {}) as object).length) {
      return this.rejectField('namePt', 'website.validation.offerNameRequired');
    }
    return true;
  }
}
