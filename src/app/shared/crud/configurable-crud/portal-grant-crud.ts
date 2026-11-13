import { ConfigurableCrudOption } from './configurable-crud-page-base';
import { defineCrud } from './define-crud';
import { revisionDeletePayloads } from './revision-delete';
import { LOCATION_SCOPE_COLUMN, LOCATION_SCOPE_FIELD } from './location-scope';

/** Translation keys of one module's Customer Portal access dialog. */
export interface PortalGrantLabels {
  pageTitle: string;
  pageDescription: string;
  createTitle: string;
  editTitle: string;
  emptyLabel: string;
  portalUser: string;
  portalRole: string;
  roleOwner: string;
  roleAdmin: string;
  roleUser: string;
}

export interface PortalGrantCrudOptions {
  /** API base of the account, for example `hr/accounts/<uuid>`. */
  base: string;
  uuidField: string;
  statusField: string;
  revisionField: string;
  labels: PortalGrantLabels;
  /** Grant columns (0/1) and their labels, in display order. */
  grants: readonly (readonly [string, string])[];
  initialValues: Record<string, unknown>;
  /** Adds the optional location scope of the grant (HR accounts). */
  locationScope?: boolean;
}

const YES_NO: readonly ConfigurableCrudOption[] = [
  { value: 0, label: 'No' },
  { value: 1, label: 'Yes' },
];

/**
 * Customer Portal users of a resale account's customer and the operations granted to each one
 * (`<base>/portal-grants`, lookup `<base>/portal-users`). Shared by the module account pages.
 */
export function portalGrantCrud(options: PortalGrantCrudOptions) {
  const { base, labels, grants } = options;
  const roles = [
    { value: 'CUSTOMER_OWNER', label: labels.roleOwner },
    { value: 'CUSTOMER_ADMIN', label: labels.roleAdmin },
    { value: 'CUSTOMER_USER', label: labels.roleUser },
  ];
  return defineCrud({
    endpoint: `${base}/portal-grants`,
    uuidField: options.uuidField,
    pageTitle: labels.pageTitle,
    pageDescription: labels.pageDescription,
    createTitle: labels.createTitle,
    editTitle: labels.editTitle,
    emptyLabel: labels.emptyLabel,
    bulkDelete: false,
    ...revisionDeletePayloads(options.uuidField, options.revisionField),
    initialValues: {
      RegCustomerUserRcsUUID: '',
      ...options.initialValues,
      ...(options.locationScope ? { locationUUIDs: [] } : {}),
      status: 1,
    },
    fields: [
      { key: 'status', source: options.statusField, label: 'Status', type: 'status', span: 1 },
      {
        key: 'RegCustomerUserRcsUUID',
        source: 'RegCustomerUserRcsUUID',
        label: labels.portalUser,
        type: 'search-select',
        required: true,
        span: 1,
        disabledWhen: ({ editing }) => editing,
        remoteLookup: {
          endpoint: `${base}/portal-users`,
          uuidField: 'RcsUUID',
          labelField: 'RcsUsername',
          descriptionField: 'RcsRole',
          selectedLabelField: 'PortalUsername',
        },
        quickCreate: false,
        quickCreateExemptReason:
          'Portal users are the customer logins managed in Registry > Customers.',
      },
      ...grants.map(([key, label]) => ({
        key,
        source: key,
        label,
        type: 'select' as const,
        span: 1 as const,
        options: YES_NO,
      })),
      ...(options.locationScope ? [LOCATION_SCOPE_FIELD] : []),
      {
        key: 'revision',
        source: options.revisionField,
        label: 'documents.revision',
        hiddenWhen: () => true,
      },
    ],
    columns: [
      { id: 'user', field: 'PortalUsername', label: labels.portalUser, kind: 'identity' },
      { id: 'role', field: 'PortalRole', label: labels.portalRole, options: roles },
      ...grants.map(([field, label]) => ({
        id: field,
        field,
        label,
        kind: 'boolean' as const,
      })),
      ...(options.locationScope ? [LOCATION_SCOPE_COLUMN] : []),
      { id: 'status', field: options.statusField, label: 'Status', kind: 'status' },
    ],
  });
}
