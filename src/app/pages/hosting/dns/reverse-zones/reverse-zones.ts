import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudColumn,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';
import { openGeneratedRecords } from '../../../dns/generated-records';

/** Tenant: reverse zones of the ISP addresses (PD5c). Master: platform zones of the VPS public IPs (PD5b). */
const SCOPES = {
  tenant: {
    endpoint: 'dns/reverse-zones',
    prefix: 'Drz',
    domains: 'hosting/dns/domains',
    title: 'dns.reverseZones',
    description: 'dns.reverseZonesDescription',
    zoneHelp: 'dns.reverseZoneHelp',
    recordsDescription: 'dns.reverseRecordsDescription',
  },
  master: {
    endpoint: 'system/dns/vps-reverse-zones',
    prefix: 'Dvr',
    domains: 'system/hosting/dns/domains',
    title: 'dns.vpsReverseZones',
    description: 'dns.vpsReverseZonesDescription',
    zoneHelp: 'dns.vpsReverseZoneHelp',
    recordsDescription: 'dns.vpsReverseRecordsDescription',
  },
} as const;

type Scope = (typeof SCOPES)[keyof typeof SCOPES];

const RECORDS_ACTION: ConfigurableCrudRowAction = {
  key: 'records',
  label: 'dns.reverseRecords',
  icon: 'swap_horiz',
  tooltip: 'dns.reverseRecordsTooltip',
};

// [id, field (after the scope prefix), label, kind] of each list column.
const reverseZoneColumns = (prefix: string): ConfigurableCrudColumn[] =>
  (
    [
      ['zone', 'ZoneName', 'dns.reverseZone', 'identity'],
      ['suffix', `${prefix}ForwardSuffix`, 'dns.reverseSuffix', 'text'],
      ['records', 'RecordCount', 'dns.reverseRecords', 'text'],
      ['synced', `${prefix}SyncedAt`, 'dns.hostZoneSyncedAt', 'datetime'],
      ['status', `${prefix}Enabled`, 'Status', 'status'],
    ] as const
  ).map(([id, field, label, kind]) => ({ id, field, label, kind }));

const recordsLabels = (scope: Scope) => ({
  title: 'dns.reverseRecords',
  description: scope.recordsDescription,
  zone: 'dns.reverseZone',
  syncedAt: 'dns.hostZoneSyncedAt',
  empty: 'dns.reverseRecordsEmpty',
});

/** Reverse zones that receive generated PTR records, in the scope the route names. */
const configFor = (scope: Scope) =>
  defineCrud({
    endpoint: scope.endpoint,
    uuidField: `${scope.prefix}UUID`,
    pageTitle: scope.title,
    pageDescription: scope.description,
    dialogDescription: scope.description,
    columns: reverseZoneColumns(scope.prefix),
    rowActions: [RECORDS_ACTION],
    bulkDelete: false,
    initialValues: { status: 1, domainUUID: '', suffix: '', revision: 1 },
    fields: [
      { type: 'status', key: 'status', source: `${scope.prefix}Enabled`, label: 'Status', span: 1 },
      {
        type: 'search-select',
        key: 'domainUUID',
        source: 'DomainUUID',
        label: 'dns.reverseZone',
        help: scope.zoneHelp,
        required: true,
        disabledWhen: ({ editing }) => editing,
        remoteLookup: {
          endpoint: scope.domains,
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
        source: `${scope.prefix}ForwardSuffix`,
        label: 'dns.reverseSuffix',
        help: 'dns.reverseSuffixHelp',
        required: true,
        span: 1,
      },
      {
        type: 'number',
        key: 'revision',
        source: `${scope.prefix}Revision`,
        label: 'Revision',
        hidden: true,
      },
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
    deletePayload: (row) => ({ revision: Number(row[`${scope.prefix}Revision`]) }),
  });

@Component({
  standalone: true,
  selector: 'app-dns-reverse-zones',
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
  imports: CONFIGURABLE_CRUD_IMPORTS,
})
export class DnsReverseZonesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly scope: Scope;

  constructor() {
    const scope =
      inject(ActivatedRoute).snapshot.data?.['scope'] === 'master' ? SCOPES.master : SCOPES.tenant;
    super(configFor(scope));
    this.scope = scope;
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key === RECORDS_ACTION.key) await this.showRecords(this.recordUUID(row));
  }

  /** Generated PTR of one reverse zone, read only. */
  private async showRecords(uuid: unknown) {
    const url = `${this.scope.endpoint}/${String(uuid)}/records`;
    await openGeneratedRecords(this.api, this.dialog, url, recordsLabels(this.scope)).catch(
      (error) => this.snack.error(this.t(this.errorMessage(error))),
    );
  }
}
