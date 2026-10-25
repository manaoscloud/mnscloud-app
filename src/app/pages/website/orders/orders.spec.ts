import { WEBSITE_ORDER_STATUS_OPTIONS } from './orders';

describe('Website orders', () => {
  it('lists every order status the API returns', () => {
    expect(WEBSITE_ORDER_STATUS_OPTIONS.map((o) => o.value)).toEqual([
      'awaiting_approval',
      'awaiting_payment',
      'paid',
      'provisioning',
      'active',
      'failed',
      'cancelled',
      'expired',
    ]);
  });
});
