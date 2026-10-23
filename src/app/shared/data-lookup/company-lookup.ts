import type {
  ConfigurableCrudFieldSuffixButton,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../crud/configurable-crud/configurable-crud-page-base';

/**
 * "Search CNPJ" button of a document field: asks the platform data lookup (`GET
 * lookups/company/:cnpj`, the one active provider of Settings › Lookups) and fills the form.
 * Empty fields are filled; filled ones are replaced only after confirmation, and a CNPJ that is not
 * active at the Receita Federal asks before anything is filled.
 */
export type CompanyLookupSpec = {
  /** Screen that asks, recorded in the lookup usage (e.g. `registry.customer`). */
  feature: string;
  documentKey: string;
  /** Field holding company/person; the button shows only for companies when given. */
  typeKey?: string;
  /** Receives the trade name (or the legal name when there is none). */
  nameKey?: string;
  legalNameKey?: string;
  openingDateKey?: string;
  emailKey?: string;
  phoneKey?: string;
  /** Address field keys (the same ones the postal code search fills). */
  address?: {
    zip: string;
    street: string;
    number: string;
    complement: string;
    district: string;
    city: string;
    state: string;
    country?: string;
    municipalityCode?: string;
  };
};

type CompanyItem = {
  document?: string;
  legalName?: string;
  tradeName?: string | null;
  registrationStatus?: string | null;
  openingDate?: string | null;
  email?: string | null;
  phones?: string[];
  dataAsOf?: string | null;
  address?: {
    postalCode?: string | null;
    street?: string | null;
    number?: string | null;
    complement?: string | null;
    district?: string | null;
    city?: string | null;
    state?: string | null;
    ibgeCode?: string | null;
  };
};

const STATUS_LABELS: Record<string, string> = {
  suspended: 'suspended',
  unfit: 'unfit (inapta)',
  closed: 'closed (baixada)',
  null: 'null (nula)',
};

/** Uppercase letters and digits: the CNPJ is alphanumeric since 2026-07-01 (NT 2025.001). */
export function normalizeCnpj(value: unknown): string {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '');
}

function cnpjDigit(value: string, weights: number[]): number {
  const rest = weights.reduce((sum, w, i) => sum + (value.charCodeAt(i) - 48) * w, 0) % 11;
  return rest < 2 ? 0 : 11 - rest;
}

/** CNPJ check digits (ASCII - 48, numeric and alphanumeric), same rule as the API and database. */
export function isValidCnpj(value: string): boolean {
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(value) || /^(.)\1{13}$/.test(value)) return false;
  return (
    cnpjDigit(value, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(value[12]) &&
    cnpjDigit(value, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(value[13])
  );
}

/** Form values the answer would set, by field key (empty answers are skipped). */
export function companyLookupValues(
  spec: CompanyLookupSpec,
  item: CompanyItem,
): ConfigurableCrudRecord {
  const values: ConfigurableCrudRecord = {};
  const put = (key: string | undefined, value: unknown) => {
    const text = String(value ?? '').trim();
    if (key && text) values[key] = text;
  };
  put(spec.documentKey, item.document);
  put(spec.nameKey, item.tradeName || item.legalName);
  put(spec.legalNameKey, item.legalName);
  put(spec.openingDateKey, item.openingDate);
  put(spec.emailKey, item.email);
  put(spec.phoneKey, item.phones?.[0]);
  if (spec.address && item.address) {
    const a = spec.address;
    put(a.zip, item.address.postalCode);
    put(a.street, item.address.street);
    put(a.number, item.address.number);
    put(a.complement, item.address.complement);
    put(a.district, item.address.district);
    put(a.city, item.address.city);
    put(a.state, item.address.state);
    if (item.address.postalCode) put(a.country, 'BR');
    put(a.municipalityCode, item.address.ibgeCode);
  }
  return values;
}

/** Keys whose current value is filled and different from the answer. */
export function companyLookupConflicts(
  current: ConfigurableCrudRecord,
  values: ConfigurableCrudRecord,
  documentKey: string,
): string[] {
  return Object.keys(values).filter((key) => {
    if (key === documentKey) return false;
    const now = String(current[key] ?? '').trim();
    return now !== '' && now.toUpperCase() !== String(values[key]).toUpperCase();
  });
}

function errorText(error: unknown): string {
  const body = (error as { error?: { error?: string } })?.error;
  return body?.error ?? '';
}

async function runCompanyLookup(
  spec: CompanyLookupSpec,
  host: ConfigurableCrudPageBase<ConfigurableCrudRecord>,
): Promise<void> {
  const current = host.formValues();
  const cnpj = normalizeCnpj(current[spec.documentKey]);
  if (!isValidCnpj(cnpj)) {
    host.snack.warning(host.translate('Inform a valid CNPJ to search.'));
    return;
  }
  let item: CompanyItem;
  try {
    const response = await host.api.get<{ data?: { item?: CompanyItem } }>(
      `lookups/company/${cnpj}?feature=${encodeURIComponent(spec.feature)}`,
      { silent: true },
    );
    item = response?.data?.item ?? {};
  } catch (error) {
    host.snack.error(host.translate(errorText(error) || 'Failed to search CNPJ.'));
    return;
  }
  const status = String(item.registrationStatus ?? '');
  if (status && status !== 'active') {
    const proceed = await host.askConfirmation(
      'CNPJ is not active',
      host.translate(
        'This CNPJ is {{ status }} at the Receita Federal. Fill the form with its data anyway?',
        { status: host.translate(STATUS_LABELS[status] ?? status) },
      ),
      'Fill anyway',
    );
    if (!proceed) return;
  }
  let values = companyLookupValues(spec, item);
  const conflicts = companyLookupConflicts(host.formValues(), values, spec.documentKey);
  if (conflicts.length) {
    const replace = await host.askConfirmation(
      'Replace filled fields?',
      'Some fields already have other values. Replace them with the CNPJ data? Otherwise only empty fields are filled.',
      'Replace',
    );
    if (!replace) {
      values = Object.fromEntries(
        Object.entries(values).filter(([key]) => !conflicts.includes(key)),
      );
    }
  }
  // Open-data CNPJ answers may lack the IBGE city code: the postal code lookup completes it.
  const municipality = spec.address?.municipalityCode;
  const zip = spec.address ? String(values[spec.address.zip] ?? '') : '';
  if (municipality && zip && !values[municipality] && !String(current[municipality] ?? '')) {
    try {
      const cep = await host.api.get<{ data?: { item?: { ibgeCode?: string | null } } }>(
        `lookups/postal_code/${zip}?feature=${encodeURIComponent(spec.feature)}`,
        { silent: true },
      );
      if (cep?.data?.item?.ibgeCode) values[municipality] = cep.data.item.ibgeCode;
    } catch {
      // The IBGE code stays empty; the postal code search of the address can fill it later.
    }
  }
  host.applyLookupValues(values);
  host.snack.success(
    item.dataAsOf
      ? host.translate('CNPJ data filled (Receita data of {{ date }}).', { date: item.dataAsOf })
      : host.translate('CNPJ data filled.'),
  );
}

/** Suffix button of the document field (shown for companies only when `typeKey` is given). */
export function companyLookupButton(spec: CompanyLookupSpec): ConfigurableCrudFieldSuffixButton {
  return {
    icon: 'travel_explore',
    tooltip: 'Search CNPJ',
    visibleWhen: ({ values }) =>
      !spec.typeKey || String(values[spec.typeKey] ?? 'company') === 'company',
    onClick: (_context, host) =>
      runCompanyLookup(spec, host as ConfigurableCrudPageBase<ConfigurableCrudRecord>),
  };
}
