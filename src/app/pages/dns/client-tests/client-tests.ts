import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import {
  DataViewerTone,
  openDataViewerDialog,
} from '../../../shared/data-viewer-dialog/data-viewer-dialog';

type Row = Record<string, unknown>;

// Tenant support reads `support/client-tests` (own portal); masters read `system/dns/client-tests`.
const config = defineCrud({
  endpoint: 'system/dns/client-tests',
  uuidField: 'DctUUID',
  pageTitle: 'dns.clientTests',
  pageDescription: 'dns.clientTestsDescription',
  serverSidePagination: true,
  initialPageSize: 50,
  // A test is what the subscriber's browser observed: never created, edited or deleted here.
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  statusFilter: false,
  searchPlaceholder: 'dns.clientTestsSearch',
  rowActions: [{ key: 'result', label: 'dns.clientTestResult', icon: 'network_check' }],
  fields: [],
  columns: [
    { id: 'code', field: 'DctCode', label: 'dns.clientTestCode', kind: 'identity' },
    {
      id: 'verdict',
      field: 'DctVerdict',
      label: 'dns.clientTestVerdict',
      kind: 'text',
      value: (row, translate) => translate(`dns.clientTestVerdicts.${row['DctVerdict']}`),
    },
    {
      id: 'operator',
      field: 'DctOperator',
      label: 'dns.diagnosisOperator',
      kind: 'text',
      value: (row) =>
        [row['DctAsn'] ? `AS${row['DctAsn']}` : '', row['DctOperator']].filter(Boolean).join(' · '),
    },
    { id: 'address', field: 'DctClientIP', label: 'dns.clientTestAddress', kind: 'text' },
    { id: 'host', field: 'DctHost', label: 'dns.clientTestHost', kind: 'text', optional: true },
    { id: 'created', field: 'DctDateCreated', label: 'Created at', kind: 'datetime' },
  ],
});

const TONES: Record<string, DataViewerTone> = {
  ok: 'success',
  partial: 'warning',
  no_internet: 'danger',
};

const yesNo = (value: unknown) =>
  value === true
    ? 'dns.clientTestYes'
    : value === false
      ? 'dns.clientTestNo'
      : 'dns.clientTestUnknown';

@Component({
  selector: 'app-dns-client-tests',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class DnsClientTestsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super({
      ...config,
      endpoint: inject(ActivatedRoute).snapshot.data['endpoint'] ?? config.endpoint,
    });
  }

  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: ConfigurableCrudRecord,
  ): Promise<void> {
    if (action.key !== 'result') return super.handleRowAction(action, row);
    try {
      const response = await this.api.get<{ data?: Row }>(
        `${this.config.endpoint}/${String(row['DctUUID'])}`,
      );
      if (response?.data) this.open(response.data);
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    }
  }

  private open(data: Row): void {
    const result = (data['DctResultJson'] ?? {}) as Row;
    const services = Array.isArray(result['services']) ? (result['services'] as Row[]) : [];
    const notes = Array.isArray(result['notes']) ? (result['notes'] as string[]) : [];
    const verdict = String(data['DctVerdict'] ?? '');
    openDataViewerDialog(this.dialog, {
      title: 'dns.clientTestResult',
      description: String(data['DctCode'] ?? ''),
      status: {
        label: 'dns.clientTestVerdict',
        value: `dns.clientTestVerdicts.${verdict}`,
        tone: TONES[verdict] ?? 'neutral',
      },
      details: [
        { label: 'dns.clientTestCode', value: data['DctCode'], monospace: true },
        { label: 'Created at', value: data['DctDateCreated'], kind: 'datetime' },
        {
          label: 'dns.clientTestAddress',
          value: `${data['DctClientIP']} (IPv${data['DctFamily']})`,
          monospace: true,
        },
        {
          label: 'dns.diagnosisOperator',
          value:
            [data['DctAsn'] ? `AS${data['DctAsn']}` : '', data['DctOperator']]
              .filter(Boolean)
              .join(' · ') || '—',
        },
        { label: 'dns.clientTestIpv4', value: yesNo(result['ipv4']), translate: true },
        { label: 'dns.clientTestIpv6', value: yesNo(result['ipv6']), translate: true },
        {
          label: 'dns.clientTestDnssec',
          value: `dns.clientTestDnssecStates.${String(result['dnssec'] ?? 'unknown')}`,
          translate: true,
        },
        {
          label: 'dns.diagnosisNotes',
          value: notes.map((note) => this.t(`dns.clientTestNotes.${note}`)).join(' · ') || '—',
          wide: true,
        },
        { label: 'dns.clientTestHost', value: data['DctHost'] },
        { label: 'dns.clientTestBrowser', value: data['DctUserAgent'] ?? '—', wide: true },
      ],
      sections: [
        {
          title: 'dns.clientTestServices',
          table: {
            columns: [
              { key: 'service', label: 'dns.clientTestService', translate: false },
              { key: 'state', label: 'Status', translate: true },
              { key: 'ms', label: 'dns.diagnosisLatency', translate: false },
            ],
            rows: services.map((service) => ({
              service: String(service['key']),
              state: service['ok'] ? 'dns.clientTestYes' : 'dns.clientTestNo',
              ms: service['ms'] == null ? '—' : `${service['ms']} ms`,
            })),
            emptyLabel: 'dns.clientTestNoServices',
          },
        },
      ],
    });
  }
}
