import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';

const MIGRATION_NODE_STATES: readonly ConfigurableCrudOption[] = [
  { value: 'current', label: 'Current node' },
  { value: 'eligible', label: 'Can receive' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'offline', label: 'Offline' },
];

const MIGRATION_MODES: readonly ConfigurableCrudOption[] = [
  { value: 'live', label: 'Live (no stop)' },
  { value: 'offline', label: 'Offline (server stopped)' },
];

/**
 * Nodes a Proxmox server can migrate to (master, API PL5): one row per node with the reason when
 * it cannot, the recommended node and the estimate. The migration copies the disk and runs in the
 * background; a running server migrates live, without a stop.
 */
function instanceMigration(instanceUUID: string): ConfigurableCrudConfig {
  const endpoint = `system/hosting/vps/instances/${instanceUUID}/migration`;
  return defineCrud({
    endpoint,
    uuidField: 'key',
    pageTitle: 'Migrate server',
    pageDescription:
      'Move the server to another node. The disk is copied over the network; a running server keeps running. One migration at a time in the cluster.',
    canCreate: false,
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    statusMode: 'string',
    columns: [
      { id: 'node', label: 'Node', field: 'node' },
      {
        id: 'state',
        label: 'Status',
        field: 'state',
        kind: 'status',
        options: MIGRATION_NODE_STATES,
        chipClass: (value) =>
          value === 'eligible'
            ? 'chip-success'
            : value === 'current'
              ? 'chip-running'
              : 'chip-warning',
      },
      {
        id: 'recommended',
        label: 'Recommended',
        field: 'recommended',
        value: (row, translate) => (row['recommended'] === true ? translate('Yes') : ''),
      },
      { id: 'mode', label: 'Mode', field: 'mode', kind: 'status', options: MIGRATION_MODES },
      { id: 'estimate', label: 'Estimate (min)', field: 'estimateMinutes', kind: 'number' },
      { id: 'freeMemory', label: 'Free memory (GB)', field: 'freeMemoryGb', kind: 'number' },
      { id: 'reasons', label: 'Why not', field: 'reasons', optional: true },
    ],
    fields: [],
    rowActions: [
      {
        key: 'migrateHere',
        label: 'Migrate to this node',
        icon: 'move_down',
        visible: (row) => row['state'] === 'eligible' && row['moving'] !== true,
        request: {
          method: 'post',
          endpoint: () => endpoint,
          body: (row) => ({ node: row['node'] }),
          successMessage: 'Migration started. It may take several minutes; Refresh to follow it.',
          confirm: {
            title: 'Migrate server',
            message:
              'Migrate the server to this node? The disk is copied over the network (see the estimate). A running server keeps running; a stopped one stays stopped.',
            confirmLabel: 'Migrate',
          },
        },
      },
    ],
  });
}

export const MIGRATE_INSTANCE_ACTION: ConfigurableCrudRowAction = {
  key: 'migrate',
  label: 'Migrate',
  icon: 'move_down',
  tooltip: 'Migrate to another node',
  collection: (row) => instanceMigration(String(row['HviUUID'] ?? '')),
};
