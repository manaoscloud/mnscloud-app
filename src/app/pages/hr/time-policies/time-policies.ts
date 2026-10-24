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

const YES_NO: readonly ConfigurableCrudOption[] = [
  { value: true, label: 'Yes' },
  { value: false, label: 'No' },
];

const COMPANY_LOOKUP = {
  endpoint: 'registry/companies?status=1',
  uuidField: 'CompanyUUID',
  labelField: 'Name',
  selectedLabelField: 'CompanyName',
};

const number = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return value === '' || value === null || value === undefined || !Number.isFinite(parsed)
    ? fallback
    : parsed;
};

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
    notes: '',
  },
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
  ],
  fields: [
    {
      key: 'companyUUID',
      source: 'CompanyUUID',
      label: 'Company',
      type: 'search-select',
      remoteLookup: COMPANY_LOOKUP,
      quickCreate: quickCreateFor('RegCompanyRcoUUID'),
      disabledWhen: ({ editing }) => editing,
      help: 'Empty creates the tenant default policy, used by every company without its own policy. The company cannot be changed after saving.',
      span: 2,
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
      span: 2,
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
      options: YES_NO,
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
}
