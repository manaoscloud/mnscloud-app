import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';
import { revisionDeletePayloads } from '../../../../shared/crud/configurable-crud/revision-delete';
import type {
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';

const flags = [
  ['emails', 'HwgEmails', 'webhostResale.emails'],
  ['databases', 'HwgDatabases', 'webhostResale.databases'],
  ['dns', 'HwgDns', 'webhostResale.dns'],
] as const;
const yesNo = [
  { value: 0, label: 'No' },
  { value: 1, label: 'Yes' },
];

/** Shared CRUD form and collection surfaces; all authorization is enforced by the API. */
export function webhostResaleActions(row: ConfigurableCrudRecord): ConfigurableCrudRowAction[] {
  const base = `hosting/webhost/hosts/${row['HwhUUID']}`;
  return [
    {
      key: 'portal',
      label: 'webhostResale.publication',
      icon: 'public',
      form: () =>
        defineCrud({
          endpoint: `${base}/portal`,
          uuidField: 'HwhUUID',
          pageTitle: 'webhostResale.publication',
          pageDescription: 'webhostResale.publicationDescription',
          initialValues: { enabled: row['HwhPortalEnabled'], revision: row['HwhRevision'] },
          fields: [
            {
              key: 'enabled',
              label: 'webhostResale.enabled',
              type: 'select',
              options: yesNo,
              span: 1,
            },
            { key: 'revision', label: 'documents.revision', hiddenWhen: () => true },
          ],
          columns: [],
        }),
    },
    {
      key: 'portal-grants',
      label: 'webhostResale.access',
      icon: 'manage_accounts',
      collection: () =>
        defineCrud({
          endpoint: `${base}/portal-grants`,
          uuidField: 'HwgUUID',
          pageTitle: 'webhostResale.access',
          pageDescription: 'webhostResale.accessDescription',
          serverSidePagination: true,
          // Grants are reviewed individually; each removal requires its current revision.
          bulkDelete: false,
          ...revisionDeletePayloads('HwgUUID', 'HwgRevision'),
          initialValues: { portalUserUUID: '', emails: 0, databases: 0, dns: 0, status: 1 },
          fields: [
            { key: 'status', source: 'HwgStatus', label: 'Status', type: 'status', span: 1 },
            {
              key: 'portalUserUUID',
              source: 'RegCustomerUserRcsUUID',
              label: 'webhostResale.user',
              type: 'search-select',
              required: true,
              span: 1,
              disabledWhen: ({ editing }) => editing,
              remoteLookup: {
                endpoint: `${base}/portal-users`,
                uuidField: 'RcsUUID',
                labelField: 'RcsUsername',
                selectedLabelField: 'PortalUsername',
              },
              quickCreate: false,
              quickCreateExemptReason:
                'Customer login identities are managed in Registry > Customers.',
            },
            ...flags.map(([key, source, label]) => ({
              key,
              source,
              label,
              type: 'select' as const,
              span: 1 as const,
              options: yesNo,
            })),
            {
              key: 'revision',
              source: 'HwgRevision',
              label: 'documents.revision',
              hiddenWhen: () => true,
            },
          ],
          columns: [
            { id: 'user', field: 'PortalUsername', label: 'webhostResale.user', kind: 'identity' },
            ...flags.map(([id, field, label]) => ({ id, field, label, kind: 'boolean' as const })),
            { id: 'status', field: 'HwgStatus', label: 'Status', kind: 'status' },
          ],
        }),
    },
  ];
}
