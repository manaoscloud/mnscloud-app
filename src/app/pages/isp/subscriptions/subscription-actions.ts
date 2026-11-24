import {
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

/** Local calendar date (the API compares it with the platform local day, never UTC). */
const today = () => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};
const uuidOf = (row: ConfigurableCrudRecord) => String(row['IsbUUID']);
const revisionOf = (row: ConfigurableCrudRecord) => Number(row['IsbRevision']);
const statusOf = (row: ConfigurableCrudRecord) => String(row['IsbStatus'] ?? '');

type ActionForm = {
  action: string;
  title: string;
  description: string;
  savedMessage: string;
  initialValues: ConfigurableCrudRecord;
  fields: readonly ConfigurableCrudField[];
  payload: (values: ConfigurableCrudRecord) => ConfigurableCrudRecord;
  /** The API takes no revision (trust unlock). */
  withRevision?: boolean;
};

/** One-shot dialog posting to `isp/subscriptions/:uuid/<action>` with the revision of the row. */
function actionForm(row: ConfigurableCrudRecord, spec: ActionForm): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: `isp/subscriptions/${uuidOf(row)}/${spec.action}`,
    uuidField: 'IsbUUID',
    pageTitle: spec.title,
    pageDescription: spec.description,
    createTitle: spec.title,
    dialogDescription: spec.description,
    savedMessage: spec.savedMessage,
    statusFilter: false,
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    columns: [],
    initialValues: spec.initialValues,
    fields: spec.fields,
    payload: (values) => ({
      ...spec.payload(values),
      ...(spec.withRevision === false ? {} : { revision: revisionOf(row) }),
    }),
  });
}

/** Confirmed one-click action without input (suspend, resume). */
function confirmedAction(
  key: string,
  icon: string,
  statuses: readonly string[],
  messages: { label: string; saved: string; confirm: string },
): ConfigurableCrudRowAction {
  return {
    key,
    label: messages.label,
    icon,
    visible: (row) => statuses.includes(statusOf(row)),
    request: {
      method: 'post',
      endpoint: (row) => `isp/subscriptions/${uuidOf(row)}/${key}`,
      body: (row) => ({ revision: revisionOf(row) }),
      successMessage: messages.saved,
      confirm: { title: messages.label, message: messages.confirm, confirmLabel: messages.label },
    },
  };
}

const planLookup = {
  endpoint: 'isp/plans?status=1',
  uuidField: 'IpnUUID',
  labelField: 'IpnName',
};

/**
 * Lifecycle actions of an ISP subscription (activate, change plan, suspend, resume, trust unlock,
 * cancel); each one confirms through its dialog or confirmation.
 */
export function subscriptionRowActions(canTrustUnlock: () => boolean): ConfigurableCrudRowAction[] {
  return [
    {
      key: 'activate',
      label: 'Activate',
      icon: 'play_arrow',
      visible: (row) => statusOf(row) === 'pending',
      form: (row) =>
        actionForm(row, {
          action: 'activate',
          title: 'Activate subscription',
          description: 'isp.activateDescription',
          savedMessage: 'Subscription activated.',
          initialValues: {
            contractUUID: row['BillContractBctUUID'] ?? '',
            activationDate: today(),
          },
          fields: [
            {
              key: 'contractUUID',
              label: 'Billing contract',
              type: 'search-select',
              help: 'isp.activateContractHelp',
              remoteLookup: {
                endpoint: `customer-billing/contracts?customerUUID=${row['RegCustomerRcuUUID']}`,
                uuidField: 'BctUUID',
                labelField: 'BctID',
                descriptionField: 'CompanyName',
                selectedLabelField: 'BctID',
              },
              quickCreate: false,
              quickCreateExemptReason:
                'Contracts are created in Customer Billing with their company, cycle and due-day rule.',
            },
            { key: 'activationDate', label: 'Activation date', type: 'date', span: 1 },
          ],
          payload: (values) => ({
            contractUUID: values['contractUUID'] || null,
            activationDate: values['activationDate'] || null,
          }),
        }),
    },
    {
      key: 'plan-change',
      label: 'Change plan',
      icon: 'swap_horiz',
      visible: (row) => statusOf(row) !== 'cancelled',
      form: (row) =>
        actionForm(row, {
          action: 'plan-change',
          title: 'Change plan',
          description: 'isp.planChangeDescription',
          savedMessage: 'Plan change recorded.',
          initialValues: { planUUID: row['IspPlanIpnUUID'] ?? '' },
          fields: [
            {
              key: 'planUUID',
              label: 'Plan',
              type: 'search-select',
              required: true,
              help: 'isp.planChangeHelp',
              remoteLookup: planLookup,
              quickCreate: false,
              quickCreateExemptReason: 'Plans are managed in ISP › Plans.',
            },
          ],
          payload: (values) => ({ planUUID: values['planUUID'] }),
        }),
    },
    confirmedAction('suspend', 'pause', ['active'], {
      label: 'Suspend',
      saved: 'Subscription suspended.',
      confirm:
        'Suspend this subscription at the customer request? The access is disabled until it is resumed.',
    }),
    confirmedAction('resume', 'play_circle', ['suspended'], {
      label: 'Resume',
      saved: 'Subscription resumed.',
      confirm: 'Resume this subscription? The access returns to service.',
    }),
    {
      key: 'trust-unlock',
      label: 'Trust unlock',
      icon: 'lock_open',
      visible: (row) =>
        canTrustUnlock() && statusOf(row) === 'active' && row['EffectiveState'] === 'blocked',
      form: (row) =>
        actionForm(row, {
          action: 'trust-unlock',
          title: 'Trust unlock',
          description: 'isp.trustUnlockDescription',
          savedMessage: 'Trust unlock granted.',
          withRevision: false,
          initialValues: { reason: '' },
          fields: [{ key: 'reason', label: 'Reason', type: 'textarea', span: 4, rows: 4 }],
          payload: (values) => ({ reason: values['reason'] || null }),
        }),
    },
    {
      key: 'billing-resync',
      label: 'Resync billing',
      icon: 'sync',
      visible: (row) =>
        ['active', 'suspended'].includes(statusOf(row)) && Boolean(row['BillContractBctUUID']),
      request: {
        method: 'post',
        endpoint: (row) => `isp/subscriptions/${uuidOf(row)}/billing-resync`,
        body: (row) => ({ revision: revisionOf(row) }),
        successMessage: 'Billing resynchronized.',
        confirm: {
          title: 'Resync billing',
          message: 'isp.billingResyncConfirm',
          confirmLabel: 'Resync billing',
        },
      },
    },
    {
      key: 'kick-session',
      label: 'Desconectar sessão',
      icon: 'power_settings_new',
      visible: (row) =>
        ['active', 'suspended'].includes(statusOf(row)) && Boolean(row['AuthenticationAccessAaxUUID']),
      request: {
        method: 'post',
        endpoint: (row) => `isp/subscriptions/${uuidOf(row)}/kick-session`,
        body: () => ({}),
        successMessage: 'Comando de desconexão (PoD/CoA) enviado ao NAS.',
        confirm: {
          title: 'Desconectar sessão',
          message: 'Enviar pacote RFC 5176 Disconnect-Request para forçar a reconexão da sessão no NAS?',
          confirmLabel: 'Desconectar',
        },
      },
    },
    {
      key: 'cancel',
      label: 'Cancel subscription',
      icon: 'block',
      visible: (row) => statusOf(row) !== 'cancelled',
      form: (row) =>
        actionForm(row, {
          action: 'cancel',
          title: 'Cancel subscription',
          description: 'isp.cancelDescription',
          savedMessage: 'Subscription cancelled.',
          initialValues: { reason: '', date: today() },
          fields: [
            { key: 'date', label: 'Cancellation date', type: 'date', span: 1 },
            { key: 'reason', label: 'Reason', type: 'textarea', span: 4, rows: 4 },
          ],
          payload: (values) => ({ reason: values['reason'] || null, date: values['date'] || null }),
        }),
    },
  ];
}
