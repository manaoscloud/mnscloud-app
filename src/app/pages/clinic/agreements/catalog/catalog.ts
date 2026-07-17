import { Component, computed, inject, resource } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';

const YES_NO: readonly ConfigurableCrudOption[] = [{ value: 1, label: 'Yes' }, { value: 0, label: 'No' }];
const RELATIONSHIPS: readonly ConfigurableCrudOption[] = [{ value: 'holder', label: 'Holder' }, { value: 'dependent', label: 'Dependent' }];

function config(endpoint: string, uuidField: string, noun: string, fields: ConfigurableCrudConfig['fields'], columns: ConfigurableCrudConfig['columns']): ConfigurableCrudConfig {
  return {
    endpoint, uuidField, pageTitle: noun, pageDescription: `Manage clinic ${noun.toLowerCase()}.`, createTitle: `New ${noun.slice(0, -1)}`, editTitle: `Edit ${noun.slice(0, -1)}`,
    dialogDescription: `Maintain clinic ${noun.toLowerCase()} data.`, searchPlaceholder: 'Search', emptyLabel: `No ${noun.toLowerCase()} found.`, deleteTitle: `Delete ${noun.slice(0, -1)}`,
    deleteMessage: `Delete this ${noun.slice(0, -1).toLowerCase()}?`, deleteSelectedTitle: `Delete selected ${noun.toLowerCase()}`, deleteSelectedMessage: 'Delete {count} selected records?',
    savedMessage: 'Record saved successfully.', deletedMessage: 'Record deleted successfully.', deleteFailedMessage: 'Failed to delete record.', statusMode: 'number', activeValue: 1, inactiveValue: 0,
    initialValues: { status: 1, allowed: 1, authorizationRequired: 0, relationship: 'holder', code: '', name: '', registration: '', tussCode: '', agreementUUID: '', planUUID: '', procedureUUID: '', customerUUID: '', insuredNumber: '', memberNumber: '', validFrom: '', validUntil: '', quantityLimit: '', periodDays: '', notes: '' }, fields, columns,
  };
}

const CONFIGS: Record<string, ConfigurableCrudConfig> = {
  agreements: config('clinic/agreements', 'AgreementUUID', 'Clinic agreements', [
    { key: 'status', source: 'Status', payloadKey: 'status', label: 'Status', type: 'status', span: 1 },
    { key: 'code', source: 'Code', payloadKey: 'code', label: 'Code', required: true, span: 1 },
    { key: 'name', source: 'Name', payloadKey: 'name', label: 'Name', required: true, span: 2 },
    { key: 'registration', source: 'Registration', payloadKey: 'registration', label: 'Registration', span: 1 },
    { key: 'notes', source: 'Notes', payloadKey: 'notes', label: 'Notes', type: 'textarea', tab: 'notes', span: 4, rows: 4 },
  ], [{ id: 'name', label: 'Name', kind: 'identity', field: 'Name', uuidField: 'AgreementUUID' }, { id: 'code', label: 'Code', field: 'Code' }, { id: 'registration', label: 'Registration', field: 'Registration' }, { id: 'status', label: 'Status', kind: 'status', field: 'Status' }]),
  plans: config('clinic/plans', 'PlanUUID', 'Agreement plans', [
    { key: 'status', source: 'Status', payloadKey: 'status', label: 'Status', type: 'status', span: 1 },
    { key: 'agreementUUID', source: 'AgreementUUID', payloadKey: 'agreementUUID', label: 'Agreement', type: 'search-select', required: true, span: 1 },
    { key: 'code', source: 'Code', payloadKey: 'code', label: 'Code', required: true, span: 1 }, { key: 'name', source: 'Name', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    { key: 'validFrom', source: 'ValidFrom', payloadKey: 'validFrom', label: 'Valid from', type: 'date', span: 1 }, { key: 'validUntil', source: 'ValidUntil', payloadKey: 'validUntil', label: 'Valid until', type: 'date', span: 1 },
    { key: 'notes', source: 'Notes', payloadKey: 'notes', label: 'Notes', type: 'textarea', tab: 'notes', span: 4, rows: 4 },
  ], [{ id: 'name', label: 'Name', kind: 'identity', field: 'Name', uuidField: 'PlanUUID' }, { id: 'agreement', label: 'Agreement', field: 'AgreementName' }, { id: 'code', label: 'Code', field: 'Code' }, { id: 'status', label: 'Status', kind: 'status', field: 'Status' }]),
  procedures: config('clinic/procedures', 'ProcedureUUID', 'Clinic procedures', [
    { key: 'status', source: 'Status', payloadKey: 'status', label: 'Status', type: 'status', span: 1 }, { key: 'code', source: 'Code', payloadKey: 'code', label: 'Code', required: true, span: 1 }, { key: 'tussCode', source: 'TussCode', payloadKey: 'tussCode', label: 'TUSS code', span: 1 }, { key: 'name', source: 'Name', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    { key: 'notes', source: 'Notes', payloadKey: 'notes', label: 'Notes', type: 'textarea', tab: 'notes', span: 4, rows: 4 },
  ], [{ id: 'name', label: 'Name', kind: 'identity', field: 'Name', uuidField: 'ProcedureUUID' }, { id: 'code', label: 'Code', field: 'Code' }, { id: 'tuss', label: 'TUSS code', field: 'TussCode' }, { id: 'status', label: 'Status', kind: 'status', field: 'Status' }]),
  coverages: config('clinic/coverages', 'CoverageUUID', 'Plan coverages', [
    { key: 'status', source: 'Status', payloadKey: 'status', label: 'Status', type: 'status', span: 1 }, { key: 'planUUID', source: 'PlanUUID', payloadKey: 'planUUID', label: 'Plan', type: 'search-select', required: true, span: 1 }, { key: 'procedureUUID', source: 'ProcedureUUID', payloadKey: 'procedureUUID', label: 'Procedure', type: 'search-select', required: true, span: 1 }, { key: 'allowed', source: 'Allowed', payloadKey: 'allowed', label: 'Allowed', type: 'select', options: YES_NO, span: 1 },
    { key: 'authorizationRequired', source: 'AuthorizationRequired', payloadKey: 'authorizationRequired', label: 'Authorization required', type: 'select', options: YES_NO, span: 1 }, { key: 'quantityLimit', source: 'QuantityLimit', payloadKey: 'quantityLimit', label: 'Quantity limit', type: 'number', span: 1 }, { key: 'periodDays', source: 'PeriodDays', payloadKey: 'periodDays', label: 'Period days', type: 'number', span: 1 }, { key: 'validFrom', source: 'ValidFrom', payloadKey: 'validFrom', label: 'Valid from', type: 'date', span: 1 }, { key: 'validUntil', source: 'ValidUntil', payloadKey: 'validUntil', label: 'Valid until', type: 'date', span: 1 },
    { key: 'notes', source: 'Notes', payloadKey: 'notes', label: 'Notes', type: 'textarea', tab: 'notes', span: 4, rows: 4 },
  ], [{ id: 'plan', label: 'Plan', field: 'PlanName' }, { id: 'procedure', label: 'Procedure', field: 'ProcedureName' }, { id: 'allowed', label: 'Allowed', kind: 'boolean', field: 'Allowed' }, { id: 'authorization', label: 'Authorization required', kind: 'boolean', field: 'AuthorizationRequired' }, { id: 'status', label: 'Status', kind: 'status', field: 'Status' }]),
  'customer-agreements': config('clinic/customer-agreements', 'CustomerAgreementUUID', 'Customer agreements', [
    { key: 'status', source: 'Status', payloadKey: 'status', label: 'Status', type: 'status', span: 1 }, { key: 'customerUUID', source: 'CustomerUUID', payloadKey: 'customerUUID', label: 'Customer', type: 'search-select', required: true, span: 1 }, { key: 'agreementUUID', source: 'AgreementUUID', payloadKey: 'agreementUUID', label: 'Agreement', type: 'search-select', required: true, span: 1 }, { key: 'planUUID', source: 'PlanUUID', payloadKey: 'planUUID', label: 'Plan', type: 'search-select', span: 1 },
    { key: 'insuredNumber', source: 'InsuredNumber', payloadKey: 'insuredNumber', label: 'Insured number', required: true, span: 1 }, { key: 'memberNumber', source: 'MemberNumber', payloadKey: 'memberNumber', label: 'Member number', span: 1 }, { key: 'relationship', source: 'Relationship', payloadKey: 'relationship', label: 'Relationship', type: 'select', options: RELATIONSHIPS, span: 1 }, { key: 'validFrom', source: 'ValidFrom', payloadKey: 'validFrom', label: 'Valid from', type: 'date', span: 1 }, { key: 'validUntil', source: 'ValidUntil', payloadKey: 'validUntil', label: 'Valid until', type: 'date', span: 1 },
    { key: 'notes', source: 'Notes', payloadKey: 'notes', label: 'Notes', type: 'textarea', tab: 'notes', span: 4, rows: 4 },
  ], [{ id: 'customer', label: 'Customer', field: 'CustomerName' }, { id: 'agreement', label: 'Agreement', field: 'AgreementName' }, { id: 'plan', label: 'Plan', field: 'PlanName' }, { id: 'insured', label: 'Insured number', field: 'InsuredNumber' }, { id: 'status', label: 'Status', kind: 'status', field: 'Status' }]),
};

@Component({ selector: 'app-clinic-agreement-catalog', standalone: true, imports: CONFIGURABLE_CRUD_IMPORTS, templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html', styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'] })
export class ClinicAgreementCatalogPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly agreements = resource({ loader: () => this.api.get<any>('clinic/agreements?limit=500').then((r) => r?.data?.items ?? []) });
  private readonly plans = resource({ loader: () => this.api.get<any>('clinic/plans?limit=500').then((r) => r?.data?.items ?? []) });
  private readonly procedures = resource({ loader: () => this.api.get<any>('clinic/procedures?limit=500').then((r) => r?.data?.items ?? []) });
  private readonly customers = resource({ loader: () => this.api.get<any>('erp/customers?limit=500').then((r) => r?.data?.items ?? []) });
  private readonly agreementOptions = computed<ConfigurableCrudOption[]>(() => this.agreements.value().map((item: any) => ({ value: item.AgreementUUID, label: item.Name, searchText: `${item.Name} ${item.Code}` })));
  private readonly planOptions = computed<ConfigurableCrudOption[]>(() => this.plans.value().map((item: any) => ({ value: item.PlanUUID, label: `${item.AgreementName ?? ''} - ${item.Name}`, searchText: `${item.AgreementName ?? ''} ${item.Name} ${item.Code}` })));
  private readonly procedureOptions = computed<ConfigurableCrudOption[]>(() => this.procedures.value().map((item: any) => ({ value: item.ProcedureUUID, label: item.Name, searchText: `${item.Name} ${item.Code} ${item.TussCode ?? ''}` })));
  private readonly customerOptions = computed<ConfigurableCrudOption[]>(() => this.customers.value().map((item: any) => ({ value: item.CustomerUUID, label: item.Name, searchText: `${item.Name} ${item.Document ?? ''}` })));

  constructor() { super(CONFIGS[inject(ActivatedRoute).snapshot.data['catalog']] ?? CONFIGS['agreements']); }
  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] { if (key === 'agreementUUID') return this.agreementOptions(); if (key === 'planUUID') return this.planOptions(); if (key === 'procedureUUID') return this.procedureOptions(); if (key === 'customerUUID') return this.customerOptions(); return []; }
}
