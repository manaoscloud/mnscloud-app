import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudColumn,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';
import { openGeneratedRecords } from '../../../dns/generated-records';

const ENDPOINT = 'dns/reverse-zones';

const RECORDS_ACTION: ConfigurableCrudRowAction = {
  key: 'records',
  label: 'dns.reverseRecords',
  icon: 'swap_horiz',
  tooltip: 'dns.reverseRecordsTooltip',
};

// [id, field, label, kind] of each list column.
const REVERSE_ZONE_COLUMNS: ConfigurableCrudColumn[] = (
  [
    ['zone', 'ZoneName', 'dns.reverseZone', 'identity'],
    ['suffix', 'DrzForwardSuffix', 'dns.reverseSuffix', 'text'],
    ['records', 'RecordCount', 'dns.reverseRecords', 'text'],
    ['synced', 'DrzSyncedAt', 'dns.hostZoneSyncedAt', 'datetime'],
    ['status', 'DrzEnabled', 'Status', 'status'],
  ] as const
).map(([id, field, label, kind]) => ({ id, field, label, kind }));

const RECORDS_LABELS = {
  title: 'dns.reverseRecords',
  description: 'dns.reverseRecordsDescription',
  zone: 'dns.reverseZone',
  syncedAt: 'dns.hostZoneSyncedAt',
  empty: 'dns.reverseRecordsEmpty',
};

/** Automatic reverse DNS (PD5c): a reverse zone receives PTR records of the tenant ISP addresses. */
const config = defineCrud({
  endpoint: ENDPOINT,
  uuidField: 'DrzUUID',
  pageTitle: 'dns.reverseZones',
  pageDescription: 'dns.reverseZonesDescription',
  dialogDescription: 'dns.reverseZonesDescription',
  columns: REVERSE_ZONE_COLUMNS,
  rowActions: [RECORDS_ACTION],
  bulkDelete: false,
  initialValues: { status: 1, domainUUID: '', suffix: '', revision: 1 },
  fields: [
    { type: 'status', key: 'status', source: 'DrzEnabled', label: 'Status', span: 1 },
    {
      type: 'search-select',
      key: 'domainUUID',
      source: 'DomainUUID',
      label: 'dns.reverseZone',
      help: 'dns.reverseZoneHelp',
      required: true,
      disabledWhen: ({ editing }) => editing,
      remoteLookup: {
        endpoint: 'hosting/dns/domains',
        uuidField: 'HddUUID',
        labelField: 'HddName',
      },
      quickCreate: false,
      quickCreateExemptReason:
        'The reverse zone is a domain on MNSCloud DNS created in DNS › Zonas › Domínios.',
    },
    {
      type: 'text',
      key: 'suffix',
      source: 'DrzForwardSuffix',
      label: 'dns.reverseSuffix',
      help: 'dns.reverseSuffixHelp',
      required: true,
      span: 1,
    },
    { type: 'number', key: 'revision', source: 'DrzRevision', label: 'Revision', hidden: true },
  ],
  payload: (values, editing) => {
    const body: Record<string, unknown> = {
      domainUUID: values['domainUUID'],
      suffix: String(values['suffix'] ?? '').trim(),
      enabled: Number(values['status']) === 1 ? 1 : 0,
    };
    if (editing) body['revision'] = Number(values['revision']);
    return body;
  },
  deletePayload: (row) => ({ revision: Number(row['DrzRevision']) }),
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
    if (action.key === RECORDS_ACTION.key) await this.showRecords(this.recordUUID(row));
  }

  /** Generated PTR of one reverse zone, read only. */
  private async showRecords(uuid: unknown) {
    const url = `${ENDPOINT}/${String(uuid)}/records`;
    await openGeneratedRecords(this.api, this.dialog, url, RECORDS_LABELS).catch((error) =>
      this.snack.error(this.t(this.errorMessage(error))),
    );
  }
}
