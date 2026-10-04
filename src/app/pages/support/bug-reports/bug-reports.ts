import { Component, afterNextRender, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import {
  BUG_REPORT_SEVERITY_OPTIONS,
  BUG_REPORT_TYPE_OPTIONS,
} from '../../../shared/bug-report-dialog/bug-report-dialog';
import {
  DataViewerDetail,
  DataViewerSection,
  openDataViewerDialog,
} from '../../../shared/data-viewer-dialog/data-viewer-dialog';
import { BugReportService } from '../../../services/bug-report.service';

const STATUS_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'new', label: 'New' },
  { value: 'triaged', label: 'Triaged' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
  { value: 'rejected', label: 'Rejected' },
];

const TYPE_OPTIONS = BUG_REPORT_TYPE_OPTIONS as readonly ConfigurableCrudOption[];
const SEVERITY_OPTIONS = BUG_REPORT_SEVERITY_OPTIONS as readonly ConfigurableCrudOption[];
const ALL_OPTION: ConfigurableCrudOption = { value: '', label: 'All' };

const EMAIL_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'sent', label: 'Sent' },
  { value: 'failed', label: 'Failed' },
  { value: 'skipped', label: 'Skipped' },
];

const statusChip = (value: unknown) =>
  value === 'resolved' || value === 'closed'
    ? 'chip-success'
    : value === 'rejected'
      ? 'chip-skipped'
      : value === 'new'
        ? 'chip-failed'
        : 'chip-running';

const severityChip = (value: unknown) =>
  value === 'critical' || value === 'high'
    ? 'chip-failed'
    : value === 'medium'
      ? 'chip-running'
      : 'chip-skipped';

function buildConfig(master: boolean): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: 'system/bug-reports',
    uuidField: 'BgrUUID',
    pageTitle: master ? 'Problem reports' : 'My problem reports',
    pageDescription: master
      ? 'Problems and suggestions reported from the App by every user. Triage, answer the reporter and resend the team email.'
      : 'Problems and suggestions you reported, with their status and the team answer.',
    editTitle: 'Triage problem report',
    dialogDescription:
      'The answer is shown to the reporter; internal notes stay with the platform team.',
    searchPlaceholder: master
      ? 'Protocol, summary, details or reporter email'
      : 'Protocol, summary or details',
    emptyLabel: 'No problem reports found.',
    deleteTitle: 'Delete problem report',
    deleteMessage: 'Delete this problem report?',
    savedMessage: 'Problem report updated successfully.',
    deletedMessage: 'Problem report deleted successfully.',
    deleteFailedMessage: 'Failed to delete problem report.',
    listQuery: master ? { scope: 'all' } : { scope: 'mine' },
    serverSidePagination: true,
    initialPageSize: 10,
    canCreate: false,
    canEdit: master,
    canDelete: master,
    bulkDelete: false,
    statusMode: 'string',
    activeValue: 'new',
    inactiveValue: 'closed',
    statusOptions: STATUS_OPTIONS,
    activeStatusValues: ['new', 'triaged', 'in_progress'],
    statusFilter: true,
    filterActions: [{ key: 'report', label: 'Report problem', icon: 'bug_report' }],
    listFilters: [
      {
        key: 'type',
        label: 'Problem Type',
        type: 'search-select',
        span: 1,
        emptyLabel: 'All',
        options: [ALL_OPTION, ...TYPE_OPTIONS],
        translateOptions: true,
      },
      {
        key: 'severity',
        label: 'Severity',
        type: 'search-select',
        span: 1,
        emptyLabel: 'All',
        options: [ALL_OPTION, ...SEVERITY_OPTIONS],
        translateOptions: true,
      },
    ],
    rowActions: [
      { key: 'view', label: 'View details', icon: 'visibility' },
      {
        key: 'screenshot',
        label: 'Open screenshot',
        icon: 'image',
        visible: (row) => row['HasScreenshot'] === true || row['HasScreenshot'] === 1,
      },
      ...(master
        ? [
            {
              key: 'notify',
              label: 'Resend team email',
              icon: 'forward_to_inbox',
              request: {
                method: 'post',
                endpoint: (row: ConfigurableCrudRecord) =>
                  `system/bug-reports/${String(row['BgrUUID'])}/notify`,
                successMessage: 'Problem report email sent.',
                confirm: {
                  title: 'Resend team email',
                  message: 'Send the problem report email to the platform team again?',
                },
              },
            } satisfies ConfigurableCrudRowAction,
          ]
        : []),
    ],
    initialValues: { status: 'new', severity: 'medium', resolutionNotes: '', internalNotes: '' },
    payload: (values) => ({
      status: values['status'],
      severity: values['severity'],
      resolutionNotes: values['resolutionNotes'] ?? '',
      internalNotes: values['internalNotes'] ?? '',
    }),
    fields: [
      {
        key: 'title',
        source: 'BgrTitle',
        label: 'Summary',
        span: 4,
        disabledWhen: () => true,
      },
      {
        key: 'description',
        source: 'BgrDescription',
        label: 'Problem Details',
        type: 'textarea',
        rows: 4,
        span: 4,
        disabledWhen: () => true,
      },
      {
        key: 'status',
        source: 'BgrStatus',
        payloadKey: 'status',
        label: 'Status',
        type: 'search-select',
        options: STATUS_OPTIONS,
        translateOptions: true,
        required: true,
        span: 2,
      },
      {
        key: 'severity',
        source: 'BgrSeverity',
        payloadKey: 'severity',
        label: 'Severity',
        type: 'search-select',
        options: SEVERITY_OPTIONS,
        translateOptions: true,
        required: true,
        span: 2,
      },
      {
        key: 'resolutionNotes',
        source: 'BgrResolutionNotes',
        payloadKey: 'resolutionNotes',
        label: 'Answer to the reporter',
        help: 'Visible to the user who reported the problem.',
        type: 'textarea',
        rows: 3,
        span: 4,
      },
      {
        key: 'internalNotes',
        source: 'BgrInternalNotes',
        payloadKey: 'internalNotes',
        label: 'Internal notes',
        help: 'Visible only to the platform team.',
        type: 'textarea',
        rows: 3,
        span: 4,
      },
    ],
    columns: [
      { id: 'protocol', field: 'BgrID', label: 'Protocol', kind: 'identity' },
      { id: 'title', field: 'BgrTitle', label: 'Summary' },
      {
        id: 'type',
        field: 'BgrType',
        label: 'Problem Type',
        kind: 'status',
        options: TYPE_OPTIONS,
        chipClass: () => 'chip-skipped',
      },
      {
        id: 'severity',
        field: 'BgrSeverity',
        label: 'Severity',
        kind: 'status',
        options: SEVERITY_OPTIONS,
        chipClass: severityChip,
      },
      {
        id: 'reporter',
        field: 'ReporterEmail',
        label: 'Reporter',
        hiddenWhen: () => !master,
        detail: (row) => String(row['EnvironmentName'] ?? ''),
      },
      {
        id: 'email',
        field: 'BgrNotifyStatus',
        label: 'Team email',
        kind: 'status',
        options: EMAIL_OPTIONS,
        hiddenWhen: () => !master,
        chipClass: (value) =>
          value === 'sent' ? 'chip-success' : value === 'failed' ? 'chip-failed' : 'chip-running',
      },
      { id: 'created', field: 'BgrDateCreated', label: 'Created', kind: 'datetime' },
      {
        id: 'status',
        field: 'BgrStatus',
        label: 'Status',
        kind: 'status',
        options: STATUS_OPTIONS,
        chipClass: statusChip,
        className: 'status-col',
      },
    ],
  });
}

function optionLabel(options: readonly ConfigurableCrudOption[], value: unknown): string {
  return options.find((option) => option.value === value)?.label ?? String(value ?? '-');
}

type Diagnostics = {
  platform?: string | null;
  timezone?: string | null;
  consoleLogs?: Array<{ type: string; message: string; timestamp: string | null }>;
  failedRequests?: Array<{
    method: string;
    url: string;
    status: number | null;
    requestId: string | null;
    message: string | null;
    timestamp: string | null;
  }>;
  navigation?: string[];
};

@Component({
  selector: 'app-bug-reports',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class SupportBugReportsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly master: boolean;
  private readonly reports = inject(BugReportService);

  constructor() {
    const route = inject(ActivatedRoute);
    const master = route.snapshot.data['scope'] === 'master';
    super(buildConfig(master));
    this.master = master;
    // Email links open one report directly: /system/support/bug-reports?report=<uuid>.
    const requested = route.snapshot.queryParamMap.get('report');
    if (requested) afterNextRender(() => void this.viewReport(requested));
  }

  override async handleFilterAction(action: { key: string }) {
    if (action.key === 'report') await this.reports.openReportDialog();
  }

  override async handleRowAction(action: { key: string }, row: ConfigurableCrudRecord) {
    const uuid = this.recordUUID(row);
    if (action.key === 'view') await this.viewReport(uuid);
    if (action.key === 'screenshot') await this.openScreenshot(uuid);
  }

  private async viewReport(uuid: string) {
    try {
      const response = await this.api.get<{ data?: ConfigurableCrudRecord }>(
        `system/bug-reports/${encodeURIComponent(uuid)}`,
      );
      const report = response?.data;
      if (!report) return;
      const diagnostics = (report['BgrDiagnostics'] ?? {}) as Diagnostics;
      const details: DataViewerDetail[] = [
        { label: 'Protocol', value: report['BgrID'], monospace: true },
        {
          label: 'Status',
          value: optionLabel(STATUS_OPTIONS, report['BgrStatus']),
          translate: true,
        },
        {
          label: 'Problem Type',
          value: optionLabel(TYPE_OPTIONS, report['BgrType']),
          translate: true,
        },
        {
          label: 'Severity',
          value: optionLabel(SEVERITY_OPTIONS, report['BgrSeverity']),
          translate: true,
        },
        { label: 'Created', value: report['BgrDateCreated'], kind: 'datetime' },
        { label: 'Resolved at', value: report['BgrResolvedAt'], kind: 'datetime' },
        ...(this.master
          ? [
              {
                label: 'Reporter',
                value: `${report['ReporterName'] ?? ''} <${report['ReporterEmail'] ?? ''}>`,
              },
              {
                label: 'Environment',
                value: report['EnvironmentName'] ?? report['EnvironmentUUID'],
              },
              {
                label: 'Team email',
                value: optionLabel(EMAIL_OPTIONS, report['BgrNotifyStatus']),
                translate: true,
              },
              { label: 'Email error', value: report['BgrNotifyError'] },
            ]
          : []),
        { label: 'Page URL', value: report['BgrPageUrl'], monospace: true, wide: true },
      ];
      const sections: DataViewerSection[] = [
        { title: 'Summary', code: { value: report['BgrTitle'], format: 'text' } },
        { title: 'Problem Details', code: { value: report['BgrDescription'], format: 'text' } },
      ];
      if (report['BgrResolutionNotes']) {
        sections.push({
          title: 'Team answer',
          code: { value: report['BgrResolutionNotes'], format: 'text' },
        });
      }
      if (this.master && report['BgrInternalNotes']) {
        sections.push({
          title: 'Internal notes',
          code: { value: report['BgrInternalNotes'], format: 'text' },
        });
      }
      sections.push({
        title: 'Environment',
        details: [
          { label: 'App route', value: report['BgrRoute'], monospace: true },
          { label: 'App version', value: report['BgrAppVersion'], monospace: true },
          { label: 'API version', value: report['BgrApiVersion'], monospace: true },
          { label: 'Screen Size', value: report['BgrViewport'] },
          { label: 'Language', value: report['BgrLanguage'] },
          { label: 'Timezone', value: diagnostics.timezone },
          { label: 'Browser', value: report['BgrUserAgent'], wide: true },
        ],
      });
      if (diagnostics.failedRequests?.length) {
        sections.push({
          title: 'Failed requests',
          table: {
            columns: [
              { key: 'timestamp', label: 'Time', kind: 'datetime' },
              { key: 'method', label: 'Method', monospace: true },
              { key: 'url', label: 'URL', monospace: true },
              { key: 'status', label: 'Status' },
              { key: 'requestId', label: 'Correlation ID', monospace: true },
              { key: 'message', label: 'Message' },
            ],
            rows: diagnostics.failedRequests,
          },
        });
      }
      if (diagnostics.consoleLogs?.length) {
        sections.push({
          title: 'Console errors',
          code: {
            value: diagnostics.consoleLogs
              .map((entry) => `[${entry.type}] ${entry.timestamp ?? ''} ${entry.message}`)
              .join('\n\n'),
            format: 'text',
            copy: true,
          },
        });
      }
      if (diagnostics.navigation?.length) {
        sections.push({
          title: 'Recent navigation',
          code: { value: diagnostics.navigation.join('\n'), format: 'text' },
        });
      }
      openDataViewerDialog(this.dialog, {
        title: 'Problem report',
        description: String(report['BgrTitle'] ?? ''),
        status: {
          value: optionLabel(STATUS_OPTIONS, report['BgrStatus']),
          tone:
            report['BgrStatus'] === 'resolved' || report['BgrStatus'] === 'closed'
              ? 'success'
              : report['BgrStatus'] === 'rejected'
                ? 'neutral'
                : 'warning',
        },
        details,
        sections,
      });
    } catch {
      // The API interceptor shows the error.
    }
  }

  private async openScreenshot(uuid: string) {
    // Open the tab synchronously so popup blockers allow it, then load the private image.
    const tab = window.open('', '_blank');
    try {
      const blob = await this.api.getBlob(
        `system/bug-reports/${encodeURIComponent(uuid)}/screenshot`,
      );
      const url = URL.createObjectURL(blob);
      if (tab) tab.location.href = url;
      else window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      tab?.close();
    }
  }
}
