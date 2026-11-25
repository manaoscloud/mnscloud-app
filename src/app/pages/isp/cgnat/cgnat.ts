import { Component, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import {
  IspCgnatScriptDialogComponent,
  CgnatScriptDialogData,
} from './cgnat-script-dialog';

const VENDORS = [
  { value: 'MIKROTIK', label: 'MikroTik RouterOS' },
  { value: 'HUAWEI', label: 'Huawei VRP' },
  { value: 'JUNIPER', label: 'Juniper Junos' },
];

export function cgnatConfig(openScript: (row: ConfigurableCrudRecord) => void) {
  return defineCrud({
    endpoint: 'isp/cgnat-profiles',
    uuidField: 'IcpUUID',
    serverSidePagination: true,
    serverSideSorting: true,
    initialPageSize: 50,
    deletePayload: (row) => ({ revision: Number(row['IcpRevision']) }),
    bulkDeletePayload: (rows) => ({
      revisions: Object.fromEntries(
        rows.map((row) => [String(row['IcpUUID']), Number(row['IcpRevision'])]),
      ),
    }),
    pageTitle: 'nav.isp.cgnat',
    pageDescription:
      'Deterministic CGNAT profiles (RFC 7422) for IPv4 port mapping and router configuration scripts.',
    bulkDelete: true,
    initialValues: {
      status: 1,
      name: '',
      privatePrefix: '',
      publicPoolStart: '',
      publicPoolEnd: '',
      portsPerSub: 1024,
      startPort: 1024,
      endPort: 65535,
      vendor: 'MIKROTIK',
      notes: '',
    },
    columns: [
      { id: 'name', label: 'Name', field: 'IcpName', uuidField: 'IcpUUID', kind: 'identity' },
      { id: 'privatePrefix', label: 'Private Prefix', field: 'IcpPrivatePrefix' },
      { id: 'publicPoolStart', label: 'Public Start', field: 'IcpPublicPoolStart' },
      { id: 'publicPoolEnd', label: 'Public End', field: 'IcpPublicPoolEnd' },
      { id: 'portsPerSub', label: 'Ports / Sub', field: 'IcpPortsPerSub', kind: 'number' },
      { id: 'vendor', label: 'Vendor', field: 'IcpVendor', options: VENDORS },
      { id: 'status', label: 'Status', field: 'IcpStatus', kind: 'status' },
    ],
    fields: [
      { key: 'revision', source: 'IcpRevision', label: 'Revision', type: 'number', hidden: true },
      { key: 'status', source: 'IcpStatus', label: 'Status', type: 'status', span: 1 },
      { key: 'name', source: 'IcpName', label: 'Name', required: true, span: 1 },
      {
        key: 'vendor',
        source: 'IcpVendor',
        label: 'Vendor',
        type: 'select',
        required: true,
        options: VENDORS,
        span: 1,
      },
      {
        key: 'privatePrefix',
        source: 'IcpPrivatePrefix',
        label: 'Private Prefix (CIDR)',
        required: true,
        help: 'RFC 6598 carrier-grade private network (e.g. 100.64.0.0/24)',
        span: 1,
      },
      {
        key: 'publicPoolStart',
        source: 'IcpPublicPoolStart',
        label: 'Public Pool Start',
        required: true,
        span: 1,
      },
      {
        key: 'publicPoolEnd',
        source: 'IcpPublicPoolEnd',
        label: 'Public Pool End',
        required: true,
        span: 1,
      },
      {
        key: 'portsPerSub',
        source: 'IcpPortsPerSub',
        label: 'Ports per Subscriber',
        type: 'number',
        required: true,
        span: 1,
      },
      {
        key: 'startPort',
        source: 'IcpStartPort',
        label: 'Start Port',
        type: 'number',
        required: true,
        span: 1,
      },
      {
        key: 'endPort',
        source: 'IcpEndPort',
        label: 'End Port',
        type: 'number',
        required: true,
        span: 1,
      },
      {
        key: 'notes',
        source: 'IcpNotes',
        label: 'Notes',
        type: 'textarea',
        tab: 'notes',
        span: 4,
      },
    ],
    rowActions: [
      {
        key: 'generate-script',
        label: 'Generate script',
        icon: 'terminal',
        inline: true,
        run: (row) => openScript(row),
      },
    ],
  });
}

@Component({
  selector: 'app-isp-cgnat',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class IspCgnatPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(cgnatConfig((row) => this.openScriptModal(row)));
  }

  private openScriptModal(row: ConfigurableCrudRecord) {
    this.dialog.open(IspCgnatScriptDialogComponent, {
      data: {
        profileUUID: String(row['IcpUUID']),
        name: String(row['IcpName'] ?? 'CGNAT'),
        vendor: String(row['IcpVendor'] ?? 'MIKROTIK'),
      } satisfies CgnatScriptDialogData,
      panelClass: 'modal-dialog',
    });
  }
}
