import { supportTicketsConfig } from './tickets';
import { ACTIVE_TICKET_STATUSES, TICKET_STATUS_FILTER_OPTIONS } from '../shared/support-desk';

describe('Support tickets page configuration', () => {
  const dummyApi = () => ({} as any);
  const dummyDialog = () => ({} as any);

  it('defaults to active tickets status filter', () => {
    const config = supportTicketsConfig('tenant', dummyApi, dummyDialog);
    expect(config.initialStatus).toBe('active');
    expect(config.activeStatusValues).toEqual(ACTIVE_TICKET_STATUSES);
    expect(config.statusFilterOptions).toEqual(TICKET_STATUS_FILTER_OPTIONS);
    expect(config.statusFilterOptions?.[0].value).toBe('active');
  });

  it('orders columns with Protocol, OpenedAt, and Status consecutively at the start', () => {
    const config = supportTicketsConfig('tenant', dummyApi, dummyDialog);
    const columns = config.columns;
    expect(columns[0].id).toBe('protocol');
    expect(columns[0].field).toBe('SupportTicketID');

    expect(columns[1].id).toBe('openedAt');
    expect(columns[1].field).toBe('OpenedAt');
    expect(columns[1].kind).toBe('datetime');

    expect(columns[2].id).toBe('status');
    expect(columns[2].field).toBe('Status');
    expect(columns[2].kind).toBe('status');
  });
});
