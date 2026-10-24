import { firstValueFrom } from 'rxjs';

import type {
  ConfigurableCrudFieldSuffixButton,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../crud/configurable-crud/configurable-crud-page-base';
import { companyLookupConflicts } from './company-lookup';
import {
  PersonLookupDialogComponent,
  type PersonLookupDialogData,
  type PersonLookupDialogResult,
} from './person-lookup-dialog';

/**
 * "Search CPF" button of a document field: asks the platform data lookup (`GET
 * lookups/person/:cpf`, the active provider of Settings › Lookups) and fills the name and the date
 * of birth. Every CPF lookup declares its purpose and legal basis (LGPD), recorded per query, so a
 * dialog asks for them first. Filled fields are replaced only after confirmation, and a CPF that is
 * not regular at the Receita Federal asks before anything is filled.
 */
export type PersonLookupSpec = {
  /** Screen that asks, recorded in the lookup usage (e.g. `registry.customer`). */
  feature: string;
  documentKey: string;
  /** Field holding company/person; the button shows only for people. */
  typeKey: string;
  nameKey?: string;
  /** Receives the name too (the unified Registry form keeps a legal name for people). */
  legalNameKey?: string;
  birthDateKey?: string;
};

type PersonItem = {
  document?: string;
  name?: string;
  socialName?: string | null;
  birthDate?: string | null;
  registrationStatus?: string | null;
  deceased?: boolean | null;
};

const STATUS_LABELS: Record<string, string> = {
  suspended: 'suspended',
  pending: 'pending regularization',
  deceased: 'deceased',
  cancelled: 'cancelled',
  null: 'null (nula)',
};

export function normalizeCpf(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '');
}

/** CPF check digits (Receita Federal rule, same as the API and database). */
export function isValidCpf(value: string): boolean {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;
  const digit = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(value[i]) * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(9) === Number(value[9]) && digit(10) === Number(value[10]);
}

/** Form values the answer would set, by field key (empty answers are skipped). */
export function personLookupValues(
  spec: PersonLookupSpec,
  item: PersonItem,
): ConfigurableCrudRecord {
  const values: ConfigurableCrudRecord = {};
  const put = (key: string | undefined, value: unknown) => {
    const text = String(value ?? '').trim();
    if (key && text) values[key] = text;
  };
  put(spec.documentKey, item.document);
  // The social name is how the person asked to be called (Decree 8.727/2016).
  put(spec.nameKey, item.socialName || item.name);
  put(spec.legalNameKey, item.name);
  put(spec.birthDateKey, item.birthDate);
  return values;
}

function errorText(error: unknown): string {
  const body = (error as { error?: { error?: string } })?.error;
  return body?.error ?? '';
}

async function askPurpose(
  host: ConfigurableCrudPageBase<ConfigurableCrudRecord>,
  data: PersonLookupDialogData,
): Promise<PersonLookupDialogResult | null> {
  const ref = host.openLookupDialog<PersonLookupDialogComponent, PersonLookupDialogResult>(
    PersonLookupDialogComponent,
    { width: '560px', maxWidth: '95vw', autoFocus: false, data },
  );
  return (await firstValueFrom(ref.afterClosed())) ?? null;
}

async function runPersonLookup(
  spec: PersonLookupSpec,
  host: ConfigurableCrudPageBase<ConfigurableCrudRecord>,
): Promise<void> {
  const current = host.formValues();
  const cpf = normalizeCpf(current[spec.documentKey]);
  if (!isValidCpf(cpf)) {
    host.snack.warning(host.translate('Inform a valid CPF to search.'));
    return;
  }
  const answer = await askPurpose(host, {
    cpf,
    birthDate: spec.birthDateKey ? current[spec.birthDateKey] : null,
  });
  if (!answer) return;
  const query = new URLSearchParams({
    purpose: answer.purpose,
    legalBasis: answer.legalBasis,
    feature: spec.feature,
    ...(answer.birthDate ? { birthDate: answer.birthDate } : {}),
  });
  let item: PersonItem;
  try {
    const response = await host.api.get<{ data?: { item?: PersonItem } }>(
      `lookups/person/${cpf}?${query}`,
      { silent: true },
    );
    item = response?.data?.item ?? {};
  } catch (error) {
    host.snack.error(host.translate(errorText(error) || 'Failed to search CPF.'));
    return;
  }
  const status = item.deceased ? 'deceased' : String(item.registrationStatus ?? '');
  if (status && status !== 'regular') {
    const proceed = await host.askConfirmation(
      'CPF is not regular',
      host.translate(
        'This CPF is {{ status }} at the Receita Federal. Fill the form with its data anyway?',
        { status: host.translate(STATUS_LABELS[status] ?? status) },
      ),
      'Fill anyway',
    );
    if (!proceed) return;
  }
  let values = personLookupValues(spec, item);
  const conflicts = companyLookupConflicts(host.formValues(), values, spec.documentKey);
  if (conflicts.length) {
    const replace = await host.askConfirmation(
      'Replace filled fields?',
      'Some fields already have other values. Replace them with the CPF data? Otherwise only empty fields are filled.',
      'Replace',
    );
    if (!replace) {
      values = Object.fromEntries(
        Object.entries(values).filter(([key]) => !conflicts.includes(key)),
      );
    }
  }
  host.applyLookupValues(values);
  host.snack.success(host.translate('CPF data filled.'));
}

/** Suffix button of the document field, shown for people only. */
export function personLookupButton(spec: PersonLookupSpec): ConfigurableCrudFieldSuffixButton {
  return {
    icon: 'person_search',
    tooltip: 'Search CPF',
    visibleWhen: ({ values }) => String(values[spec.typeKey] ?? '') === 'person',
    onClick: (_context, host) =>
      runPersonLookup(spec, host as ConfigurableCrudPageBase<ConfigurableCrudRecord>),
  };
}
