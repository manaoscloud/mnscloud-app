import { ActivatedRoute } from '@angular/router';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { SupportDesk, supportBase, supportDesk, YES_NO_OPTIONS } from '../shared/support-desk';
import { Component, inject } from '@angular/core';
import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
const yesNo: ConfigurableCrudOption[] = [
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
];
function config(desk: SupportDesk): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: `${supportBase(desk)}/teams`,
    uuidField: 'SupportTeamUUID',
    pageTitle: 'Support teams',
    pageDescription: 'Manage teams responsible for tenant support work.',
    createTitle: 'New support team',
    editTitle: 'Edit support team',
    dialogDescription: 'Maintain the support team capacity and queue settings.',
    searchPlaceholder: 'Search',
    emptyLabel: 'No support teams found.',
    deleteTitle: 'Delete support team',
    deleteMessage: 'Delete this support team?',
    deleteSelectedTitle: 'Delete selected support teams',
    deleteSelectedMessage: 'Delete {count} selected support teams?',
    savedMessage: 'Support team saved successfully.',
    deletedMessage: 'Support team deleted successfully.',
    deleteFailedMessage: 'Failed to delete support team.',
    statusMode: 'number',
    activeValue: 1,
    inactiveValue: 0,
    bulkDelete: false,
    serverSidePagination: true,
    rowActions: [
      {
        key: 'members',
        label: 'Members',
        icon: 'group',
        collection: (row) => membersConfig(desk, row),
      },
    ],
    initialValues: {
      status: 1,
      isDefault: 0,
      name: '',
      code: '',
      queuePriority: 0,
      maxConcurrentTickets: 0,
      description: '',
    },
    columns: [
      { id: 'name', label: 'Name', kind: 'identity', field: 'Name', uuidField: 'SupportTeamUUID' },
      { id: 'code', label: 'Code', field: 'Code' },
      { id: 'members', label: 'Members', field: 'MembersCount' },
      { id: 'default', label: 'Default', kind: 'boolean', field: 'IsDefault' },
      { id: 'status', label: 'Status', kind: 'status', field: 'Status' },
    ],
    fields: [
      { key: 'status', source: 'Status', type: 'status', label: 'Status', span: 1 },
      {
        key: 'isDefault',
        source: 'IsDefault',
        type: 'search-select',
        options: yesNo,
        translateOptions: true,
        label: 'Default team',
        span: 1,
      },
      { key: 'name', source: 'Name', label: 'Name', required: true, span: 1 },
      { key: 'code', source: 'Code', label: 'Code', span: 1 },
      {
        key: 'queuePriority',
        source: 'QueuePriority',
        type: 'number',
        label: 'Queue priority',
        span: 1,
      },
      {
        key: 'maxConcurrentTickets',
        source: 'MaxConcurrentTickets',
        type: 'number',
        label: 'Maximum concurrent tickets',
        span: 1,
      },
      {
        key: 'description',
        source: 'Description',
        type: 'textarea',
        tab: 'notes',
        label: 'Description',
        span: 4,
        rows: 4,
      },
    ],
  });
}
@Component({
  selector: 'app-support-teams',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class SupportTeamsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config(supportDesk(inject(ActivatedRoute))));
  }
  protected override augmentPayload(payload: ConfigurableCrudRecord) {
    return {
      ...payload,
      status: Number(payload['status']),
      isDefault: Number(payload['isDefault']),
      queuePriority: Number(payload['queuePriority']),
      maxConcurrentTickets: Number(payload['maxConcurrentTickets']),
    };
  }
}

function membersConfig(desk: SupportDesk, team: ConfigurableCrudRecord): ConfigurableCrudConfig {
  const roles: readonly ConfigurableCrudOption[] = [
    { value: 'member', label: 'Member' },
    { value: 'supervisor', label: 'Supervisor' },
    { value: 'manager', label: 'Manager' },
  ];
  return defineCrud({
    endpoint: `${supportBase(desk)}/teams/${team['SupportTeamUUID']}/members`,
    uuidField: 'SupportTeamMemberUUID',
    serverSidePagination: true,
    pageTitle: 'Team members',
    pageDescription: String(team['Name'] ?? ''),
    createTitle: 'Add team member',
    editTitle: 'Edit team member',
    emptyLabel: 'No team members found.',
    savedMessage: 'Team member saved.',
    deletedMessage: 'Team member removed.',
    searchPlaceholder: 'Search',
    statusMode: 'number',
    activeValue: 1,
    inactiveValue: 0,
    bulkDelete: false,
    initialValues: {
      memberUserUUID: '',
      role: 'member',
      status: 1,
      isPrimary: 0,
      canAssign: 0,
      canClose: 0,
    },
    fields: [
      { key: 'status', source: 'Status', label: 'Status', type: 'status', span: 1 },
      {
        key: 'memberUserUUID',
        source: 'MemberUserUUID',
        label: 'User',
        type: 'search-select',
        required: true,
        span: 1,
        remoteLookup: {
          endpoint: `${supportBase(desk)}/agents`,
          uuidField: 'UserUUID',
          labelField: 'Name',
        },
        quickCreate: false,
        quickCreateExemptReason:
          'Team membership selects an existing authorized agent. Account creation and permission grants require separate identity administration.',
        disabledWhen: ({ editing }) => editing,
      },
      {
        key: 'role',
        source: 'Role',
        label: 'Role',
        type: 'search-select',
        options: roles,
        translateOptions: true,
        span: 1,
      },
      ...(
        [
          { key: 'isPrimary', source: 'IsPrimary', label: 'Primary' },
          { key: 'canAssign', source: 'CanAssign', label: 'Can assign' },
          { key: 'canClose', source: 'CanClose', label: 'Can close' },
        ] as const
      ).map((f) => ({
        ...f,
        type: 'search-select' as const,
        options: YES_NO_OPTIONS,
        translateOptions: true,
        span: 1 as const,
      })),
    ],
    columns: [
      { id: 'name', field: 'MemberName', label: 'Name', kind: 'identity' },
      { id: 'email', field: 'MemberEmail', label: 'Email' },
      { id: 'role', field: 'Role', label: 'Role', options: roles, translateValue: true },
      { id: 'status', field: 'Status', label: 'Status', kind: 'status' },
    ],
    payload: (v) => ({
      ...v,
      status: Number(v['status']),
      isPrimary: Number(v['isPrimary']),
      canAssign: Number(v['canAssign']),
      canClose: Number(v['canClose']),
    }),
  });
}
