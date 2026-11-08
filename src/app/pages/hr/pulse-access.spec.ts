import { credentialEmailNote } from './time-clock-accounts/time-clock-accounts';

describe('Pulse access credentials dialog', () => {
  it('says the access was e-mailed when the API sent it', () => {
    expect(credentialEmailNote({ EmailDelivery: 'sent', EmailRecipient: 'a@example.com' })).toContain(
      'e-mailed to the employee',
    );
  });

  it('asks to hand the credentials over when the employee has no e-mail', () => {
    expect(credentialEmailNote({ EmailDelivery: 'no_email' })).toContain('has no e-mail');
  });

  it('reports a failed delivery', () => {
    expect(credentialEmailNote({ EmailDelivery: 'failed' })).toContain('could not be sent');
  });

  it('keeps the previous text for skipped or older responses', () => {
    expect(credentialEmailNote({})).toBe(
      'Show these credentials to the employee securely. The password is not stored here.',
    );
  });
});
