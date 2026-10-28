import { CONVERSATIONS_ACCOUNTS_CONFIG } from './accounts';

describe('ConversationsAccountsConfig', () => {
  it('defines the correct endpoint and key attributes for conversation accounts', () => {
    expect(CONVERSATIONS_ACCOUNTS_CONFIG.endpoint).toBe('conversations/accounts');
    expect(CONVERSATIONS_ACCOUNTS_CONFIG.uuidField).toBe('CvaUUID');
    expect(CONVERSATIONS_ACCOUNTS_CONFIG.pageTitle).toBe('conversations.accounts');
    expect(CONVERSATIONS_ACCOUNTS_CONFIG.serverSidePagination).toBe(true);
    expect(CONVERSATIONS_ACCOUNTS_CONFIG.bulkDelete).toBe(false);
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
});
