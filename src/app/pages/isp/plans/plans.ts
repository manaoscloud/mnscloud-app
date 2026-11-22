import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudField,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { quickCreateFor } from '../../../shared/crud/configurable-crud/quick-create';
import { ispChildCollection } from '../isp-child-crud';

const TECHNOLOGIES = [
  { value: 'FTTH', label: 'FTTH' },
  { value: 'RADIO', label: 'Radio' },
  { value: 'CABLE', label: 'Cable' },
  { value: 'DSL', label: 'DSL' },
  { value: 'OTHER', label: 'Other' },
];

const ADDON_NATURES = [
  { value: 'sva', label: 'Value-added service' },
  { value: 'communication', label: 'Communication' },
];

const profileLookup = {
  endpoint: 'authentication/profiles',
  uuidField: 'AapUUID',
  labelField: 'AapName',
};

const money = (
  key: string,
  source: string,
  label: string,
  help?: string,
): ConfigurableCrudField => ({
  key,
  source,
  label,
  type: 'currency',
  span: 1,
  ...(help ? { help } : {}),
});

const addons = ispChildCollection({
  key: 'addons',
  label: 'Add-ons',
  emptyLabel: 'No add-ons yet.',
  description: 'Optional services of the plan, billed monthly with the subscription.',
  addLabel: 'Add',
  createTitle: 'New add-on',
  editTitle: 'Edit add-on',
  savedMessage: 'Add-on saved successfully.',
  deletedMessage: 'Add-on deleted successfully.',
  endpoint: (plan) => `isp/plans/${plan}/addons`,
  itemEndpoint: (row) => `isp/plans/${row['IspPlanIpnUUID']}/addons/${row['IpdUUID']}`,
  uuidField: 'IpdUUID',
  revisionField: 'IpdRevision',
  editable: true,
  statusFilter: true,
  initialValues: { status: 1, name: '', monthlyPrice: 0, nature: 'sva', notes: '' },
  fields: [
    { key: 'revision', source: 'IpdRevision', label: 'Revision', type: 'number', hidden: true },
    { key: 'status', source: 'IpdStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'IpdName', label: 'Name', required: true, span: 1 },
    money('monthlyPrice', 'IpdMonthlyPrice', 'Monthly price'),
    {
      key: 'nature',
      source: 'IpdNature',
      label: 'Nature',
      type: 'select',
      options: ADDON_NATURES,
      required: true,
      help: 'isp.addonNatureHelp',
      span: 1,
    },
    {
      key: 'notes',
      source: 'IpdNotes',
      label: 'Notes',
      type: 'textarea',
      span: 4,
      rows: 4,
    },
  ],
  columns: [
    { id: 'name', label: 'Name', field: 'IpdName', uuidField: 'IpdUUID', kind: 'identity' },
    { id: 'price', label: 'Monthly price', field: 'IpdMonthlyPrice', kind: 'currency' },
    { id: 'nature', label: 'Nature', field: 'IpdNature', options: ADDON_NATURES },
    { id: 'status', label: 'Status', field: 'IpdStatus', kind: 'status' },
  ],
  payload: (values, editing) => ({
    ...(editing ? { revision: Number(values['revision']) } : {}),
    name: values['name'],
    monthlyPrice: Number(values['monthlyPrice'] ?? 0),
    nature: values['nature'] || 'sva',
    notes: values['notes'] || null,
    status: Number(values['status']),
  }),
});

const config = defineCrud({
  endpoint: 'isp/plans',
  uuidField: 'IpnUUID',
  serverSidePagination: true,
  serverSideSorting: true,
  initialPageSize: 50,
  deletePayload: (row) => ({ revision: Number(row['IpnRevision']) }),
  pageTitle: 'Plans',
  pageDescription:
    'Internet plans you sell: technology, speed, the network profile applied to the subscriber, prices and fidelity.',
  createTitle: 'New plan',
  editTitle: 'Edit plan',
  bulkDelete: false,
  listFilters: [
    {
      key: 'technology',
      label: 'Technology',
      paramKey: 'technology',
      type: 'select',
      span: 1,
      options: TECHNOLOGIES,
      emptyLabel: 'All',
    },
  ],
  initialValues: {
    status: 1,
    name: '',
    code: '',
    technology: 'FTTH',
    downloadKbps: '',
    uploadKbps: '',
    authenticationProfileUUID: '',
    reducedAuthenticationProfileUUID: '',
    monthlyPrice: 0,
    installationFee: 0,
    fidelityMonths: 0,
    fidelityPenalty: 0,
    notes: '',
  },
  columns: [
    { id: 'name', label: 'Name', field: 'IpnName', uuidField: 'IpnUUID', kind: 'identity' },
    { id: 'code', label: 'Code', field: 'IpnCode', optional: true },
    { id: 'technology', label: 'Technology', field: 'IpnTechnology', options: TECHNOLOGIES },
    { id: 'download', label: 'Download (kbps)', field: 'IpnDownloadKbps', kind: 'number' },
    { id: 'upload', label: 'Upload (kbps)', field: 'IpnUploadKbps', kind: 'number' },
    { id: 'profile', label: 'Profile', field: 'AuthenticationProfileName', optional: true },
    { id: 'price', label: 'Monthly price', field: 'IpnMonthlyPrice', kind: 'currency' },
    { id: 'fidelity', label: 'Fidelity (months)', field: 'IpnFidelityMonths', kind: 'number' },
    { id: 'addons', label: 'Add-ons', field: 'IpnAddonCount', kind: 'number', optional: true },
    { id: 'subscriptions', label: 'Subscriptions', field: 'IpnSubscriptionCount', kind: 'number' },
    { id: 'status', label: 'Status', field: 'IpnStatus', kind: 'status' },
  ],
  fields: [
    { key: 'revision', source: 'IpnRevision', label: 'Revision', type: 'number', hidden: true },
    { key: 'status', source: 'IpnStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'IpnName', label: 'Name', required: true, span: 1 },
    { key: 'code', source: 'IpnCode', label: 'Code', span: 1 },
    {
      key: 'technology',
      source: 'IpnTechnology',
      label: 'Technology',
      type: 'select',
      options: TECHNOLOGIES,
      required: true,
      span: 1,
    },
    {
      key: 'downloadKbps',
      source: 'IpnDownloadKbps',
      label: 'Download (kbps)',
      type: 'number',
      required: true,
      positive: true,
      help: 'isp.planSpeedHelp',
      span: 1,
    },
    {
      key: 'uploadKbps',
      source: 'IpnUploadKbps',
      label: 'Upload (kbps)',
      type: 'number',
      required: true,
      positive: true,
      span: 1,
    },
    {
      key: 'authenticationProfileUUID',
      source: 'AuthenticationProfileAapUUID',
      label: 'isp.planProfile',
      help: 'isp.planProfileHelp',
      type: 'search-select',
      required: true,
      remoteLookup: { ...profileLookup, selectedLabelField: 'AuthenticationProfileName' },
      span: 1,
    },
    {
      key: 'reducedAuthenticationProfileUUID',
      source: 'IpnReducedAuthenticationProfileAapUUID',
      label: 'isp.reducedProfile',
      help: 'isp.reducedProfileHelp',
      type: 'search-select',
      remoteLookup: {
        ...profileLookup,
        selectedLabelField: 'IpnReducedAuthenticationProfileName',
      },
      quickCreate: quickCreateFor('AuthenticationProfileAapUUID'),
      span: 1,
    },
    money('monthlyPrice', 'IpnMonthlyPrice', 'Monthly price', 'isp.planPriceHelp'),
    money('installationFee', 'IpnInstallationFee', 'Installation fee'),
    {
      key: 'fidelityMonths',
      source: 'IpnFidelityMonths',
      label: 'Fidelity (months)',
      type: 'number',
      help: 'isp.fidelityHelp',
      span: 1,
    },
    money('fidelityPenalty', 'IpnFidelityPenalty', 'Fidelity penalty', 'isp.fidelityPenaltyHelp'),
    {
      key: 'notes',
      source: 'IpnNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
  payload: (values, editing) => ({
    ...(editing ? { revision: Number(values['revision']) } : {}),
    name: values['name'],
    code: values['code'] || null,
    technology: values['technology'],
    downloadKbps: Number(values['downloadKbps']),
    uploadKbps: Number(values['uploadKbps']),
    authenticationProfileUUID: values['authenticationProfileUUID'],
    reducedAuthenticationProfileUUID: values['reducedAuthenticationProfileUUID'] || null,
    monthlyPrice: Number(values['monthlyPrice'] ?? 0),
    installationFee: Number(values['installationFee'] ?? 0),
    fidelityMonths: Number(values['fidelityMonths'] || 0),
    fidelityPenalty: Number(values['fidelityPenalty'] ?? 0),
    notes: values['notes'] || null,
    status: Number(values['status']),
  }),
  relatedCollections: [addons],
});

@Component({
  selector: 'app-isp-plans',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class IspPlansPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
