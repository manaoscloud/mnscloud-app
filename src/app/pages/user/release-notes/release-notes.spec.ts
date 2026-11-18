import { moduleFamily } from './release-notes';

describe('release notes module family', () => {
  it('groups sub-modules under their module', () => {
    expect(moduleFamily('module.hosting')).toBe('module.hosting');
    expect(moduleFamily('module.hosting.vps.firewall')).toBe('module.hosting');
    expect(moduleFamily('module.voip.phone.user')).toBe('module.voip');
    expect(moduleFamily('platform')).toBe('platform');
  });
});
