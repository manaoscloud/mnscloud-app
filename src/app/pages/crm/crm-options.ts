import type { ConfigurableCrudOption } from '../../shared/crud/configurable-crud/configurable-crud-page-base';

/** One translated option source for CRM forms, list filters and table cells. */
export const CRM_OPTIONS = {
  stageKinds: [
    {
      value: 'open',
      label: 'crm.enum.open',
    },
    {
      value: 'won',
      label: 'crm.enum.won',
    },
    {
      value: 'lost',
      label: 'crm.enum.lost',
    },
  ],
  proposalStates: [
    {
      value: 'draft',
      label: 'crm.enum.draft',
    },
    {
      value: 'sent',
      label: 'crm.enum.sent',
    },
    {
      value: 'accepted',
      label: 'crm.enum.accepted',
    },
    {
      value: 'rejected',
      label: 'crm.enum.rejected',
    },
    {
      value: 'expired',
      label: 'crm.enum.expired',
    },
  ],
  productPeriods: [
    {
      value: 'once',
      label: 'crm.enum.once',
    },
    {
      value: 'monthly',
      label: 'crm.enum.monthly',
    },
    {
      value: 'yearly',
      label: 'crm.enum.yearly',
    },
  ],
  recurringPeriods: [
    {
      value: 'monthly',
      label: 'crm.enum.monthly',
    },
    {
      value: 'yearly',
      label: 'crm.enum.yearly',
    },
  ],
  leadStates: [
    {
      value: 'new',
      label: 'crm.enum.new',
    },
    {
      value: 'contacting',
      label: 'crm.enum.contacting',
    },
    {
      value: 'qualified',
      label: 'crm.enum.qualified',
    },
    {
      value: 'disqualified',
      label: 'crm.enum.disqualified',
    },
    {
      value: 'converted',
      label: 'crm.enum.converted',
    },
  ],
  handoffStates: [
    {
      value: 'pending',
      label: 'crm.enum.pending',
    },
    {
      value: 'forwarded',
      label: 'crm.enum.forwarded',
    },
    {
      value: 'accepted',
      label: 'crm.enum.accepted',
    },
  ],
  contactPreferences: [
    {
      value: 'not_recorded',
      label: 'crm.enum.not_recorded',
    },
    {
      value: 'email',
      label: 'crm.enum.email',
    },
    {
      value: 'phone',
      label: 'crm.enum.phone',
    },
    {
      value: 'both',
      label: 'crm.enum.both',
    },
    {
      value: 'blocked',
      label: 'crm.enum.blocked',
    },
  ],
  activityKinds: [
    {
      value: 'task',
      label: 'crm.enum.task',
    },
    {
      value: 'call',
      label: 'crm.enum.call',
    },
    {
      value: 'meeting',
      label: 'crm.enum.meeting',
    },
    {
      value: 'email',
      label: 'crm.enum.email',
    },
  ],
  activityStates: [
    {
      value: 'planned',
      label: 'crm.enum.planned',
    },
    {
      value: 'done',
      label: 'crm.enum.done',
    },
    {
      value: 'cancelled',
      label: 'crm.enum.cancelled',
    },
  ],
  accountTypes: [
    {
      value: 'company',
      label: 'crm.enum.company',
    },
    {
      value: 'person',
      label: 'crm.enum.person',
    },
  ],
} satisfies Record<string, readonly ConfigurableCrudOption[]>;
