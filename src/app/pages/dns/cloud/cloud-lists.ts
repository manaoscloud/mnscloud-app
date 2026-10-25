import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { DNS_BOOLEAN_OPTIONS, dnsPayload } from '../dns-input';

// Cloud DNS for companies (E1), tenant side: sites recognised by their fixed public addresses on a
// cloud cluster, each with its own policy, and the own rules of those sites. The route data picks the
// list.
const CATEGORIES = [
  { value: 'threats', label: 'dns.filterCategoryThreats' },
  { value: 'gambling', label: 'dns.filterCategoryGambling' },
  { value: 'adult', label: 'dns.filterCategoryAdult' },
  { value: 'social', label: 'dns.filterCategorySocial' },
  { value: 'fakenews', label: 'dns.filterCategoryFakenews' },
] as const;

const sites = defineCrud({
  endpoint: 'dns/cloud/sites',
  uuidField: 'DcsUUID',
  pageTitle: 'dns.cloudSites',
  pageDescription: 'dns.cloudSitesDescription',
  dialogDescription: 'dns.cloudSitesDescription',
  serverSidePagination: true,
  initialPageSize: 50,
  bulkDelete: false,
  deletePayload: (row) => ({ revision: Number(row['DcsRevision']) }),
  initialValues: {
    name: '',
    addresses: '',
    categories: ['threats'],
    safeSearch: 0,
    status: 1,
    revision: 1,
    DnsClusterDncUUID: '',
  },
  payload: (values, editing) => {
    const payload = dnsPayload(values, editing);
    if (editing) delete payload['DnsClusterDncUUID'];
    payload['addresses'] = String(values['addresses'] ?? '');
    payload['categories'] = Array.isArray(values['categories']) ? values['categories'] : [];
    payload['safeSearch'] = Number(values['safeSearch'] ?? 0);
    return payload;
  },
  fields: [
    { key: 'status', source: 'DcsStatus', label: 'Status', type: 'status', span: 1 },
    {
      key: 'DnsClusterDncUUID',
      source: 'DnsClusterDncUUID',
      label: 'dns.cloudCluster',
      span: 1,
      required: true,
      type: 'search-select',
      remoteLookup: {
        endpoint: 'dns/cloud/clusters',
        uuidField: 'DncUUID',
        labelField: 'DncName',
        descriptionField: 'Addresses',
        selectedLabelField: 'ClusterName',
      },
      quickCreate: false,
      quickCreateExemptReason: 'Cloud clusters are offered by the platform.',
      disabledWhen: ({ editing }) => editing,
      help: 'dns.cloudClusterHelp',
    },
    { key: 'name', source: 'DcsName', label: 'Name', required: true, span: 2 },
    {
      key: 'addresses',
      source: 'DcsAddresses',
      label: 'dns.cloudSiteAddresses',
      required: true,
      span: 2,
      help: 'dns.cloudSiteAddressesHelp',
    },
    {
      key: 'categories',
      source: 'DcsCategoriesJson',
      label: 'dns.filterCategories',
      type: 'multi-select',
      span: 2,
      translateOptions: true,
      options: CATEGORIES,
      help: 'dns.filterCategoriesHelp',
    },
    {
      key: 'safeSearch',
      source: 'DcsSafeSearch',
      label: 'dns.filterSafeSearch',
      type: 'select',
      required: true,
      span: 2,
      translateOptions: true,
      options: DNS_BOOLEAN_OPTIONS,
      help: 'dns.filterSafeSearchHelp',
    },
    { key: 'revision', source: 'DcsRevision', label: 'Revision', type: 'number', hidden: true },
  ],
  columns: [
    { id: 'name', field: 'DcsName', label: 'Name', kind: 'identity' },
    { id: 'addresses', field: 'DcsAddresses', label: 'dns.cloudSiteAddresses', kind: 'text' },
    { id: 'cluster', field: 'ClusterName', label: 'dns.cloudCluster', kind: 'text' },
    { id: 'rules', field: 'Rules', label: 'dns.cloudSiteRules', kind: 'number' },
    { id: 'status', field: 'DcsStatus', label: 'Status', kind: 'status' },
  ],
});

const RULE_ACTIONS = [
  { value: 'block', label: 'dns.filterActionBlock' },
  { value: 'allow', label: 'dns.filterActionAllow' },
] as const;

const siteRules = defineCrud({
  endpoint: 'dns/cloud/site-rules',
  uuidField: 'DsrUUID',
  pageTitle: 'dns.cloudSiteRules',
  pageDescription: 'dns.cloudSiteRulesDescription',
  dialogDescription: 'dns.cloudSiteRulesDescription',
  serverSidePagination: true,
  initialPageSize: 50,
  bulkDelete: false,
  deletePayload: (row) => ({ revision: Number(row['DsrRevision']) }),
  initialValues: {
    domain: '',
    action: 'block',
    note: '',
    status: 1,
    revision: 1,
    DnsCloudSiteDcsUUID: '',
  },
  payload: (values, editing) => {
    const payload = dnsPayload(values, editing);
    if (editing) delete payload['DnsCloudSiteDcsUUID'];
    payload['note'] = String(values['note'] ?? '').trim() || null;
    return payload;
  },
  fields: [
    { key: 'status', source: 'DsrStatus', label: 'Status', type: 'status', span: 1 },
    {
      key: 'DnsCloudSiteDcsUUID',
      source: 'DnsCloudSiteDcsUUID',
      label: 'dns.cloudSite',
      span: 1,
      required: true,
      type: 'search-select',
      remoteLookup: {
        endpoint: 'dns/cloud/sites',
        uuidField: 'DcsUUID',
        labelField: 'DcsName',
        selectedLabelField: 'SiteName',
      },
      quickCreate: false,
      quickCreateExemptReason: 'Sites have their own page.',
      disabledWhen: ({ editing }) => editing,
    },
    {
      key: 'domain',
      source: 'DsrDomain',
      label: 'dns.filterDomain',
      required: true,
      span: 1,
      help: 'dns.filterDomainHelp',
    },
    {
      key: 'action',
      source: 'DsrAction',
      label: 'dns.filterAction',
      type: 'select',
      required: true,
      span: 1,
      translateOptions: true,
      options: RULE_ACTIONS,
    },
    { key: 'note', source: 'DsrNote', label: 'dns.filterNote', span: 2 },
    { key: 'revision', source: 'DsrRevision', label: 'Revision', type: 'number', hidden: true },
  ],
  columns: [
    { id: 'domain', field: 'DsrDomain', label: 'dns.filterDomain', kind: 'identity' },
    {
      id: 'action',
      field: 'DsrAction',
      label: 'dns.filterAction',
      kind: 'text',
      value: (row) =>
        row['DsrAction'] === 'allow' ? 'dns.filterActionAllow' : 'dns.filterActionBlock',
      translateValue: true,
    },
    { id: 'site', field: 'SiteName', label: 'dns.cloudSite', kind: 'text' },
    { id: 'status', field: 'DsrStatus', label: 'Status', kind: 'status' },
  ],
});

const CONFIGS = { sites, 'site-rules': siteRules };

@Component({
  selector: 'app-dns-cloud-lists',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class DnsCloudListsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    const list = inject(ActivatedRoute).snapshot.data['list'] as keyof typeof CONFIGS;
    super(CONFIGS[list] ?? sites);
  }
}
