import { SECRET_NAME_PATTERN, secretPayload } from './secrets';

describe('secretPayload', () => {
  it('upper-cases the name and sends the revision only when editing', () => {
    expect(secretPayload({ name: ' crm_token ', description: ' x ', value: 'v' }, false)).toEqual({
      name: 'CRM_TOKEN',
      description: 'x',
      value: 'v',
    });
    expect(secretPayload({ name: 'A_B', revision: '3', value: '' }, true)).toEqual({
      revision: 3,
      description: '',
    });
  });

  it('never sends an empty value, so editing keeps the stored secret', () => {
    expect('value' in secretPayload({ name: 'A_B', value: '' }, true)).toBeFalse();
  });

  it('accepts the secret name format of the API only', () => {
    expect(SECRET_NAME_PATTERN.test('CRM_TOKEN_2')).toBeTrue();
    expect(SECRET_NAME_PATTERN.test('crm')).toBeFalse();
    expect(SECRET_NAME_PATTERN.test('1ABC')).toBeFalse();
    expect(SECRET_NAME_PATTERN.test('A')).toBeFalse();
  });
});
