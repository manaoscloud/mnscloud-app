import { websiteInboxPayload } from './leads';

describe('websiteInboxPayload', () => {
  it('sends only revision, status and notes', () => {
    expect(
      websiteInboxPayload({ revision: '4', status: ' closed ', notes: ' ok ', other: 1 }),
    ).toEqual({ revision: 4, status: 'closed', notes: 'ok' });
  });
});
