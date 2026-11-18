import { moduleFamily, moduleTags } from './release-notes';

describe('release notes module family', () => {
  it('groups sub-modules under their module', () => {
    expect(moduleFamily('module.hosting')).toBe('module.hosting');
    expect(moduleFamily('module.hosting.vps.firewall')).toBe('module.hosting');
    expect(moduleFamily('module.voip.phone.user')).toBe('module.voip');
    expect(moduleFamily('platform')).toBe('platform');
  });
});

describe('release notes module tags', () => {
  it('shows each tag once and drops the bare family next to its sub-module', () => {
    expect(moduleTags(['Hospedagem › VPS', 'Hospedagem', 'Hospedagem › VPS'])).toEqual([
      'Hospedagem › VPS',
    ]);
    expect(moduleTags(['Hospedagem', 'Hospedagem'])).toEqual(['Hospedagem']);
    expect(moduleTags(['VoIP › PABX', 'DNS'])).toEqual(['VoIP › PABX', 'DNS']);
  });
});
