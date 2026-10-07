import { CRM_OPTIONS } from './crm-options';
import { crmPayload } from './crm-input';
import { config as proposalItemsConfig } from './proposal-items/proposal-items';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';
import {
  ConfigurableCrudRowAction,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { quickCreateFor } from '../../shared/crud/configurable-crud/quick-create';
export function crmActions(route: string): ConfigurableCrudRowAction[] {
  const identity: Record<string, string> = {
    industries: 'CinUUID',
    sources: 'CsoUUID',
    'loss-reasons': 'ClrUUID',
    pipelines: 'CpiUUID',
    stages: 'CstUUID',
    accounts: 'CacUUID',
    contacts: 'CcoUUID',
    products: 'CprUUID',
    leads: 'CleUUID',
    opportunities: 'CopUUID',
    activities: 'CatUUID',
    proposals: 'CppUUID',
    'proposal-items': 'CptUUID',
    handoffs: 'ChoUUID',
  };
  const actions: ConfigurableCrudRowAction[] = [
    {
      key: 'history',
      label: 'crm.history',
      icon: 'history',
      collection: (row) =>
        defineCrud({
          endpoint: `crm/${route}/${row[identity[route]]}/history`,
          uuidField: 'ChiUUID',
          pageTitle: 'crm.history',
          canCreate: false,
          canEdit: false,
          canDelete: false,
          statusFilter: false,
          fields: [],
          columns: [
            { id: 'date', field: 'ChiDateCreated', label: 'Date', kind: 'datetime' },
            { id: 'actor', field: 'ActorName', label: 'crm.field.AssignedUserUsrUUID' },
            {
              id: 'action',
              field: 'ChiAction',
              label: 'Action',
              options: [
                { value: 'create', label: 'New' },
                { value: 'update', label: 'Edit' },
                { value: 'delete', label: 'Delete' },
                { value: 'convert', label: 'crm.convert' },
                { value: 'transition', label: 'crm.transition' },
                { value: 'revise', label: 'crm.revise' },
                { value: 'document', label: 'crm.document' },
              ],
            },
          ],
        }),
    },
  ];
  if (route === 'leads')
    actions.push({
      key: 'convert',
      label: 'crm.convert',
      icon: 'conversion_path',
      visible: (r) => r['CleState'] === 'qualified',
      form: (r) =>
        defineCrud({
          endpoint: `crm/leads/${r['CleUUID']}/convert`,
          uuidField: 'CopUUID',
          pageTitle: 'crm.convert',
          createTitle: 'crm.convert',
          formOnly: true,
          columns: [],
          defaultCurrencyFields: ['currency'],
          payload: (values) => crmPayload(values, true, 'revision', [], []),
          initialValues: {
            revision: r['CleRevision'],
            accountUUID: '',
            stageUUID: '',
            currency: '',
          },
          fields: [
            { key: 'revision', label: 'crm.field.Revision', hidden: true },
            {
              key: 'accountUUID',
              label: 'crm.title.accounts',
              type: 'search-select',
              span: 1,
              quickCreate: quickCreateFor('CrmAccountCacUUID'),
              remoteLookup: {
                endpoint: 'crm/accounts',
                uuidField: 'CacUUID',
                labelField: 'CacName',
              },
            },
            {
              key: 'stageUUID',
              label: 'crm.title.stages',
              type: 'search-select',
              span: 1,
              required: true,
              quickCreate: quickCreateFor('CrmStageCstUUID'),
              remoteLookup: {
                endpoint: 'crm/stages?CstKind=open',
                uuidField: 'CstUUID',
                labelField: 'CstName',
              },
            },
            { key: 'currency', label: 'crm.field.Currency', span: 1 },
          ],
        }),
    });
  if (route === 'proposals') {
    actions.push({
      key: 'document',
      label: 'crm.document',
      icon: 'download',
      visible: (row) => row['CppState'] !== 'draft',
    });
    actions.push({
      key: 'items',
      label: 'crm.title.proposal-items',
      icon: 'list',
      collection: (row) => ({
        ...proposalItemsConfig,
        fields: proposalItemsConfig.fields.map((field) =>
          field.key === 'CptUnitAmount'
            ? { ...field, currencyCode: String(row['CppCurrency']) }
            : field,
        ),
        listQuery: { CrmProposalCppUUID: String(row['CppUUID']) },
        initialValues: { ...proposalItemsConfig.initialValues, CrmProposalCppUUID: row['CppUUID'] },
        canCreate: row['CppState'] === 'draft',
        canEdit: row['CppState'] === 'draft',
        canDelete: row['CppState'] === 'draft',
      }),
    });
    actions.push({
      key: 'transition',
      label: 'crm.transition',
      icon: 'send',
      visible: (r) => ['draft', 'sent'].includes(String(r['CppState'])),
      form: (r) =>
        defineCrud({
          endpoint: `crm/proposals/${r['CppUUID']}/transition`,
          uuidField: 'CppUUID',
          pageTitle: 'crm.transition',
          createTitle: 'crm.transition',
          formOnly: true,
          columns: [],
          initialValues: {
            revision: r['CppRevision'],
            state: r['CppState'] === 'draft' ? 'sent' : 'accepted',
            evidence: '',
          },
          fields: [
            { key: 'revision', label: 'crm.field.Revision', hidden: true },
            {
              key: 'state',
              label: 'crm.field.State',
              type: 'select',
              span: 1,
              required: true,
              options: CRM_OPTIONS.proposalStates.filter(({ value }) =>
                (r['CppState'] === 'draft'
                  ? ['sent']
                  : ['accepted', 'rejected', 'expired']
                ).includes(value),
              ),
            },
            {
              key: 'evidence',
              label: 'crm.field.Evidence',
              type: 'textarea',
              span: 4,
              rows: 4,
              breakBefore: true,
            },
          ],
        }),
    });
    actions.push({
      key: 'revise',
      label: 'crm.revise',
      icon: 'content_copy',
      visible: (r) => r['CppState'] !== 'accepted',
      request: {
        method: 'post',
        endpoint: (r) => `crm/proposals/${r['CppUUID']}/revise`,
        successMessage: 'crm.recorded',
      },
    });
  }
  return actions;
}
