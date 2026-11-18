import type { CanActivateFn } from '@angular/router';
import {
  cyberSecurityDelegatedRoutes,
  cyberSecurityRouteData,
  cyberSecuritySectionRoutes,
} from './cyber-security-navigation';

describe('Cyber Security navigation scopes', () => {
  it('keeps the tenant and System area routes', () => {
    expect(cyberSecuritySectionRoutes('tenant').map((r) => r.path)).toContain(
      'cyber-security/patches',
    );
    const master = cyberSecuritySectionRoutes('master').map((r) => r.path);
    expect(master).toContain('cyber-security/vulnerabilities');
    expect(master).not.toContain('cyber-security/patches');
    expect(cyberSecurityRouteData('servers', 'master').scope).toBe('master');
    expect(cyberSecurityRouteData('servers', 'tenant').scope).toBe('tenant');
  });

  it('serves the delegated platform pages behind the guard, without secrets', () => {
    const guard: CanActivateFn = () => true;
    const routes = cyberSecurityDelegatedRoutes(guard);
    const paths = routes.map((r) => r.path);
    expect(paths).toContain('cyber-security/platform');
    expect(paths).toContain('cyber-security/platform/vulnerabilities');
    expect(paths).toContain('cyber-security/platform/network-policies');
    expect(paths.some((p) => String(p).includes('secret'))).toBeFalse();
    expect(paths.some((p) => String(p).includes('patches'))).toBeFalse();
    for (const route of routes) {
      expect(route.canActivate).toEqual([guard]);
      expect(route.data?.['scope']).toBe('master');
      expect(route.data?.['apiScope']).toBe('platform');
      expect(route.data?.['cyberBase']).toBe('/cyber-security/platform');
    }
  });
});
