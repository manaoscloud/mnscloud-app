import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { RouteScopeService, routeScopeOf } from './route-scope';

@Component({ template: '' })
class BlankPage {}

describe('route scope', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([
          {
            path: 'system',
            data: { scope: 'master' },
            children: [{ path: 'monitoring/agents', component: BlankPage }],
          },
          { path: 'monitoring/agents', component: BlankPage },
          { path: 'support/platform/tickets', component: BlankPage, data: { scope: 'master' } },
        ]),
      ],
    });
  });

  async function at(url: string) {
    await TestBed.inject(Router).navigateByUrl(url);
    return TestBed.inject(RouteScopeService);
  }

  it('reads the scope the route tree declares, inherited from the system parent', async () => {
    const scope = await at('/system/monitoring/agents');
    expect(scope.current()).toBe('master');
    expect(scope.isSystemTree()).toBeTrue();
  });

  it('treats undeclared routes as tenant routes', async () => {
    const scope = await at('/monitoring/agents');
    expect(scope.current()).toBe('tenant');
    expect(scope.isSystemTree()).toBeFalse();
  });

  it('keeps master pages outside /system out of the system tree (they keep the tenant header)', async () => {
    const scope = await at('/support/platform/tickets');
    expect(scope.current()).toBe('master');
    expect(scope.isSystemTree()).toBeFalse();
  });

  it('defaults to tenant without a snapshot', () => {
    expect(routeScopeOf(null)).toBe('tenant');
    expect(routeScopeOf(TestBed.inject(ActivatedRoute).snapshot)).toBe('tenant');
  });
});
