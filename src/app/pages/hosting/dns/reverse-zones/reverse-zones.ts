import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudColumn,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';
import { openDataViewerDialog } from '../../../../shared/data-viewer-dialog/data-viewer-dialog';

const ENDPOINT = 'dns/reverse-zones';

const RECORDS_ACTION: ConfigurableCrudRowAction = {
  key: 'records',
  label: 'dns.reverseRecords',
  icon: 'swap_horiz',
  tooltip: 'dns.reverseRecordsTooltip',
};

const REVERSE_ZONE_COLUMNS: ConfigurableCrudColumn[] = [
  { id: 'zone', field: 'ZoneName', label: 'dns.reverseZone', kind: 'identity' },
  { id: 'suffix', field: 'DrzForwardSuffix', label: 'dns.reverseSuffix', kind: 'text' },
  { id: 'records', field: 'RecordCount', label: 'dns.reverseRecords', kind: 'text' },
  { id: 'synced', field: 'DrzSyncedAt', label: 'dns.hostZoneSyncedAt', kind: 'datetime' },
  { id: 'status', field: 'DrzEnabled', label: 'Status', kind: 'status' },
];

/** Automatic reverse DNS (PD5c): a reverse zone receives PTR records of the tenant ISP addresses. */
const config = defineCrud({
  endpoint: ENDPOINT,
  uuidField: 'DrzUUID',
  pageTitle: 'dns.reverseZones',
  pageDescription: 'dns.reverseZonesDescription',
  dialogDescription: 'dns.reverseZonesDescription',
  bulkDelete: false,
  deletePayload: (row) => ({ revision: Number(row['DrzRevision']) }),
  initialValues: { status: 1, domainUUID: '', suffix: '', revision: 1 },
  payload: (values, editing) => ({
    domainUUID: values['domainUUID'],
    suffix: String(values['suffix'] ?? '').trim(),
    enabled: Number(values['status']) === 1 ? 1 : 0,
    ...(editing ? { revision: Number(values['revision']) } : {}),
  }),
  fields: [
    { key: 'status', source: 'DrzEnabled', label: 'Status', type: 'status', span: 1 },
    {
      key: 'domainUUID',
      source: 'DomainUUID',
      label: 'dns.reverseZone',
      required: true,
      type: 'search-select',
      remoteLookup: {
        endpoint: 'hosting/dns/domains',
        uuidField: 'HddUUID',
        labelField: 'HddName',
      },
      quickCreate: false,
      quickCreateExemptReason:
        'The reverse zone is a domain on MNSCloud DNS created in DNS › Zonas › Domínios.',
      disabledWhen: ({ editing }) => editing,
      help: 'dns.reverseZoneHelp',
    },
    {
      key: 'suffix',
      source: 'DrzForwardSuffix',
      label: 'dns.reverseSuffix',
      required: true,
      type: 'text',
      span: 1,
      help: 'dns.reverseSuffixHelp',
    },
    { key: 'revision', source: 'DrzRevision', label: 'Revision', type: 'number', hidden: true },
  ],
  columns: REVERSE_ZONE_COLUMNS,
  rowActions: [RECORDS_ACTION],
});

@Component({
  standalone: true,
  selector: 'app-dns-reverse-zones',
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
  imports: CONFIGURABLE_CRUD_IMPORTS,
})
export class DnsReverseZonesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key !== 'records') return;
    try {
      const response = await this.api.get<{
        data?: { zone?: string; records?: Record<string, unknown>[]; syncedAt?: string };
      }>(`${ENDPOINT}/${this.recordUUID(row)}/records`);
      const records = (response?.data?.records ?? []).map((record) => ({
        name: String(record['name'] ?? ''),
        type: String(record['type'] ?? ''),
        value: Array.isArray(record['data']) ? record['data'].join(' ') : '',
      }));
      openDataViewerDialog(this.dialog, {
        title: 'dns.reverseRecords',
        description: 'dns.reverseRecordsDescription',
        details: [
          { label: 'dns.reverseZone', value: response?.data?.zone ?? '' },
          { label: 'dns.hostZoneSyncedAt', value: response?.data?.syncedAt ?? '' },
        ],
        sections: [
          {
            title: 'dns.reverseRecords',
            table: {
              columns: [
                { key: 'name', label: 'Name', monospace: true },
                { key: 'type', label: 'Type' },
                { key: 'value', label: 'Value', monospace: true },
              ],
              rows: records,
              emptyLabel: 'dns.reverseRecordsEmpty',
            },
          },
        ],
      });
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    }
  }
}
