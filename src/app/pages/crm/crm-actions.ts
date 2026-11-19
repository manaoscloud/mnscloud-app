import { assistedConversion } from './prospecting-forms';
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
    workspaces: 'CwsUUID',
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
          pageDescription: 'crm.description.history',
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
  if (['leads', 'opportunities'].includes(route))
    actions.push({
      key: 'relationship',
      label: 'crm.prospect.relationship',
      icon: 'person',
      navigate: (r) => ['/crm/relationships', route, String(r[identity[route]])],
    });
  if (route === 'leads')
    actions.push({
      key: 'convert',
      label: 'crm.convert',
      icon: 'swap_horiz',
      visible: (r) => r['CleState'] === 'qualified',
      form: assistedConversion,
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
      tooltip: 'crm.prospect.sentHelp',
      icon: 'send',
      visible: (r) => ['draft', 'sent'].includes(String(r['CppState'])),
      form: (r) =>
        defineCrud({
          endpoint: `crm/proposals/${r['CppUUID']}/transition`,
          uuidField: 'CppUUID',
          pageTitle: 'crm.transition',
          pageDescription: 'crm.description.transition',
          dialogDescription: 'crm.prospect.sentHelp',
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
  if (route === 'workspaces') {
    const publicationConfig = (r: ConfigurableCrudRecord) =>
      defineCrud({
        endpoint: `crm/workspaces/${r['CwsUUID']}/portal`,
        uuidField: 'CwsUUID',
        pageTitle: 'crm.publication',
        pageDescription: 'crm.publicationDescription',
        initialValues: { enabled: r['CwsPortalEnabled'], revision: r['CwsRevision'] },
        fields: [
          {
            key: 'enabled',
            label: 'crm.portalEnabled',
            type: 'select',
            options: [
              { value: 1, label: 'Yes' },
              { value: 0, label: 'No' },
            ],
          },
          { key: 'revision', label: 'crm.field.Revision', hidden: true },
        ],
        columns: [],
      });
    const assignConfig = (r: ConfigurableCrudRecord) =>
      defineCrud({
        endpoint: `crm/workspaces/${r['CwsUUID']}/members`,
        uuidField: 'CwsUUID',
        pageTitle: 'crm.assignOperator',
        pageDescription: 'crm.operatorsDescription',
        initialValues: { UserUsrUUID: '', status: 1 },
        fields: [
          {
            key: 'UserUsrUUID',
            source: 'UserUsrUUID',
            label: 'User',
            type: 'search-select',
            required: true,
            remoteLookup: {
              endpoint: 'user/access/members',
              uuidField: 'UserUUID',
              labelField: 'Name',
            },
            quickCreate: false,
            quickCreateExemptReason:
              'Tenant operators must be invited through tenant access management.',
          },
          { key: 'status', label: 'Status', type: 'status', span: 1 },
        ],
        columns: [],
      });
    const operatorsConfig = (r: ConfigurableCrudRecord) =>
      defineCrud({
        endpoint: `crm/workspaces/${r['CwsUUID']}/members`,
        uuidField: 'CwmUUID',
        pageTitle: 'crm.operators',
        pageDescription: 'crm.operatorsDescription',
        readOnly: true,
        fields: [],
        columns: [
          { id: 'user', field: 'UsrName', label: 'User', kind: 'identity' },
          { id: 'email', field: 'UsrEmail', label: 'Email' },
          { id: 'status', field: 'CwmStatus', label: 'crm.field.Status', kind: 'status' },
        ],
      });

    actions.push(
      {
        key: 'publication',
        label: 'crm.publication',
        icon: 'public',
        visible: (row) => Boolean(row['RegCustomerRcuUUID']),
        form: publicationConfig,
      },
      {
        key: 'assign',
        label: 'crm.assignOperator',
        icon: 'person_add',
        form: assignConfig,
      },
      {
        key: 'operators',
        label: 'crm.operators',
        icon: 'group',
        collection: operatorsConfig,
      },
    );
  }
  return actions;
}
