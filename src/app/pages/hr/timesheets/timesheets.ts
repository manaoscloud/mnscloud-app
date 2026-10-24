import { Component, DestroyRef, computed, inject, resource, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ApiService } from '../../../services/api.service';
import { AppI18nService } from '../../../services/app-i18n.service';
import { SnackbarService } from '../../../services/snackbar.service';
import type { ConfigurableCrudRecord } from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import {
  GlobalTableComponent,
  defineGlobalTable,
} from '../../../shared/crud/configurable-crud/global-table';
import { openDataViewerDialog } from '../../../shared/data-viewer-dialog/data-viewer-dialog';
import { MnsSearchSelectFieldComponent } from '../../../shared/forms/mns-search-select-field/mns-search-select-field';
import { DetailPageComponent } from '../../../shared/pages/detail-page';
import {
  DAY_KINDS,
  PUNCH_FLAGS,
  PUNCH_TYPES,
  currentMonth,
  flagLabels,
  formatDay,
  formatMinutes,
  isMonth,
  monthOptions,
  optionLabel,
  shiftMonth,
} from '../hr-time';

type Row = ConfigurableCrudRecord;
type Option = { value: string; label: string };
type Timesheet = {
  employee: { EmployeeUUID: string; Name: string } & Row;
  month: string;
  timezone: string;
  days: Row[];
  unassignedPunches: Row[];
  totals: Row;
};

const EMPLOYEE_PAGE = 50;

function punchTimes(row: Row): string {
  const punches = Array.isArray(row['punches']) ? (row['punches'] as Row[]) : [];
  return punches.map((punch) => String(punch['LocalTime'] ?? '')).join(' · ');
}

function expected(row: Row): string {
  const start = String(row['ExpectedStartLocal'] ?? '');
  const end = String(row['ExpectedEndLocal'] ?? '');
  if (!start) return '—';
  return `${start}–${end || '…'} (${formatMinutes(row['ExpectedMinutes'])})`;
}

const DAY_CHIPS: Record<string, string> = {
  work: 'chip-success',
  off: 'chip-skipped',
  holiday: 'chip-running',
  no_schedule: 'chip-warning',
};

/**
 * HR › Timesheet: the monthly timesheet (espelho de ponto) of one employee as computed by the API,
 * with the immutable original punches of each day. Employee and month live in the URL
 * (`?employeeUUID=&month=`), so issues and dashboard alerts link straight to a timesheet.
 */
@Component({
  selector: 'app-hr-timesheets',
  standalone: true,
  imports: [
    DetailPageComponent,
    GlobalTableComponent,
    MnsSearchSelectFieldComponent,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    TranslocoPipe,
  ],
  templateUrl: './timesheets.html',
  styleUrl: './timesheets.scss',
})
export class HrTimesheetsPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = inject(AppI18nService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly employeeUUID = computed(() => this.query().get('employeeUUID')?.trim() ?? '');
  readonly month = computed(() => {
    const month = this.query().get('month') ?? '';
    return isMonth(month) ? month : currentMonth();
  });
  readonly months = computed(() => monthOptions(this.i18n.language()));
  readonly recalculating = signal(false);

  // Employees: server-searched, paginated (registry/employees), like every remote FK select.
  private readonly employeeSearch = signal('');
  private readonly employeeOffset = signal(0);
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  private reloadTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly employeeList = resource({
    params: () => ({ search: this.employeeSearch(), offset: this.employeeOffset() }),
    defaultValue: { items: [] as Row[], total: 0 },
    loader: async ({ params }) => {
      const query = new URLSearchParams({
        search: params.search,
        limit: String(EMPLOYEE_PAGE),
        offset: String(params.offset),
      });
      const response = await this.api.get<{ data?: { items?: Row[]; total?: number } }>(
        `registry/employees?${query}`,
      );
      return { items: response?.data?.items ?? [], total: Number(response?.data?.total ?? 0) };
    },
  });
  readonly employeesLoading = computed(() => this.employeeList.isLoading());
  readonly employeesError = computed(() => Boolean(this.employeeList.error()));
  readonly employeeHasPrevious = computed(() => this.employeeOffset() > 0);
  readonly employeeHasNext = computed(
    () =>
      this.employeeOffset() + EMPLOYEE_PAGE <
      (this.employeeList.hasValue() ? this.employeeList.value().total : 0),
  );

  readonly sheet = resource({
    params: () =>
      this.employeeUUID() ? { employeeUUID: this.employeeUUID(), month: this.month() } : undefined,
    loader: async ({ params }) => {
      const query = new URLSearchParams({ employeeUUID: params.employeeUUID, month: params.month });
      const response = await this.api.get<{ data: Timesheet }>(`hr/timesheets?${query}`, {
        timeout: 30000,
      });
      return response.data;
    },
  });
  readonly timesheet = computed(() => (this.sheet.hasValue() ? this.sheet.value() : null));
  readonly days = computed(() => this.timesheet()?.days ?? []);
  readonly unassigned = computed(() => this.timesheet()?.unassignedPunches ?? []);

  readonly employeeOptions = computed<Option[]>(() => {
    const items = this.employeeList.hasValue() ? this.employeeList.value().items : [];
    const options = items.map((item) => ({
      value: String(item['EmployeeUUID'] ?? ''),
      label: String(item['Name'] ?? ''),
    }));
    const selected = this.employeeUUID();
    if (selected && !options.some((option) => option.value === selected)) {
      const employee = this.timesheet()?.employee;
      options.unshift({
        value: selected,
        label: employee?.EmployeeUUID === selected ? String(employee.Name ?? selected) : selected,
      });
    }
    return options;
  });

  readonly employeeMeta = computed(() => {
    const employee = this.timesheet()?.employee;
    if (!employee) return '';
    return [employee['CompanyName'], employee['DepartmentName'], employee['PositionName']]
      .filter((value) => typeof value === 'string' && value.trim())
      .join(' · ');
  });

  readonly totals = computed(() => {
    const totals = this.timesheet()?.totals ?? {};
    const overtime = Number(totals['OvertimeMinutes'] ?? 0);
    const restOvertime = Number(totals['OvertimeRestMinutes'] ?? 0);
    const balance = Number(totals['BalanceMinutes'] ?? 0);
    return [
      { label: 'Expected', value: formatMinutes(totals['ExpectedMinutes']), state: '' },
      { label: 'Worked', value: formatMinutes(totals['WorkedMinutes']), state: '' },
      {
        label: 'Balance',
        value: formatMinutes(totals['BalanceMinutes'], true),
        state: balance < 0 ? 'state-bad' : balance > 0 ? 'state-good' : '',
      },
      {
        label: 'Overtime',
        value: formatMinutes(overtime + restOvertime),
        note: restOvertime ? 'Includes rest days and holidays' : '',
        state: '',
      },
      {
        label: 'Absences',
        value: formatMinutes(totals['AbsenceMinutes']),
        note: totals['AbsenceDays'] ? 'Days' : '',
        noteValue: totals['AbsenceDays'],
        state: Number(totals['AbsenceMinutes'] ?? 0) > 0 ? 'state-warn' : '',
      },
      { label: 'Late arrivals', value: formatMinutes(totals['LateMinutes']), state: '' },
      {
        label: 'Night hours',
        value: formatMinutes(totals['NightReducedMinutes'] ?? totals['NightMinutes']),
        note: 'Reduced night hour applied',
        state: '',
      },
      {
        label: 'Days with issues',
        value: totals['IssueDays'] ?? '—',
        state: Number(totals['IssueDays'] ?? 0) > 0 ? 'state-warn' : 'state-good',
      },
    ];
  });

  readonly dayTable = defineGlobalTable({
    key: 'hr/timesheets/days',
    uuidField: 'Date',
    emptyLabel: 'No days in this month.',
    pagination: false,
    columns: [
      {
        id: 'date',
        label: 'Date',
        field: 'Date',
        uuidField: 'Date',
        kind: 'identity',
        value: (row) => formatDay(row['Date'], true),
        detail: (row) =>
          String(row['HolidayName'] ?? '') || String(row['WorkScheduleName'] ?? '') || ' ',
        rowAction: 'punches',
      },
      {
        id: 'kind',
        label: 'Day',
        field: 'DayKind',
        kind: 'status',
        options: DAY_KINDS,
        chipClass: (value) => DAY_CHIPS[String(value)] ?? 'chip-skipped',
      },
      { id: 'expected', label: 'Expected', value: (row) => expected(row) },
      { id: 'punches', label: 'Punches', value: (row) => punchTimes(row) || '—' },
      { id: 'worked', label: 'Worked', value: (row) => formatMinutes(row['WorkedMinutes']) },
      {
        id: 'balance',
        label: 'Balance',
        value: (row) => formatMinutes(row['BalanceMinutes'], true),
      },
      {
        id: 'overtime',
        label: 'Overtime',
        value: (row) =>
          formatMinutes(
            Number(row['OvertimeMinutes'] ?? 0) + Number(row['OvertimeRestMinutes'] ?? 0),
          ),
      },
      { id: 'absence', label: 'Absence', value: (row) => formatMinutes(row['AbsenceMinutes']) },
      {
        id: 'flags',
        label: 'Inconsistencies',
        field: 'Flags',
        kind: 'status',
        value: (row, t) => flagLabels(row['Flags'], t) || '—',
        chipClass: (_value, row) =>
          Array.isArray(row['Flags']) && row['Flags'].length ? 'chip-warning' : 'chip-skipped',
      },
      {
        id: 'late',
        label: 'Late',
        value: (row) => formatMinutes(row['LateMinutes']),
        optional: true,
      },
      {
        id: 'break',
        label: 'Break',
        value: (row) => formatMinutes(row['BreakMinutes']),
        optional: true,
      },
      {
        id: 'night',
        label: 'Night hours',
        value: (row) => formatMinutes(row['NightReducedMinutes'] ?? row['NightMinutes']),
        optional: true,
      },
    ],
    rowActions: [
      {
        key: 'punches',
        label: 'Punches',
        icon: 'fingerprint',
        tooltip: 'Original punches of the day',
        run: (row) => this.showPunches(row),
      },
    ],
  });

  readonly unassignedTable = defineGlobalTable({
    key: 'hr/timesheets/unassigned',
    uuidField: 'TimePunchUUID',
    emptyLabel: 'No punches found.',
    columns: [
      {
        id: 'occurredAt',
        label: 'Official time',
        field: 'OccurredAt',
        uuidField: 'TimePunchUUID',
        kind: 'datetime',
      },
      {
        id: 'type',
        label: 'Punch type',
        field: 'Type',
        options: PUNCH_TYPES,
      },
      { id: 'nsr', label: 'NSR', field: 'NSR', kind: 'number' },
    ],
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      clearTimeout(this.searchTimer);
      clearTimeout(this.reloadTimer);
    });
  }

  refresh(): void {
    if (this.employeeUUID()) this.sheet.reload();
    else this.employeeList.reload();
  }

  setEmployee(value: unknown): void {
    this.navigate({ employeeUUID: String(value ?? '') || null });
  }

  setMonth(value: unknown): void {
    if (isMonth(value)) this.navigate({ month: value });
  }

  moveMonth(delta: number): void {
    this.navigate({ month: shiftMonth(this.month(), delta) });
  }

  searchEmployees(term: string): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.employeeOffset.set(0);
      this.employeeSearch.set(term.trim());
    }, 250);
  }

  pageEmployees(direction: number): void {
    this.employeeOffset.update((offset) => Math.max(0, offset + direction * EMPLOYEE_PAGE));
  }

  async recalculate(): Promise<void> {
    const employeeUUID = this.employeeUUID();
    if (!employeeUUID || this.recalculating()) return;
    this.recalculating.set(true);
    try {
      await this.api.post('hr/timesheets/recalculate', { employeeUUID, month: this.month() });
      this.snack.success(
        this.transloco.translate(
          'Recalculation requested. The timesheet refreshes in a few seconds.',
        ),
      );
      clearTimeout(this.reloadTimer);
      this.reloadTimer = setTimeout(() => this.sheet.reload(), 5000);
    } catch {
      // The API interceptor already shows the error.
    } finally {
      this.recalculating.set(false);
    }
  }

  private navigate(changes: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { employeeUUID: this.employeeUUID() || null, month: this.month(), ...changes },
      replaceUrl: true,
    });
  }

  private showPunches(row: Row): void {
    const t = (key: string) => this.transloco.translate(key);
    const punches = Array.isArray(row['punches']) ? (row['punches'] as Row[]) : [];
    const kind = optionLabel(DAY_KINDS, row['DayKind']);
    openDataViewerDialog(this.dialog, {
      title: 'Punches of the day',
      description:
        'Original punches as recorded by Pulse; they are never changed. Times are in the time zone of the time policy.',
      details: [
        { label: 'Date', value: formatDay(row['Date'], true), translate: false },
        { label: 'Day', value: kind },
        {
          label: 'Work schedule',
          value: String(row['HolidayName'] ?? '') || String(row['WorkScheduleName'] ?? '') || '—',
          translate: false,
        },
        { label: 'Expected', value: expected(row), translate: false },
        { label: 'Worked', value: formatMinutes(row['WorkedMinutes']), translate: false },
        { label: 'Balance', value: formatMinutes(row['BalanceMinutes'], true), translate: false },
        {
          label: 'Inconsistencies',
          value: flagLabels(row['Flags'], t) || this.transloco.translate('None'),
          translate: false,
          wide: true,
        },
      ],
      sections: [
        {
          title: 'Punches',
          table: {
            emptyLabel: 'No punches found.',
            columns: [
              { key: 'time', label: 'Time', monospace: true },
              { key: 'type', label: 'Punch type' },
              { key: 'nsr', label: 'NSR', monospace: true },
              { key: 'notes', label: 'Flags' },
            ],
            rows: punches.map((punch) => ({
              time: String(punch['LocalTime'] ?? ''),
              type: t(optionLabel(PUNCH_TYPES, punch['Type'])),
              nsr: punch['NSR'] ?? '—',
              notes:
                [
                  punch['Offline'] ? t('Sent later (offline)') : '',
                  ...(Array.isArray(punch['Flags']) ? (punch['Flags'] as string[]) : []).map(
                    (flag) => t(PUNCH_FLAGS[flag] ?? flag),
                  ),
                ]
                  .filter(Boolean)
                  .join(', ') || '—',
            })),
          },
        },
      ],
    });
  }
}
