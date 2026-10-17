import { attachmentSettingsChanged, toPercent } from './ai-settings';

describe('support AI settings helpers', () => {
  it('shows the stored 0-1 confidence as a whole percent', () => {
    expect(toPercent('0.800', 50)).toBe(80);
    expect(toPercent(0.725, 50)).toBe(73);
    expect(toPercent(null, 70)).toBe(0);
    expect(toPercent('not a number', 70)).toBe(70);
  });

  it('saves the attachment settings only when one of them changed', () => {
    const saved = {
      enabled: '1',
      autoReplyPercent: 80,
      bugPercent: 70,
      maxAutoReplies: 2,
      maxTriagesPerHour: 60,
      includeDiagnostics: '1',
      emailPromptToTeam: '1',
      bugReplyMessage: 'x',
      includeImages: '1',
      includeDocuments: '1',
      includeTextFiles: '1',
      maxAttachments: 4,
      maxTriagesPerRequesterHour: 10,
    };
    expect(attachmentSettingsChanged({ ...saved, bugPercent: 90 }, saved)).toBeFalse();
    expect(attachmentSettingsChanged({ ...saved, includeImages: '0' }, saved)).toBeTrue();
    expect(attachmentSettingsChanged({ ...saved, maxAttachments: 2 }, saved)).toBeTrue();
  });
});
