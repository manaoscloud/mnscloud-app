import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { registryWorkspaceApi } from '../../../shared/crud/configurable-crud/registry-workspace-api';
import { DateTimeFormatService } from '../../../services/date-time-format.service';
import {
  GlobalTableComponent,
  defineGlobalTable,
} from '../../../shared/crud/configurable-crud/global-table';
import { DashboardPageComponent } from '../../../shared/dashboard/dashboard-page';
import {
  DashboardRecord,
  DashboardRecordListComponent,
} from '../../../shared/dashboard/dashboard-record-list';
import { dashboardResource } from '../../../shared/dashboard/dashboard-resource';
import {
  TIMESHEET_FLAGS,
  flagLabels,
  formatDay,
  formatMinutes,
  optionLabel,
  timesheetQuery,
} from '../hr-time';

type HrDashboard = {
  date: string | null;
  timezone: string | null;
  activeEmployees: number | null;
  assignedEmployees: number | null;
  scheduledToday: number | null;
  presentToday: number | null;
  workingNow: number | null;
  lateNow: number | null;
  absentYesterday: number | null;
  openIssues30d: number | null;
  overtimeMonthMinutes: number | null;
  absenceMonthMinutes: number | null;
  issuesByFlag: { flag: string; count: number }[];
  working: { EmployeeUUID: string; EmployeeName: string; SinceAt: string }[];
  attention: { EmployeeUUID: string; EmployeeName: string; Date: string; Flags: string[] }[];
};

const EMPTY: HrDashboard = {
  date: null,
  timezone: null,
  activeEmployees: null,
  assignedEmployees: null,
  scheduledToday: null,
  presentToday: null,
  workingNow: null,
  lateNow: null,
  absentYesterday: null,
  openIssues30d: null,
  overtimeMonthMinutes: null,
  absenceMonthMinutes: null,
  issuesByFlag: [],
  working: [],
  attention: [],
};

const count = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : String(value);

/**
 * HR › Dashboard: who is working now, lateness, absences, open issues and the month overtime of
 * the Pulse timesheet, from one aggregate (`GET /hr/dashboard`). Refresh is the only action.
 */
@Component({
  selector: 'app-hr-dashboard',
  standalone: true,
  imports: [
    DashboardPageComponent,
    DashboardRecordListComponent,
    GlobalTableComponent,
    MatIconModule,
    RouterLink,
    TranslocoPipe,
  ],
  templateUrl: './dashboard.html',
})
export class HrDashboardPage {
  // The HR account opened from HR > Accounts (?hrAccountUUID=), else the internal account.
  private readonly api = registryWorkspaceApi('hr/dashboard');
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly dateTime = inject(DateTimeFormatService);

  readonly dashboard = dashboardResource({
    defaultValue: EMPTY,
    loader: async () => {
      const response = await this.api.get<{ data: HrDashboard }>('hr/dashboard', {
        timeout: 30000,
      });
      return { ...EMPTY, ...response.data };
    },
  });

  /** No employee has a schedule yet: onboarding instead of zero indicators. */
  readonly empty = computed(
    () => this.dashboard.hasData() && this.dashboard.value().assignedEmployees === 0,
  );

  readonly metrics = computed(() => {
    const data = this.dashboard.value();
    return [
      {
        label: 'Working now',
        value: count(data.workingNow),
        note: 'Open interval at this moment',
        state: '',
      },
      {
        label: 'Present today',
        value:
          data.presentToday === null ? '—' : `${data.presentToday} / ${count(data.scheduledToday)}`,
        note: 'Punched today / scheduled to work today',
        state: '',
      },
      {
        label: 'Late now',
        value: count(data.lateNow),
        note: 'Scheduled shift started without a clock in',
        state: (data.lateNow ?? 0) > 0 ? 'state-warn' : '',
      },
      {
        label: 'Absent yesterday',
        value: count(data.absentYesterday),
        note: 'Workday without punches',
        state: (data.absentYesterday ?? 0) > 0 ? 'state-bad' : '',
      },
      {
        label: 'Open issues',
        value: count(data.openIssues30d),
        note: 'Days with issues in the last 30 days',
        state: (data.openIssues30d ?? 0) > 0 ? 'state-warn' : 'state-good',
      },
      {
        label: 'Overtime this month',
        value: formatMinutes(data.overtimeMonthMinutes),
        note: 'Hours:minutes',
        state: '',
      },
      {
        label: 'Absences this month',
        value: formatMinutes(data.absenceMonthMinutes),
        note: 'Hours:minutes',
        state: '',
      },
      {
        label: 'Employees with a schedule',
        value:
          data.assignedEmployees === null
            ? '—'
            : `${data.assignedEmployees} / ${count(data.activeEmployees)}`,
        note: 'With a schedule / with an active Pulse account',
        state: '',
      },
    ];
  });

  readonly working = computed<DashboardRecord[]>(() =>
    this.dashboard.value().working.map((item) => ({
      id: item.EmployeeUUID,
      name: item.EmployeeName,
      meta: this.dateTime.formatDateTime(item.SinceAt),
      status: 'Working',
      tone: 'running',
      details: [{ label: 'Since', value: item.SinceAt, format: 'datetime' }],
    })),
  );

  readonly attention = computed(() =>
    this.dashboard.value().attention.map((item) => ({
      key: `${item.EmployeeUUID}:${item.Date}`,
      name: item.EmployeeName,
      date: formatDay(item.Date, true),
      flags: flagLabels(item.Flags, (key) => this.transloco.translate(key)),
      severe: item.Flags.includes('absence') || item.Flags.includes('rest_violation'),
      query: timesheetQuery(item.EmployeeUUID, item.Date),
    })),
  );

  readonly issueRows = computed(() =>
    this.dashboard
      .value()
      .issuesByFlag.filter((item) => item.count > 0)
      .map((item) => ({ ...item, label: optionLabel(TIMESHEET_FLAGS, item.flag) })),
  );

  readonly issueTable = defineGlobalTable({
    key: 'hr/dashboard/issues',
    uuidField: 'flag',
    emptyLabel: 'No issues in the last 30 days.',
    pagination: false,
    columns: [
      { id: 'label', label: 'Inconsistency', field: 'label', translateValue: true },
      { id: 'count', label: 'Days', field: 'count', kind: 'number' },
    ],
    rowActions: [
      {
        key: 'issues',
        label: 'Open issues',
        icon: 'list',
        run: (row) =>
          void this.router.navigate(['/hr/time-issues'], {
            queryParams: { flag: row['flag'] },
            queryParamsHandling: 'merge',
          }),
      },
    ],
  });
}
