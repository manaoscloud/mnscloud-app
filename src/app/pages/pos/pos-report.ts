/** Shared parts of the read-only POS history pages (records written only by the POS itself). */
export const POS_READ_ONLY = {
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
} as const;

/** List filter by register, answered by the terminals of the page's commerce account. */
export const POS_TERMINAL_FILTER = {
  key: 'terminalUUID',
  label: 'Terminal',
  paramKey: 'terminalUUID',
  type: 'search-select',
  span: 1,
  remoteLookup: { endpoint: 'pos/terminals', uuidField: 'PtmUUID', labelField: 'PtmName' },
} as const;
