import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { quickCreateFor } from '../../../shared/crud/configurable-crud/quick-create';
import { formatMinutes, hhmm } from '../hr-time';
import { HR_COMPANY_LOOKUP, HR_YES_NO } from '../hr-crud-shared';
import {
  BANK_AGREEMENTS,
  OVERTIME_MODES,
  durationText,
  parseDuration,
} from '../closing/closing-shared';

/** IANA time zones of Brazil (the API accepts any valid IANA zone). */
const TIMEZONES: readonly ConfigurableCrudOption[] = [
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Cuiaba',
  'America/Campo_Grande',
  'America/Porto_Velho',
  'America/Boa_Vista',
  'America/Rio_Branco',
  'America/Belem',
  'America/Fortaleza',
  'America/Recife',
  'America/Maceio',
  'America/Bahia',
  'America/Araguaina',
  'America/Noronha',
].map((zone) => ({ value: zone, label: zone }));

/** Photo at punch (PU8): a missing photo flags the mark for HR, it never blocks it. */
const PHOTO_MODES: readonly ConfigurableCrudOption[] = [
  { value: 'off', label: 'Not asked' },
  { value: 'optional', label: 'Optional' },
  { value: 'required', label: 'Asked at every punch' },
];

const number = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return value === '' || value === null || value === undefined || !Number.isFinite(parsed)
    ? fallback
    : parsed;
};

/** Monthly hours limit in minutes; none when empty, the typed text when invalid (the API refuses it). */
const monthlyLimit = (value: unknown) =>
  String(value ?? '').trim() ? (parseDuration(value) ?? value) : null;

// Timesheet rules per company (or the tenant default when no company is chosen): time zone,
// CLT tolerances, overtime limit, night period and the rates reported in the monthly totals.
const config = defineCrud({
  endpoint: 'hr/time-policies',
  uuidField: 'TimePolicyUUID',
  pageTitle: 'Time policies',
  pageDescription:
    'Timesheet rules of the tenant or of one company: time zone, tolerances, overtime limit, night period, minimum rest and the rates of the monthly totals. Without a policy the CLT defaults apply.',
  createTitle: 'New time policy',
  editTitle: 'Edit time policy',
  searchPlaceholder: 'Company',
  emptyLabel: 'No time policies found. The CLT defaults apply until you create one.',
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  initialValues: {
    companyUUID: '',
    timezone: 'America/Sao_Paulo',
    markToleranceMinutes: 5,
    dailyToleranceMinutes: 10,
    dailyOvertimeLimitMinutes: 120,
    nightStart: '22:00',
    nightEnd: '05:00',
    nightReducedHour: true,
    minRestMinutes: 660,
    overtimeRate: 50,
    restDayRate: 100,
    nightRate: 20,
    punchPhotoMode: 'required',
    markReminders: false,
    overtimeMode: 'payment',
    bankPeriodMonths: 6,
    bankAgreement: 'individual',
    bankAgreementRef: '',
    monthlyLimit: '',
    notes: '',
  },
  tabLabels: { limits: 'Overtime' },
  columns: [
    {
      id: 'company',
      label: 'Company',
      field: 'CompanyName',
      uuidField: 'TimePolicyUUID',
      kind: 'identity',
      value: (row, translate) => String(row['CompanyName'] ?? '') || translate('Tenant default'),
    },
    { id: 'timezone', label: 'Time zone', field: 'Timezone', translateValue: false },
    {
      id: 'tolerance',
      label: 'Tolerance (mark / day)',
      field: 'MarkToleranceMinutes',
      value: (row) => `${row['MarkToleranceMinutes']} / ${row['DailyToleranceMinutes']} min`,
    },
    {
      id: 'overtime',
      label: 'Daily overtime limit',
      field: 'DailyOvertimeLimitMinutes',
      value: (row) => formatMinutes(row['DailyOvertimeLimitMinutes']),
    },
    {
      id: 'night',
      label: 'Night period',
      field: 'NightStart',
      value: (row) => `${hhmm(row['NightStart'])}–${hhmm(row['NightEnd'])}`,
    },
    {
      id: 'rest',
      label: 'Minimum rest',
      field: 'MinRestMinutes',
      value: (row) => formatMinutes(row['MinRestMinutes']),
    },
    {
      id: 'rates',
      label: 'Rates (overtime / rest day / night)',
      field: 'OvertimeRate',
      value: (row) => `${row['OvertimeRate']}% / ${row['RestDayRate']}% / ${row['NightRate']}%`,
      optional: true,
    },
    {
      id: 'overtimeMode',
      label: 'Overtime treatment',
      field: 'OvertimeMode',
      options: OVERTIME_MODES,
    },
    {
      id: 'photo',
      label: 'Photo at punch',
      field: 'PunchPhotoMode',
      options: PHOTO_MODES,
    },
  ],
  fields: [
    {
      key: 'companyUUID',
      source: 'CompanyUUID',
      label: 'Company',
      type: 'search-select',
      remoteLookup: HR_COMPANY_LOOKUP,
      quickCreate: quickCreateFor('RegCompanyRcoUUID'),
      disabledWhen: ({ editing }) => editing,
      help: 'Empty creates the tenant default policy, used by every company without its own policy. The company cannot be changed after saving.',
    },
    {
      key: 'timezone',
      source: 'Timezone',
      label: 'Time zone',
      type: 'select',
      options: TIMEZONES,
      translateOptions: false,
      required: true,
      help: 'Local time of the workplace: days, expected times and the night period are computed in this zone.',
    },
    {
      key: 'markToleranceMinutes',
      source: 'MarkToleranceMinutes',
      label: 'Tolerance per mark (min)',
      type: 'number',
      help: 'CLT art. 58 §1: variations of up to 5 minutes per mark are not counted as lateness or overtime (0 to 30).',
      span: 1,
      breakBefore: true,
    },
    {
      key: 'dailyToleranceMinutes',
      source: 'DailyToleranceMinutes',
      label: 'Daily tolerance (min)',
      type: 'number',
      help: 'CLT art. 58 §1: up to 10 minutes per day in total are disregarded (0 to 60).',
      span: 1,
    },
    {
      key: 'dailyOvertimeLimitMinutes',
      source: 'DailyOvertimeLimitMinutes',
      label: 'Daily overtime limit (min)',
      type: 'number',
      help: 'CLT art. 59: at most 2 hours (120 minutes) of overtime per day; days above it are flagged (0 to 720).',
      span: 1,
    },
    {
      key: 'minRestMinutes',
      source: 'MinRestMinutes',
      label: 'Minimum rest between shifts (min)',
      type: 'number',
      help: 'CLT art. 66: at least 11 hours (660 minutes) between the end of one shift and the start of the next (0 to 1440).',
      span: 1,
    },
    {
      key: 'nightStart',
      source: 'NightStart',
      label: 'Night period start',
      type: 'time',
      fromRecord: (value) => hhmm(value),
      help: 'CLT art. 73: urban night work runs from 22:00 to 05:00.',
      span: 1,
      breakBefore: true,
    },
    {
      key: 'nightEnd',
      source: 'NightEnd',
      label: 'Night period end',
      type: 'time',
      fromRecord: (value) => hhmm(value),
      span: 1,
    },
    {
      key: 'nightReducedHour',
      source: 'NightReducedHour',
      label: 'Reduced night hour',
      type: 'select',
      options: HR_YES_NO,
      help: 'CLT art. 73 §1: each night hour counts as 52 minutes and 30 seconds.',
      span: 1,
    },
    {
      key: 'nightRate',
      source: 'NightRate',
      label: 'Night premium (%)',
      type: 'number',
      help: 'CLT art. 73: at least 20% over the day hour.',
      span: 1,
    },
    {
      key: 'overtimeRate',
      source: 'OvertimeRate',
      label: 'Overtime rate (%)',
      type: 'number',
      help: 'Constitution art. 7 XVI and CLT art. 59 §1: at least 50% over the normal hour.',
      span: 1,
      breakBefore: true,
    },
    {
      key: 'restDayRate',
      source: 'RestDayRate',
      label: 'Rest day and holiday rate (%)',
      type: 'number',
      help: 'Work on rest days and holidays without compensation is paid double (100%, Law 605/1949 art. 9).',
      span: 1,
    },
    {
      key: 'punchPhotoMode',
      source: 'PunchPhotoMode',
      label: 'Photo at punch',
      type: 'select',
      options: PHOTO_MODES,
      help: 'When the photo is asked at every punch (also the default without a policy), Pulse confirms a mark only after a live photo with the front camera; when it is optional, the employee may skip it. A mark that still arrives without a photo (offline device, failed upload) is recorded and shown here without photo. Photos are private, seen only with the time punches permission and removed after 90 days.',
      span: 1,
      breakBefore: true,
    },
    {
      key: 'markReminders',
      source: 'MarkReminders',
      label: 'Mark reminders',
      type: 'select',
      options: HR_YES_NO,
      help: 'Employees may turn on clock-in and clock-out reminders by push notification in Pulse.',
      span: 1,
    },
    {
      key: 'overtimeMode',
      source: 'OvertimeMode',
      label: 'Treatment',
      type: 'select',
      options: OVERTIME_MODES,
      tab: 'limits',
      help: 'Pay in the month pays the overtime in the payroll. Compensate in the month offsets the overtime of the month against the lateness and absences of the same month; the rest is paid or discounted. Hour bank (CLT art. 59 §5) credits the overtime and compensates it with time off within the period below; what is not compensated is paid at the closing of the month it expires.',
    },
    {
      key: 'bankAgreement',
      source: 'BankAgreement',
      label: 'Hour bank agreement',
      type: 'select',
      options: BANK_AGREEMENTS,
      tab: 'limits',
      hiddenWhen: ({ values }) => values['overtimeMode'] !== 'bank',
      help: 'An individual written agreement allows a bank of up to 6 months; a collective agreement or convention allows up to 12 months (CLT art. 59 §2 and §5).',
    },
    {
      key: 'bankAgreementRef',
      source: 'BankAgreementRef',
      label: 'Agreement or convention reference',
      tab: 'limits',
      hiddenWhen: ({ values }) =>
        values['overtimeMode'] !== 'bank' || values['bankAgreement'] !== 'collective',
      requiredWhen: ({ values }) =>
        values['overtimeMode'] === 'bank' && values['bankAgreement'] === 'collective',
      help: 'Identification of the collective agreement or convention (up to 120 characters), for example the registration number.',
    },
    {
      key: 'bankPeriodMonths',
      source: 'BankPeriodMonths',
      label: 'Compensation period (months)',
      type: 'number',
      tab: 'limits',
      hiddenWhen: ({ values }) => values['overtimeMode'] !== 'bank',
      help: 'From 1 to 6 months with an individual agreement, up to 12 with a collective one. Credits not compensated within the period expire and are paid.',
    },
    {
      key: 'monthlyLimit',
      source: 'MonthlyLimitMinutes',
      label: 'Monthly hours limit',
      tab: 'limits',
      fromRecord: (value) => durationText(value),
      placeholder: '180:00',
      help: 'Optional. Hours and minutes (180:00) or hours (180). The closing flags months above it, for example the limit set by a 12x36 collective agreement.',
    },
    {
      key: 'notes',
      source: 'Notes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
  payload: (values, editing) => ({
    ...(editing ? {} : { companyUUID: values['companyUUID'] || null }),
    timezone: values['timezone'] || 'America/Sao_Paulo',
    markToleranceMinutes: number(values['markToleranceMinutes'], 5),
    dailyToleranceMinutes: number(values['dailyToleranceMinutes'], 10),
    dailyOvertimeLimitMinutes: number(values['dailyOvertimeLimitMinutes'], 120),
    nightStart: hhmm(values['nightStart']) || '22:00',
    nightEnd: hhmm(values['nightEnd']) || '05:00',
    nightReducedHour: values['nightReducedHour'] !== false,
    minRestMinutes: number(values['minRestMinutes'], 660),
    overtimeRate: number(values['overtimeRate'], 50),
    restDayRate: number(values['restDayRate'], 100),
    nightRate: number(values['nightRate'], 20),
    punchPhotoMode: ['optional', 'required'].includes(String(values['punchPhotoMode']))
      ? values['punchPhotoMode']
      : 'off',
    markReminders: values['markReminders'] === true,
    overtimeMode: ['bank', 'compensation'].includes(String(values['overtimeMode']))
      ? values['overtimeMode']
      : 'payment',
    // Bank fields only in bank mode: hidden values must never fail the save; the API keeps the stored ones.
    ...(values['overtimeMode'] === 'bank'
      ? {
          bankPeriodMonths: number(values['bankPeriodMonths'], 6),
          bankAgreement: values['bankAgreement'] === 'collective' ? 'collective' : 'individual',
          bankAgreementRef:
            String(values['bankAgreementRef'] ?? '')
              .trim()
              .slice(0, 120) || null,
        }
      : {}),
    monthlyLimitMinutes: monthlyLimit(values['monthlyLimit']),
    notes: values['notes'] ?? null,
  }),
});

@Component({
  selector: 'app-hr-time-policies',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HrTimePoliciesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  override async saveItem(saveAndNew = false): Promise<void> {
    if (this.saving()) return;
    const values = this.formValues();
    if (values['overtimeMode'] === 'bank') {
      const max = values['bankAgreement'] === 'collective' ? 12 : 6;
      const months = Number(values['bankPeriodMonths']);
      if (!Number.isInteger(months) || months < 1 || months > max) {
        this.clearFieldErrors(null);
        this.rejectField(
          'bankPeriodMonths',
          max === 12
            ? 'The compensation period must be from 1 to 12 months.'
            : 'The compensation period must be from 1 to 6 months with an individual agreement.',
        );
        return;
      }
    }
    await super.saveItem(saveAndNew);
  }
}
