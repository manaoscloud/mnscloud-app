import type {
  ConfigurableCrudConfig,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { quickCreateFor } from '../../shared/crud/configurable-crud/quick-create';

/** The canonical role-assignment collection; permissions stay on the reusable role. */
export function capacityAssignments(role: ConfigurableCrudRecord): ConfigurableCrudConfig {
  const endpoint = 'user/permissions/platform/role-assignments';
  return {
    endpoint,
    createEndpoint: endpoint,
    deleteEndpoint: endpoint,
    listQuery: { roleUUID: String(role['uuid']) },
    uuidField: 'uuid',
    pageTitle: 'capacityAccess.assignments',
    pageDescription: 'capacityAccess.assignmentDescription',
    createTitle: 'capacityAccess.assign',
    editTitle: 'capacityAccess.assign',
    dialogDescription: 'capacityAccess.assignmentDescription',
    searchPlaceholder: 'Name or e-mail',
    emptyLabel: 'capacityAccess.noAssignments',
    deleteTitle: 'capacityAccess.revoke',
    deleteMessage: 'capacityAccess.revokeConfirm',
    deleteSelectedTitle: 'capacityAccess.revoke',
    deleteSelectedMessage: 'capacityAccess.revokeConfirm',
    savedMessage: 'capacityAccess.assigned',
    deletedMessage: 'capacityAccess.revoked',
    deleteFailedMessage: 'capacityAccess.revokeFailed',
    canEdit: false,
    bulkDelete: false, // Canonical role revocation is individual and audited.
    canDeleteRow: (row) => Number(row['protected'] ?? 0) !== 1,
    serverSidePagination: true,
    statusFilter: true,
    statusMode: 'number',
    activeValue: 1,
    inactiveValue: 0,
    statusOptions: [
      { value: 1, label: 'Active' },
      { value: 0, label: 'Inactive' },
    ],
    initialValues: { userUUID: '', clusterUUIDs: [], providerUUIDs: [], reason: '' },
    tabLabels: { record: 'Record', notes: 'Notes' },
    fields: [
      {
        key: 'userUUID',
        label: 'User',
        type: 'search-select',
        required: true,
        remoteLookup: {
          endpoint: 'system/governance/users',
          uuidField: 'UserUUID',
          labelField: 'Email',
          descriptionField: 'FirstName',
        },
        quickCreate: false,
        quickCreateExemptReason:
          'Users are created through onboarding, not through permission assignment.',
      },
      {
        key: 'clusterUUIDs',
        label: 'capacityAccess.clusters',
        type: 'search-select',
        multiple: true,
        requiredWhen: ({ values }) =>
          !Array.isArray(values['providerUUIDs']) || !values['providerUUIDs'].length,
        remoteLookup: {
          endpoint: 'system/voip/clusters',
          uuidField: 'VclUUID',
          labelField: 'VclName',
        },
        quickCreate: quickCreateFor('VoipClusterVclUUID'),
        help: 'capacityAccess.scopeHelp',
      },
      {
        key: 'providerUUIDs',
        label: 'capacityAccess.providers',
        type: 'search-select',
        multiple: true,
        remoteLookup: {
          endpoint: 'system/hosting/vps/providers',
          uuidField: 'HvrUUID',
          labelField: 'HvrName',
        },
        quickCreate: quickCreateFor('HostingVpsProviderHvrUUID', {
          routeData: { scope: 'master' },
        }),
        help: 'capacityAccess.scopeHelp',
      },
      {
        key: 'reason',
        label: 'Reason',
        type: 'textarea',
        tab: 'notes',
        required: true,
        rows: 4,
        span: 4,
      },
    ],
    columns: [
      { id: 'user', field: 'userName', label: 'User', kind: 'identity', uuidField: 'userUUID' },
      { id: 'email', field: 'userEmail', label: 'E-mail' },
      { id: 'status', field: 'status', label: 'Status', kind: 'status' },
      { id: 'created', field: 'dateCreated', label: 'Created at', kind: 'datetime' },
    ],
    payload: (values) => ({
      userUUID: values['userUUID'],
      roleUUID: role['uuid'],
      environmentUUID: null,
      reason: values['reason'],
      conditions: {
        version: 1,
        ...(Array.isArray(values['clusterUUIDs']) && values['clusterUUIDs'].length
          ? { clusterUUIDs: values['clusterUUIDs'] }
          : {}),
        ...(Array.isArray(values['providerUUIDs']) && values['providerUUIDs'].length
          ? { providerUUIDs: values['providerUUIDs'] }
          : {}),
      },
    }),
  };
}
