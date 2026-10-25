import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

export type InfraGisUtilityResource =
  'lighting' | 'pole-attachments' | 'pole-price-rules' | 'pole-invoices';

const OCCUPANT_KINDS = [
  { value: 'OWN', label: 'Own network' },
  { value: 'THIRD_PARTY', label: 'Third party' },
];
const REGULARIZATION = [
  { value: 'REGULAR', label: 'Regular' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'IRREGULAR', label: 'Irregular' },
];
const OUTCOMES = [
  { value: 'MATCH', label: 'Match' },
  { value: 'POINTS_MISMATCH', label: 'Points differ' },
  { value: 'PRICE_MISMATCH', label: 'Amount differs' },
  { value: 'NOT_REGISTERED', label: 'Billed without registration' },
  { value: 'NOT_BILLED', label: 'Registered without billing' },
];
const label = (options: readonly { value: string; label: string }[], value: unknown) =>
  options.find((option) => option.value === value)?.label ?? String(value ?? '');

/** Decimal in pt-BR or en form ("6,50", "1.234,50", "6.50"). */
export function parseAmount(value: string): number {
  const text = value.trim().replace(/^R\$\s*/, '');
  if (!text) return 0;
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : Number.NaN;
}

/**
 * Lines pasted from the distributor invoice: one pole per line, `code;points;amount` (also tab or
 * comma separated when the amount uses a decimal point). A header line and empty lines are skipped.
 */
export function parseInvoiceLines(
  text: string,
): { poleCode: string; points: number; amount: number }[] {
  const lines: { poleCode: string; points: number; amount: number }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const parts = raw.includes(';') || raw.includes('\t') ? raw.split(/[;\t]/) : raw.split(',');
    const [code, points = '1', amount = '0'] = parts.map((part) => part.trim());
    if (!code) continue;
    const pointCount = Number(points || '1');
    if (!Number.isFinite(pointCount)) continue; // header
    lines.push({ poleCode: code, points: pointCount, amount: parseAmount(amount) });
  }
  return lines;
}

function reconciliation(row: ConfigurableCrudRecord): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: `infragis/pole-invoices/${String(row['IpvUUID'])}/reconciliation`,
    uuidField: 'PoleCode',
    pageTitle: 'Invoice reconciliation',
    pageDescription: `${String(row['IpvPoleOwner'] ?? '')} · ${String(row['IpvReferenceMonth'] ?? '').slice(0, 7)}`,
    emptyLabel: 'No lines and no own attachments for this owner.',
    canCreate: false,
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    statusFilter: false,
    initialValues: {},
    fields: [],
    columns: [
      { id: 'pole', field: 'PoleCode', label: 'Pole', kind: 'identity' },
      { id: 'name', field: 'PoleName', label: 'Asset' },
      {
        id: 'outcome',
        field: 'Outcome',
        label: 'Result',
        kind: 'status',
        options: OUTCOMES,
        chipClass: (value) =>
          value === 'MATCH'
            ? 'chip-success'
            : value === 'NOT_BILLED'
              ? 'chip-warning'
              : 'chip-failed',
      },
      { id: 'registered', field: 'RegisteredPoints', label: 'Registered points', kind: 'number' },
      { id: 'billed', field: 'BilledPoints', label: 'Billed points', kind: 'number' },
      { id: 'billedAmount', field: 'BilledAmount', label: 'Billed', kind: 'currency' },
      { id: 'expectedAmount', field: 'ExpectedAmount', label: 'Expected', kind: 'currency' },
    ],
  });
}

function linesForm(row: ConfigurableCrudRecord): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: `infragis/pole-invoices/${String(row['IpvUUID'])}/lines`,
    uuidField: 'IpvUUID',
    pageTitle: 'Add invoice lines',
    pageDescription: `${String(row['IpvPoleOwner'] ?? '')} · ${String(row['IpvReferenceMonth'] ?? '').slice(0, 7)}`,
    createTitle: 'Add invoice lines',
    dialogDescription:
      'One pole per line: pole plate or code; points; amount (for example PL-001;1;6,50).',
    savedMessage: 'Invoice lines processed.',
    statusFilter: false,
    initialValues: { text: '' },
    columns: [],
    fields: [{ key: 'text', label: 'Lines', type: 'textarea', rows: 10, required: true, span: 4 }],
    payload: (values) => ({ lines: parseInvoiceLines(String(values['text'] ?? '')) }),
  });
}

const CONFIGS: Record<InfraGisUtilityResource, ConfigurableCrudConfig> = {
  lighting: defineCrud({
    endpoint: 'infragis/lighting/summary',
    uuidField: 'Technology',
    pageTitle: 'Public lighting',
    pageDescription:
      'Light points by technology, installed power and points with open work orders.',
    emptyLabel: 'No light points. Apply the public lighting package and register the light points.',
    canCreate: false,
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    statusFilter: false,
    initialValues: {},
    fields: [],
    columns: [
      { id: 'technology', field: 'Technology', label: 'Technology', kind: 'identity' },
      { id: 'points', field: 'Points', label: 'Light points', kind: 'number' },
      { id: 'lamps', field: 'Lamps', label: 'Lamps', kind: 'number' },
      {
        id: 'power',
        field: 'InstalledWatts',
        label: 'Installed power',
        value: (row) =>
          `${(Number(row['InstalledWatts'] ?? 0) / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} kW`,
      },
      { id: 'withoutPower', field: 'PointsWithoutPower', label: 'Without power', kind: 'number' },
      {
        id: 'openOrders',
        field: 'PointsWithOpenOrders',
        label: 'With open work orders',
        kind: 'number',
      },
    ],
  }),
  'pole-attachments': defineCrud({
    endpoint: 'infragis/pole-attachments',
    uuidField: 'IpaUUID',
    pageTitle: 'Pole attachments',
    pageDescription:
      'Attachment points on the poles: your network and third parties, by pole owner.',
    createTitle: 'New pole attachment',
    editTitle: 'Edit pole attachment',
    bulkDelete: false,
    statusFilter: false,
    serverSidePagination: true,
    listFilters: [
      {
        key: 'occupantKind',
        label: 'Occupant',
        paramKey: 'occupantKind',
        type: 'select',
        span: 1,
        options: OCCUPANT_KINDS,
        emptyLabel: 'All',
      },
    ],
    initialValues: { occupantKind: 'OWN', points: 1, regularization: 'PENDING' },
    columns: [
      { id: 'pole', field: 'PoleName', label: 'Pole', uuidField: 'IpaUUID', kind: 'identity' },
      { id: 'code', field: 'PoleCode', label: 'Plate', translateValue: false },
      {
        id: 'kind',
        field: 'IpaOccupantKind',
        label: 'Occupant',
        value: (row, t) => t(label(OCCUPANT_KINDS, row['IpaOccupantKind'])),
      },
      { id: 'occupant', field: 'IpaOccupantName', label: 'Company' },
      { id: 'owner', field: 'IpaPoleOwner', label: 'Pole owner' },
      { id: 'points', field: 'IpaPoints', label: 'Points', kind: 'number' },
      {
        id: 'regularization',
        field: 'IpaRegularization',
        label: 'Regularization',
        kind: 'status',
        options: REGULARIZATION,
        chipClass: (value) =>
          value === 'REGULAR'
            ? 'chip-success'
            : value === 'IRREGULAR'
              ? 'chip-failed'
              : 'chip-warning',
      },
    ],
    fields: [
      {
        key: 'poleUUID',
        source: 'InfraGisAssetIgaUUID',
        label: 'Pole',
        type: 'search-select',
        required: true,
        quickCreate: false,
        quickCreateExemptReason:
          'A pole is drawn on the map with its position; it is not created from this form.',
        remoteLookup: {
          endpoint: 'infragis/assets',
          uuidField: 'IgaUUID',
          labelField: 'IgaName',
          selectedLabelField: 'PoleName',
        },
        span: 2,
      },
      {
        key: 'occupantKind',
        source: 'IpaOccupantKind',
        label: 'Occupant',
        type: 'select',
        options: OCCUPANT_KINDS,
        translateOptions: true,
        span: 2,
      },
      { key: 'occupantName', source: 'IpaOccupantName', label: 'Company', required: true, span: 2 },
      { key: 'occupantDocument', source: 'IpaOccupantDocument', label: 'Company tax ID', span: 2 },
      { key: 'poleOwner', source: 'IpaPoleOwner', label: 'Pole owner', required: true, span: 2 },
      { key: 'points', source: 'IpaPoints', label: 'Points', type: 'number', span: 1 },
      {
        key: 'regularization',
        source: 'IpaRegularization',
        label: 'Regularization',
        type: 'select',
        options: REGULARIZATION,
        translateOptions: true,
        span: 1,
      },
      { key: 'contractRef', source: 'IpaContractRef', label: 'Contract', span: 2 },
      { key: 'notes', source: 'IpaNotes', label: 'Notes', type: 'textarea', rows: 2, span: 4 },
    ],
  }),
  'pole-price-rules': defineCrud({
    endpoint: 'infragis/pole-price-rules',
    uuidField: 'IpqUUID',
    pageTitle: 'Pole prices',
    pageDescription:
      'Monthly price per attachment point by pole owner and start month, used by the reconciliation.',
    createTitle: 'New pole price',
    editTitle: 'Edit pole price',
    bulkDelete: false,
    statusFilter: false,
    initialValues: {},
    columns: [
      {
        id: 'owner',
        field: 'IpqPoleOwner',
        label: 'Pole owner',
        uuidField: 'IpqUUID',
        kind: 'identity',
      },
      { id: 'price', field: 'IpqPricePerPoint', label: 'Price per point', kind: 'currency' },
      { id: 'from', field: 'IpqValidFrom', label: 'Valid from', kind: 'date' },
      { id: 'notes', field: 'IpqNotes', label: 'Basis' },
    ],
    fields: [
      { key: 'poleOwner', source: 'IpqPoleOwner', label: 'Pole owner', required: true, span: 2 },
      {
        key: 'pricePerPoint',
        source: 'IpqPricePerPoint',
        label: 'Price per point',
        type: 'number',
        required: true,
        span: 1,
      },
      {
        key: 'validFrom',
        source: 'IpqValidFrom',
        label: 'Valid from',
        type: 'date',
        required: true,
        span: 1,
      },
      { key: 'notes', source: 'IpqNotes', label: 'Basis', type: 'textarea', rows: 2, span: 4 },
    ],
  }),
  'pole-invoices': defineCrud({
    endpoint: 'infragis/pole-invoices',
    uuidField: 'IpvUUID',
    pageTitle: 'Pole invoices',
    pageDescription:
      'Invoices received from the pole owners, reconciled against your registered points.',
    createTitle: 'Register pole invoice',
    canEdit: false,
    bulkDelete: false,
    statusFilter: false,
    initialValues: {},
    columns: [
      {
        id: 'owner',
        field: 'IpvPoleOwner',
        label: 'Pole owner',
        uuidField: 'IpvUUID',
        kind: 'identity',
      },
      {
        id: 'month',
        field: 'IpvReferenceMonth',
        label: 'Month',
        value: (row) => String(row['IpvReferenceMonth'] ?? '').slice(0, 7),
      },
      { id: 'number', field: 'IpvNumber', label: 'Number' },
      { id: 'total', field: 'IpvTotalAmount', label: 'Invoice total', kind: 'currency' },
      { id: 'lines', field: 'LineCount', label: 'Lines', kind: 'number' },
      { id: 'linesAmount', field: 'LinesAmount', label: 'Lines total', kind: 'currency' },
    ],
    fields: [
      { key: 'poleOwner', label: 'Pole owner', required: true, span: 2 },
      { key: 'referenceMonth', label: 'Month', type: 'date', required: true, span: 1 },
      { key: 'number', label: 'Number', span: 1 },
      { key: 'totalAmount', label: 'Invoice total', type: 'number', span: 1 },
    ],
    rowActions: [
      { key: 'lines', label: 'Add invoice lines', icon: 'playlist_add', form: linesForm },
      { key: 'reconcile', label: 'Reconciliation', icon: 'rule', collection: reconciliation },
    ],
  }),
};

/** InfraGIS › Public lighting and pole sharing pages (route data `resource`). */
@Component({
  selector: 'app-infragis-utilities',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class InfraGisUtilitiesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    const resource = inject(ActivatedRoute).snapshot.data['resource'] as InfraGisUtilityResource;
    super(CONFIGS[resource] ?? CONFIGS.lighting);
  }
}
