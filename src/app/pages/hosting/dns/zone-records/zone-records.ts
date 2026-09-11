import { BreadcrumbLabelsService } from '../../../../shared/breadcrumb/breadcrumb-labels.service';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudFilters,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';

const TYPES = ['A', 'AAAA', 'CAA', 'CNAME', 'MX', 'NS', 'SRV', 'TXT', 'PTR'];
const config: ConfigurableCrudConfig = {
  endpoint: '',
  uuidField: 'line',
  pageTitle: 'DNS records',
  pageDescription: 'Live records from the DNS server. Changes are applied immediately.',
  createTitle: 'New DNS record',
  editTitle: 'Edit DNS record',
  dialogDescription: 'SOA and apex nameservers are managed by the DNS server.',
  searchPlaceholder: 'Search DNS records',
  emptyLabel: 'No records found.',
  deleteTitle: 'Delete DNS record',
  deleteMessage: 'Delete this record from the DNS server?',
  deleteSelectedTitle: 'Delete DNS records',
  deleteSelectedMessage: 'Delete selected DNS records?',
  savedMessage: 'DNS record saved and verified.',
  deletedMessage: 'DNS record deleted and verified.',
  deleteFailedMessage: 'Failed to delete DNS record.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  statusFilter: false,
  bulkDelete: false,
  canEditRow: (row) => row['editable'] === true,
  canDeleteRow: (row) => row['editable'] === true,
  initialValues: {
    name: '@',
    type: 'A',
    ttl: 300,
    value: '',
    priority: 0,
    weight: 0,
    port: 0,
    flags: 0,
    tag: 'issue',
  },
  columns: [
    { id: 'name', label: 'Name', field: 'name' },
    { id: 'type', label: 'Type', field: 'type' },
    { id: 'value', label: 'Value', field: 'displayValue' },
    { id: 'ttl', label: 'TTL', field: 'ttl' },
  ],
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true, span: 1 },
    {
      key: 'type',
      label: 'Type',
      type: 'select',
      required: true,
      span: 1,
      options: TYPES.map((value) => ({ value, label: value })),
      translateOptions: false,
    },
    { key: 'ttl', label: 'TTL', type: 'number', required: true, span: 1 },
    {
      key: 'priority',
      label: 'Priority',
      type: 'number',
      span: 1,
      hiddenWhen: ({ values }) => !['MX', 'SRV'].includes(String(values['type'])),
    },
    {
      key: 'weight',
      label: 'Weight',
      type: 'number',
      span: 1,
      hiddenWhen: ({ values }) => values['type'] !== 'SRV',
    },
    {
      key: 'port',
      label: 'Port',
      type: 'number',
      span: 1,
      hiddenWhen: ({ values }) => values['type'] !== 'SRV',
    },
    {
      key: 'flags',
      label: 'Flags',
      type: 'number',
      span: 1,
      hiddenWhen: ({ values }) => values['type'] !== 'CAA',
    },
    {
      key: 'tag',
      label: 'Tag',
      type: 'text',
      span: 1,
      hiddenWhen: ({ values }) => values['type'] !== 'CAA',
    },
    {
      key: 'value',
      label: 'Value',
      type: 'textarea',
      required: true,
      span: 4,
      placeholder: 'For TXT, use one line per string (maximum 255 bytes per line).',
    },
  ],
};

@Component({
  selector: 'app-hosting-dns-zone-records',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingDnsZoneRecordsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly breadcrumbLabels = inject(BreadcrumbLabelsService);
  private clearBreadcrumb: (() => void) | undefined;
  private serial: number | string = 0;
  private formSerial: number | string = 0;
  constructor() {
    super(config);
    this.destroyRef.onDestroy(() => this.clearBreadcrumb?.());
  }
  override backLink(): string {
    return this.router.url.split(/[?#]/)[0].replace(/\/records$/, '');
  }

  protected override listEndpoint() {
    return `hosting/dns/domains/${encodeURIComponent(this.route.snapshot.paramMap.get('uuid') ?? '')}/zone-records`;
  }
  protected override createEndpoint() {
    return this.listEndpoint();
  }
  protected override updateEndpoint() {
    return this.listEndpoint();
  }
  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    const response = await this.api.get<{
      data: { serial: number | string; items: ConfigurableCrudRecord[] };
    }>(this.listEndpoint());
    this.serial = response.data.serial;
    const soa = response.data.items.find((row) => row['type'] === 'SOA');
    this.clearBreadcrumb?.();
    if (soa)
      this.clearBreadcrumb = this.breadcrumbLabels.register(
        this.router.url.split('?')[0].replace(/\/records$/, ''),
        String(soa['name']).replace(/\.$/, ''),
      );
    const search = filters.search.trim().toLowerCase();
    return response.data.items
      .filter(
        (row) =>
          !search ||
          [row['name'], row['type'], ...(row['data'] as string[])]
            .join(' ')
            .toLowerCase()
            .includes(search),
      )
      .map((row) => {
        const data = row['data'] as string[];
        return {
          ...row,
          line: String(row['line']),
          snapshotSerial: this.serial,
          displayValue: data.join(' '),
          value: row['type'] === 'TXT' ? data.join('\n') : data.at(-1),
          priority: ['MX', 'SRV'].includes(String(row['type'])) ? Number(data[0]) : 0,
          weight: row['type'] === 'SRV' ? Number(data[1]) : 0,
          port: row['type'] === 'SRV' ? Number(data[2]) : 0,
          flags: row['type'] === 'CAA' ? Number(data[0]) : 0,
          tag: row['type'] === 'CAA' ? data[1] : 'issue',
        };
      });
  }
  override startCreate() {
    this.formSerial = this.serial;
    super.startCreate();
  }
  override startEdit(row: ConfigurableCrudRecord) {
    if (row['editable'] !== true) {
      this.snack.info(this.t('This DNS record is managed by the server.'));
      return;
    }
    this.formSerial = row['snapshotSerial'] as number | string;
    super.startEdit(row);
  }
  protected override augmentPayload(payload: ConfigurableCrudRecord) {
    const type = String(payload['type']);
    const value = String(payload['value'] ?? '');
    let data = [value];
    if (type === 'TXT') data = value.split('\n');
    if (type === 'MX') data = [String(payload['priority']), value];
    if (type === 'SRV')
      data = [
        String(payload['priority']),
        String(payload['weight']),
        String(payload['port']),
        value,
      ];
    if (type === 'CAA') data = [String(payload['flags']), String(payload['tag']), value];
    return {
      serial: this.formSerial,
      record: { name: payload['name'], type, ttl: Number(payload['ttl']), data },
    };
  }
  protected override validatePayload(_payload: ConfigurableCrudRecord) {
    return true;
  }
  protected override afterSave(context: { response: unknown; saveAndNew: boolean }) {
    const response = context.response as { data?: { serial?: number | string } };
    if (typeof response.data?.serial === 'number' || typeof response.data?.serial === 'string') {
      this.serial = response.data.serial;
      if (context.saveAndNew) this.formSerial = this.serial;
    }
  }
  override async saveItem(saveAndNew = false) {
    if (this.saving() || this.mutating()) return;
    await super.saveItem(saveAndNew);
    if (saveAndNew) this.formSerial = this.serial;
  }
  override async deleteItem(row: ConfigurableCrudRecord) {
    if (this.mutating() || row['editable'] !== true) return;
    if (!(await this.confirmAction(config.deleteTitle, config.deleteMessage))) return;
    this.mutating.set(true);
    try {
      await this.api.delete(`${this.listEndpoint()}/${this.recordUUID(row)}`, {
        serial: row['snapshotSerial'],
      });
      this.snack.success(this.t(config.deletedMessage));
      this.refreshList();
    } catch (error) {
      this.snack.error(this.errorMessage(error));
    } finally {
      this.mutating.set(false);
    }
  }
}
