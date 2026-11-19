import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';
import type {
  ConfigurableCrudField,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { quickCreateFor } from '../../shared/crud/configurable-crud/quick-create';
import { crmPayload } from './crm-input';
import { CRM_OPTIONS } from './crm-options';

export const nextContactFields: ConfigurableCrudField[] = [
  { key: 'nextContactAt', label: 'crm.field.NextContactAt', type: 'date', required: true },
  { key: 'nextContactAtTime', label: 'Time', type: 'time', required: true },
];
export function assistedConversion(row: ConfigurableCrudRecord) {
  const workspace = String(row['CrmWorkspaceCwsUUID']);
  return defineCrud({
    endpoint: `crm/leads/${row['CleUUID']}/convert-assisted`,
    uuidField: 'opportunityUUID',
    pageTitle: 'crm.convert',
    pageDescription: 'crm.prospect.convertHelp',
    dialogDescription: 'crm.prospect.convertHelp',
    createTitle: 'crm.convert',
    formOnly: true,
    columns: [],
    defaultCurrencyFields: ['currency'],
    initialValues: {
      revision: row['CleRevision'],
      accountName: row['CleName'],
      contactName: '',
      currency: '',
    },
    fields: [
      { key: 'revision', label: 'crm.field.Revision', hidden: true },
      {
        key: 'accountUUID',
        label: 'crm.prospect.existingCompany',
        type: 'search-select',
        quickCreate: {
          ...quickCreateFor('CrmAccountCacUUID'),
          initialValues: { CrmWorkspaceCwsUUID: workspace },
        },
        remoteLookup: {
          endpoint: `crm/accounts?CrmWorkspaceCwsUUID=${encodeURIComponent(workspace)}`,
          uuidField: 'CacUUID',
          labelField: 'CacName',
        },
      },
      {
        key: 'accountName',
        label: 'crm.prospect.newCompany',
        help: 'crm.prospect.companyHelp',
        requiredWhen: ({ values }) => !values['accountUUID'],
      },
      {
        key: 'contactUUID',
        label: 'crm.prospect.existingPerson',
        type: 'search-select',
        quickCreate: {
          ...quickCreateFor('CrmContactCcoUUID'),
          initialValues: ({ values }) => ({ CrmAccountCacUUID: values['accountUUID'] }),
        },
        remoteLookup: {
          endpoint: 'crm/contacts',
          parameters: { CrmAccountCacUUID: 'accountUUID' },
          uuidField: 'CcoUUID',
          labelField: 'CcoName',
        },
      },
      { key: 'contactName', label: 'crm.prospect.newPerson', help: 'crm.prospect.personHelp' },
      {
        key: 'stageUUID',
        label: 'crm.title.stages',
        type: 'search-select',
        required: true,
        quickCreate: quickCreateFor('CrmStageCstUUID'),
        remoteLookup: {
          endpoint: `crm/stages?CstKind=open&CrmWorkspaceCwsUUID=${encodeURIComponent(workspace)}`,
          uuidField: 'CstUUID',
          labelField: 'CstName',
        },
      },
      { key: 'currency', label: 'crm.field.Currency' },
      ...nextContactFields,
      { key: 'expectedClose', label: 'crm.field.ExpectedClose', type: 'date' },
    ],
    payload: (values) =>
      Object.fromEntries(
        Object.entries(
          crmPayload(values, true, 'revision', ['revision'], ['nextContactAt']),
        ).filter(([, value]) => value !== '' && value !== null),
      ),
  });
}
export function completeFollowUp(row: ConfigurableCrudRecord, followUp: boolean) {
  return defineCrud({
    endpoint: `crm/activities/${row['uuid']}/complete-follow-up`,
    uuidField: 'activityUUID',
    pageTitle: followUp ? 'crm.prospect.completeFollowUp' : 'crm.prospect.complete',
    pageDescription: followUp ? 'crm.prospect.followUpHelp' : 'crm.prospect.dateUnchanged',
    dialogDescription: followUp ? 'crm.prospect.followUpHelp' : 'crm.prospect.dateUnchanged',
    savedMessage: followUp ? 'crm.recorded' : 'crm.prospect.dateUnchanged',
    formOnly: true,
    columns: [],
    initialValues: {
      revision: row['revision'],
      parentRevision: row['parentRevision'],
      notes: '',
      followUpName: '',
      followUpKind: 'call',
    },
    fields: [
      { key: 'revision', label: 'crm.field.Revision', hidden: true },
      ...(followUp
        ? [
            { key: 'parentRevision', label: 'crm.field.Revision', hidden: true },
            ...nextContactFields,
            { key: 'followUpName', label: 'crm.field.Name', required: true },
            {
              key: 'followUpKind',
              label: 'crm.field.Kind',
              type: 'select' as const,
              options: CRM_OPTIONS.activityKinds,
              translateOptions: true,
              required: true,
            },
          ]
        : []),
      {
        key: 'notes',
        label: 'Notes',
        tab: 'notes',
        type: 'textarea',
        span: 4,
        rows: 4,
        required: true,
      },
    ],
    payload: (values) =>
      crmPayload(
        values,
        true,
        'revision',
        followUp ? ['revision', 'parentRevision'] : ['revision'],
        followUp ? ['nextContactAt'] : [],
      ),
  });
}

/** Recomputed on every request, including Refresh across midnight and DST boundaries. */
export function localDayBounds(now = new Date()): { from: string; to: string } {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}
