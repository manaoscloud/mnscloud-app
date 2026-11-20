import { NavItem } from '../../../layout/navigation/nav-registry';
import {
  SUPPORT_MODULE_NONE,
  supportModuleFilterOptions,
  supportModuleForRoute,
  supportModuleLabel,
  supportModuleOptions,
} from './support-modules';

describe('Support ticket modules', () => {
  const items: NavItem[] = [
    {
      id: 'voip',
      label: 'nav.voip',
      entitlementCode: 'module.voip.*',
      children: [
        { id: 'voip/pabx', label: 'nav.voip.pabx', route: '/voip/pabx' },
        {
          id: 'voip/did',
          label: 'nav.voip.did',
          route: '/voip/pabx/did',
          entitlementCode: 'module.hosting.*',
        },
      ],
    },
    { id: 'dashboard', label: 'nav.dashboard', route: '/dashboard' },
  ];
  const translate = (key: string) =>
    ({
      'commercial.module.voip': 'VoIP',
      'commercial.module.hr': 'Recursos humanos',
      General: 'Geral',
    })[key] ?? key;

  it('finds the module of the deepest menu entry of a route', () => {
    expect(supportModuleForRoute('/voip/pabx/accounts?x=1', items)).toBe('voip');
    expect(supportModuleForRoute('/voip/pabx/did/123', items)).toBe('hosting');
    expect(supportModuleForRoute('/voip/pabxes', items)).toBeNull();
    expect(supportModuleForRoute('/dashboard', items)).toBeNull();
  });

  it('labels modules from the commercial catalog keys, falling back to the code', () => {
    expect(supportModuleLabel('voip', translate)).toBe('VoIP');
    expect(supportModuleLabel('stock', translate)).toBe('stock');
    expect(supportModuleLabel(null, translate)).toBe('');
    expect(supportModuleOptions(['voip', 'hr'], translate).map((o) => o.value)).toEqual([
      'hr',
      'voip',
    ]);
    expect(supportModuleFilterOptions(['voip'], translate)[0]).toEqual({
      value: SUPPORT_MODULE_NONE,
      label: 'Geral',
    });
  });
});
