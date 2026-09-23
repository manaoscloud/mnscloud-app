import { test } from 'node:test';
import { equal } from 'node:assert/strict';
import { payErrorMessage } from '../src/app/shared/payment/pay-error.ts';

test('Pay codes select safe translation keys, including 402 credit errors', () => {
  equal(payErrorMessage({ status: 402, error: { code: 'PAY_INSUFFICIENT_CREDIT', error: 'internal diagnostic' } }), 'Insufficient prepaid credit.');
  equal(payErrorMessage({ error: { code: 'PAY_UNKNOWN', error: 'untrusted message' } }), 'Pay request could not be completed.');
  equal(payErrorMessage({ error: { code: 'COMMERCIAL_ENTITLEMENT_REQUIRED' } }), null);
});
