import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

const PURPOSES = ['pabx', 'sbc', 'softswitch'].map((value) => ({
  value,
  label: `voipCluster.${value}`,
}));
const STATES = ['preparing', 'draining', 'maintenance'].map((value) => ({
  value,
  label: `voipCluster.${value}`,
}));
const ENGINES = [
  { value: 'freeswitch', label: 'FreeSWITCH' },
  { value: 'asterisk', label: 'Asterisk' },
  { value: 'opensips', label: 'OpenSIPS' },
  { value: 'kamailio', label: 'Kamailio' },
];

function members(row: ConfigurableCrudRecord) {
  const purpose = String(row['VclPurpose']);
  const [source, labelField] =
    purpose === 'pabx'
      ? ['VoipPabxServerVpsUUID', 'VpsName']
      : purpose === 'sbc'
        ? ['VoipSbcServerVbsUUID', 'VbsName']
        : ['VoipSoftswitchServerVsrUUID', 'VsrName'];
  const uuidField = purpose === 'pabx' ? 'VpsUUID' : purpose === 'sbc' ? 'VbsUUID' : 'VsrUUID';
  return defineCrud({
    endpoint: `system/voip/clusters/${row['VclUUID']}/members`,
    uuidField: 'VcmUUID',
    pageTitle: 'voipCluster.members',
    pageDescription: 'voipCluster.membersDescription',
    serverSidePagination: true,
    initialPageSize: 50,
    // Revision-checked individual deletion; no bulk endpoint.
    bulkDelete: false,
    deletePayload: (member) => ({ revision: Number(member['VcmRevision']) }),
    rowActions:
      purpose === 'pabx'
        ? [
            {
              key: 'prepare',
              label: 'voipCluster.prepare',
              icon: 'sync',
              visible: (member) => member['VcmState'] === 'preparing',
              request: {
                method: 'post',
                endpoint: (member) =>
                  `system/voip/clusters/${row['VclUUID']}/members/${member['VcmUUID']}/prepare`,
                body: (member) => ({ revision: Number(member['VcmRevision']) }),
                successMessage: 'voipCluster.preparationQueued',
              },
            },
          ]
        : [],
    initialValues: {
      [source]: '',
      capacityCalls: '',
      capacityCps: '',
      failureDomain: '',
      state: 'preparing',
      revision: 1,
    },
    payload: (v, editing) => ({
      capacityCalls: Number(v['capacityCalls']),
      capacityCps: Number(v['capacityCps']),
      failureDomain: v['failureDomain'],
      ...(editing
        ? { revision: Number(v['revision']), state: v['state'] }
        : { [source]: v[source] }),
    }),
    fields: [
      {
        key: source,
        source,
        label: 'Server',
        type: 'search-select',
        required: true,
        span: 1,
        disabledWhen: ({ editing }) => editing,
        remoteLookup: { endpoint: `system/voip/${purpose}/servers`, uuidField, labelField },
        help: 'voipCluster.serverHelp',
      },
      {
        key: 'capacityCalls',
        source: 'VcmCapacityCalls',
        label: 'voipCluster.capacityCalls',
        type: 'number',
        required: true,
        positive: true,
        span: 1,
        help: 'voipCluster.capacityHelp',
      },
      {
        key: 'capacityCps',
        source: 'VcmCapacityCps',
        label: 'voipCluster.capacityCps',
        type: 'number',
        required: true,
        positive: true,
        span: 1,
      },
      {
        key: 'failureDomain',
        source: 'VcmFailureDomain',
        label: 'voipCluster.failureDomain',
        required: true,
        span: 1,
        help: 'voipCluster.failureDomainHelp',
      },
      {
        key: 'state',
        source: 'VcmState',
        label: 'voipCluster.state',
        type: 'select',
        translateOptions: true,
        options: STATES,
        span: 1,
        hiddenWhen: ({ editing }) => !editing,
        help: 'voipCluster.stateHelp',
      },
      { key: 'revision', source: 'VcmRevision', label: 'Revision', type: 'number', hidden: true },
    ],
    columns: [
      { id: 'server', field: 'ServerName', label: 'Server', kind: 'identity' },
      {
        id: 'state',
        field: 'VcmState',
        label: 'voipCluster.state',
        value: (m, t) => t(`voipCluster.${m['VcmState']}`),
      },
      { id: 'calls', field: 'VcmCapacityCalls', label: 'voipCluster.capacityCalls' },
      { id: 'cps', field: 'VcmCapacityCps', label: 'voipCluster.capacityCps' },
      { id: 'failureDomain', field: 'VcmFailureDomain', label: 'voipCluster.failureDomain' },
      {
        id: 'observedChannelStarts',
        field: 'VloChannelStartsPeak',
        label: 'voipCluster.observedChannelStarts',
        value: (member, t) =>
          member['VloChannelStartsPeak'] == null
            ? t('voipCluster.unknown')
            : String(Number(member['VloChannelStartsPeak'])),
      },
      {
        id: 'observedCalls',
        field: 'VloActiveCalls',
        label: 'voipCluster.observedCalls',
        value: (row, t) =>
          row['VloActiveCalls'] == null ? t('voipCluster.unknown') : String(row['VloActiveCalls']),
      },
      {
        id: 'cpu',
        field: 'VloCpuPercent',
        label: 'voipCluster.cpu',
        value: (row, t) =>
          row['VloCpuPercent'] == null
            ? t('voipCluster.unknown')
            : `${Number(row['VloCpuPercent']).toFixed(1)}%`,
      },
      {
        id: 'memory',
        field: 'VloMemoryPercent',
        label: 'voipCluster.memory',
        value: (row, t) =>
          row['VloMemoryPercent'] == null
            ? t('voipCluster.unknown')
            : `${Number(row['VloMemoryPercent']).toFixed(1)}%`,
      },
      {
        id: 'freshness',
        field: 'ObservationFresh',
        label: 'voipCluster.freshness',
        value: (row, t) =>
          t(Number(row['ObservationFresh']) === 1 ? 'voipCluster.fresh' : 'voipCluster.stale'),
      },
    ],
  });
}

const config = defineCrud({
  endpoint: 'system/voip/clusters',
  uuidField: 'VclUUID',
  pageTitle: 'voipCluster.title',
  pageDescription: 'voipCluster.description',
  serverSidePagination: true,
  initialPageSize: 50,
  // Revision-checked individual deletion; no bulk endpoint.
  bulkDelete: false,
  deletePayload: (row) => ({ revision: Number(row['VclRevision']) }),
  initialValues: {
    name: '',
    purpose: 'pabx',
    engine: 'freeswitch',
    region: '',
    reservePercent: 30,
    observationMaxAgeSeconds: 120,
    status: 0,
    notes: '',
    revision: 1,
  },
  payload: (v, editing) => ({
    name: v['name'],
    reservePercent: Number(v['reservePercent']),
    observationMaxAgeSeconds: Number(v['observationMaxAgeSeconds']),
    status: Number(v['status']),
    notes: v['notes'] || null,
    ...(editing
      ? { revision: Number(v['revision']) }
      : { purpose: v['purpose'], engine: v['engine'], region: v['region'] }),
  }),
  listFilters: [
    {
      key: 'purpose',
      label: 'voipCluster.purpose',
      type: 'select',
      options: PURPOSES,
      translateOptions: true,
    },
  ],
  // The collection dialog preserves per-member revision-checked updates/deletions.
  rowActions: [{ key: 'members', label: 'voipCluster.members', icon: 'dns', collection: members }],
  fields: [
    { key: 'status', source: 'VclStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'VclName', label: 'Name', required: true, span: 1 },
    {
      key: 'purpose',
      source: 'VclPurpose',
      label: 'voipCluster.purpose',
      type: 'select',
      translateOptions: true,
      options: PURPOSES,
      required: true,
      span: 1,
      disabledWhen: ({ editing }) => editing,
    },
    {
      key: 'engine',
      source: 'VclEngine',
      label: 'Engine',
      type: 'select',
      options: ENGINES,
      translateOptions: false,
      required: true,
      span: 1,
      disabledWhen: ({ editing }) => editing,
      help: 'voipCluster.engineHelp',
    },
    {
      key: 'region',
      source: 'VclRegion',
      label: 'voipCluster.region',
      required: true,
      span: 1,
      disabledWhen: ({ editing }) => editing,
    },
    {
      key: 'reservePercent',
      source: 'VclReservePercent',
      label: 'voipCluster.reserve',
      type: 'number',
      required: true,
      span: 1,
      help: 'voipCluster.reserveHelp',
    },
    {
      key: 'observationMaxAgeSeconds',
      source: 'VclObservationMaxAgeSeconds',
      label: 'voipCluster.maxAge',
      type: 'number',
      required: true,
      span: 1,
      help: 'voipCluster.maxAgeHelp',
    },
    { key: 'revision', source: 'VclRevision', label: 'Revision', type: 'number', hidden: true },
    { key: 'notes', source: 'VclNotes', label: 'Notes', type: 'textarea', tab: 'notes', span: 4 },
  ],
  columns: [
    { id: 'name', field: 'VclName', label: 'Name', kind: 'identity' },
    {
      id: 'purpose',
      field: 'VclPurpose',
      label: 'voipCluster.purpose',
      value: (row, t) => t(`voipCluster.${row['VclPurpose']}`),
    },
    { id: 'engine', field: 'VclEngine', label: 'Engine' },
    { id: 'region', field: 'VclRegion', label: 'voipCluster.region' },
    { id: 'members', field: 'MemberCount', label: 'voipCluster.members' },
    { id: 'status', field: 'VclStatus', label: 'Status', kind: 'status' },
  ],
});

@Component({
  selector: 'app-voip-clusters',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipClustersPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
