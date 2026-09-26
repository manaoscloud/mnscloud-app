import { Component, inject, resource } from '@angular/core';
import { ApiService } from '../../../services/api.service';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

const modes = [
  { value: 'monitor', label: 'Monitor' },
  { value: 'enforce', label: 'Enforce' },
];
const levels = [
  { value: 'basic', label: 'Basic' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'strict', label: 'Strict' },
  { value: 'custom', label: 'Custom' },
];

type ServiceRef = { uuid: string; slug: string; name: string };

const config = defineCrud({
  endpoint: 'cyber-security/profiles',
  uuidField: 'uuid',
  pageTitle: 'Security Profiles',
  pageDescription: 'Reusable protection policies for Linux services and security agents.',
  dialogDescription: 'Define protection behavior, related services and agent policy rules.',
  bulkDelete: true,
  serverSidePagination: true,
  tabLabels: { network: 'Rules' },
  initialValues: {
    enabled: 1,
    name: '',
    mode: 'monitor',
    level: 'balanced',
    defaultDecisionDuration: '4h',
    serviceUUIDs: [],
    description: '',
    trustedNetworks: '[]',
    rules: '{}',
  },
  columns: [
    { id: 'name', label: 'Name', field: 'name', uuidField: 'uuid', kind: 'identity' },
    { id: 'mode', label: 'Mode', field: 'mode', options: modes },
    { id: 'level', label: 'Level', field: 'level', options: levels },
    {
      id: 'duration',
      label: 'Decision duration',
      field: 'defaultDecisionDuration',
      translateValue: false,
    },
    { id: 'services', label: 'Services', field: 'serviceSlugs', translateValue: false },
    { id: 'status', label: 'Status', field: 'enabled', kind: 'status' },
  ],
  fields: [
    { key: 'enabled', source: 'enabled', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'name', label: 'Name', required: true, span: 1 },
    {
      key: 'mode',
      source: 'mode',
      label: 'Mode',
      type: 'select',
      options: modes,
      required: true,
      span: 1,
    },
    {
      key: 'level',
      source: 'level',
      label: 'Level',
      type: 'select',
      options: levels,
      required: true,
      span: 1,
    },
    {
      key: 'defaultDecisionDuration',
      source: 'defaultDecisionDuration',
      label: 'Decision duration',
      required: true,
      span: 1,
    },
    {
      key: 'serviceUUIDs',
      label: 'Services',
      type: 'multi-select',
      quickCreate: false,
      quickCreateExemptReason:
        'Protected services are catalog entries maintained on their own page.',
      span: 3,
    },
    {
      key: 'description',
      source: 'description',
      label: 'Description',
      type: 'textarea',
      rows: 3,
      span: 4,
    },
    {
      key: 'trustedNetworks',
      source: 'trustedNetworks',
      label: 'Trusted networks',
      type: 'textarea',
      format: 'json',
      rows: 4,
      required: true,
      tab: 'network',
      span: 4,
    },
    {
      key: 'rules',
      source: 'rules',
      label: 'Rules',
      type: 'textarea',
      format: 'json',
      rows: 8,
      required: true,
      tab: 'network',
      span: 4,
    },
  ],
});

@Component({
  selector: 'app-cyber-security-profiles',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class CyberSecurityProfilesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly lookupApi = inject(ApiService);

  // Profiles store service slugs; the form edits service UUIDs from the protected services catalog.
  private readonly services = resource({
    defaultValue: [] as ServiceRef[],
    loader: async (): Promise<ServiceRef[]> => {
      const response = await this.lookupApi.get<{ data?: { items?: ServiceRef[] } }>(
        'cyber-security/services?limit=500&offset=0',
      );
      return response?.data?.items ?? [];
    },
  });

  constructor() {
    super(config);
  }

  override fieldLoading(field: { key: string }): boolean {
    return field.key === 'serviceUUIDs' ? this.services.isLoading() : false;
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key !== 'serviceUUIDs') return [];
    return this.services.value().map((service) => ({
      value: service.uuid,
      label: service.name || service.slug,
    }));
  }

  protected override formValuesFromRecord(row: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const slugs = String(row['serviceSlugs'] ?? '')
      .split(',')
      .map((slug) => slug.trim())
      .filter(Boolean);
    const serviceUUIDs = this.services
      .value()
      .filter((service) => slugs.includes(service.slug))
      .map((service) => service.uuid);
    return { ...super.formValuesFromRecord(row), serviceUUIDs };
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      enabled: Number(payload['enabled']),
      serviceUUIDs: Array.isArray(payload['serviceUUIDs']) ? payload['serviceUUIDs'] : [],
    };
  }
}
