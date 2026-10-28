import {
  CONVERSATIONS_ACCOUNTS_CONFIG,
  CONVERSATION_ACCOUNT_LOOKUP,
  buildAccountColumns,
  customerSelector,
  portalPublicationCrud,
  operatorAssignmentCrud,
} from './accounts';

describe('ConversationsAccountsConfig', () => {
  it('defines the correct endpoint and key attributes for conversation accounts', () => {
    expect(CONVERSATIONS_ACCOUNTS_CONFIG.endpoint).toBe('conversations/accounts');
    expect(CONVERSATIONS_ACCOUNTS_CONFIG.uuidField).toBe('CvaUUID');
    expect(CONVERSATIONS_ACCOUNTS_CONFIG.pageTitle).toBe('conversations.accounts');
    expect(CONVERSATIONS_ACCOUNTS_CONFIG.pageDescription).toBe('conversations.accountsDescription');
    expect(CONVERSATIONS_ACCOUNTS_CONFIG.createTitle).toBe('conversations.newAccount');
    expect(CONVERSATIONS_ACCOUNTS_CONFIG.editTitle).toBe('conversations.editAccount');
    expect(CONVERSATIONS_ACCOUNTS_CONFIG.serverSidePagination).toBe(true);
    expect(CONVERSATIONS_ACCOUNTS_CONFIG.bulkDelete).toBe(false);
  });

  it('builds columns correctly via buildAccountColumns', () => {
    const cols = buildAccountColumns();
    expect(cols.length).toBe(6);
    expect(cols.map((c) => c.id)).toEqual([
      'name',
      'customer',
      'channels',
      'conversations',
      'publication',
      'status',
    ]);
  });

  it('contains the expected form fields including customer selector and status', () => {
    const keys = CONVERSATIONS_ACCOUNTS_CONFIG.fields.map((f) => f.key);
    expect(keys).toContain('name');
    expect(keys).toContain('status');
    expect(keys).toContain('RegCustomerRcuUUID');
    expect(keys).toContain('description');
    expect(keys).toContain('revision');
  });

  it('contains the required columns for data presentation', () => {
    const colIds = CONVERSATIONS_ACCOUNTS_CONFIG.columns.map((c) => c.id);
    expect(colIds).toContain('name');
    expect(colIds).toContain('customer');
    expect(colIds).toContain('channels');
    expect(colIds).toContain('conversations');
    expect(colIds).toContain('publication');
    expect(colIds).toContain('status');
  });

  it('has initial values for new accounts with status active', () => {
    expect(CONVERSATIONS_ACCOUNTS_CONFIG.initialValues).toEqual({
      name: '',
      description: '',
      RegCustomerRcuUUID: null,
      status: 1,
    });
  });

  it('provides the shared lookup descriptor for account selectors', () => {
    expect(CONVERSATION_ACCOUNT_LOOKUP.endpoint).toBe('conversations/accounts?status=1');
    expect(CONVERSATION_ACCOUNT_LOOKUP.uuidField).toBe('CvaUUID');
    expect(CONVERSATION_ACCOUNT_LOOKUP.labelField).toBe('CvaName');
    expect(CONVERSATION_ACCOUNT_LOOKUP.selectedLabelField).toBe('AccountName');
  });

  it('builds a customer selector disabled during edit', () => {
    const field = customerSelector();
    expect(field.key).toBe('RegCustomerRcuUUID');
    expect(field.type).toBe('search-select');
    expect(field.disabledWhen({ editing: true })).toBe(true);
    expect(field.disabledWhen({ editing: false })).toBe(false);
    expect(field.remoteLookup.endpoint).toBe('registry/customers?status=1');
    expect(field.remoteLookup.uuidField).toBe('CustomerUUID');
  });

  it('builds a portal publication CRUD sub-dialog configuration', () => {
    const pub = portalPublicationCrud('uuid-123', 1, 4);
    expect(pub.endpoint).toBe('conversations/accounts/uuid-123/portal');
    expect(pub.uuidField).toBe('CvaUUID');
    expect(pub.pageTitle).toBe('conversations.publication');
    expect(pub.initialValues).toEqual({ enabled: 1, revision: 4 });
    expect(pub.fields.length).toBe(2);
    expect(pub.fields[0].key).toBe('enabled');
    expect(pub.fields[1].key).toBe('revision');
  });

  it('builds operator assignment CRUD configuration with quick create exemption', () => {
    const op = operatorAssignmentCrud('uuid-456');
    expect(op.endpoint).toBe('conversations/accounts/uuid-456/members');
    expect(op.uuidField).toBe('CvaUUID');
    expect(op.pageTitle).toBe('conversations.assignOperator');
    expect(op.fields.length).toBe(2);
    expect(op.fields[0].key).toBe('UserUsrUUID');
    expect(op.fields[0].quickCreate).toBe(false);
    expect(op.fields[0].quickCreateExemptReason).toBeDefined();
    expect(op.fields[1].key).toBe('status');
  });
});
