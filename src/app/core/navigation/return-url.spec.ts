import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { safeReturnUrl, signinUrlTree } from './return-url';

describe('return url', () => {
  it('accepts App paths with query strings', () => {
    expect(safeReturnUrl('/support/requests?ticket=1A217AE0219448048EE025FC6BECDEFB')).toBe(
      '/support/requests?ticket=1A217AE0219448048EE025FC6BECDEFB',
    );
    expect(safeReturnUrl('/system/hosting')).toBe('/system/hosting');
  });

  it('rejects anything that could leave the App or loop on sign-in', () => {
    for (const value of [
      null,
      '',
      'https://evil.example/x',
      '//evil.example/x',
      '/\\evil.example',
      'support/requests',
      '/javascript:alert(1)',
      '/signin',
      '/signin?returnUrl=/x',
      '/support\n/requests',
      '/' + 'a'.repeat(2001),
    ]) {
      expect(safeReturnUrl(value)).withContext(String(value)).toBeNull();
    }
  });

  it('builds the sign-in tree with the return url only when safe', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    });
    const router = TestBed.inject(Router);
    expect(router.serializeUrl(signinUrlTree(router, '/support/requests?ticket=AB'))).toBe(
      '/signin?returnUrl=%2Fsupport%2Frequests%3Fticket%3DAB',
    );
    expect(router.serializeUrl(signinUrlTree(router, '//evil.example'))).toBe('/signin');
  });
});
