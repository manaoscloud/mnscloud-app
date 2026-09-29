import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { SettingsParametersPage } from './parameters';
import { ApiService } from '../../../services/api.service';
import { AppI18nService } from '../../../services/app-i18n.service';

describe('Realm SIP domain selection', () => {
  let page: SettingsParametersPage;
  let get: jasmine.Spy;
  beforeEach(async () => {
    get = jasmine.createSpy().and.resolveTo({ data: { items: [], total: 0 } });
    await TestBed.configureTestingModule({
      imports: [
        SettingsParametersPage,
        TranslocoTestingModule.forRoot({
          langs: { en: { Unavailable: 'Unavailable', 'SIP realm base': 'SIP realm base' } },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { data: { scope: 'master' } } } },
        { provide: ApiService, useValue: { get } },
        { provide: AppI18nService, useValue: { availableLanguages: [], language: signal('en') } },
      ],
    })
      .overrideComponent(SettingsParametersPage, { set: { template: '' } })
      .compileComponents();
    page = TestBed.createComponent(SettingsParametersPage).componentInstance;
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
  });
  it('keeps an eligible saved selection outside the current page', () => {
    page.item.update((v) => ({
      ...v,
      voipPabxRealmSource: 'own',
      voipPabxAutoDomainDnsMode: 'managed_dns',
      voipPabxDnsPolicyUUID: 'saved',
      voipPabxDnsPolicyEligible: true,
      voipPabxDnsPolicyZoneName: 'example.com',
      voipPabxDnsPolicyBase: 'sip.example.com',
    }));
    page.dnsPolicies.set([]);
    expect(page.selectedPolicyInvalid()).toBeFalse();
    expect(page.dnsPolicyOptions()[0].label).toContain('sip.example.com');
    expect(page.dnsPolicyOptions()[0].label).not.toContain('Unavailable');
  });
  it('requests subsequent pages from the server', async () => {
    get.and.resolveTo({
      data: {
        items: [{ policyUUID: 'p51', base: 'sip.example.com', status: true, eligible: true }],
        total: 70,
      },
    });
    page.dnsOffset.set(50);
    await page.loadDnsPolicies();
    expect(get.calls.mostRecent().args[0]).toContain('offset=50');
    expect(page.dnsTotal()).toBe(70);
    expect(page.dnsPolicies()[0].policyUUID).toBe('p51');
  });
  it('does not apply a stale response after a newer request', async () => {
    let resolveOld!: (value: unknown) => void;
    get.and.returnValue(new Promise((resolve) => (resolveOld = resolve)));
    const old = page.loadDnsPolicies();
    get.and.resolveTo({
      data: { items: [{ policyUUID: 'new', base: 'sip.example.com', status: true }], total: 1 },
    });
    await page.loadDnsPolicies();
    resolveOld({ data: { items: [], total: 0 } });
    await old;
    expect(page.dnsPolicies()[0].policyUUID).toBe('new');
  });
  it('omits a stale policy when saving identity-only configuration', () => {
    const value = {
      ...page.item(),
      voipPabxAutoDomainDnsMode: 'identity_only' as const,
      voipPabxRealmSource: 'own' as const,
      voipPabxDnsPolicyUUID: 'old',
      voipPabxAutoDomainBase: 'manual.example.com',
    };
    const payload = (page as any).normalizeForSave(value);
    expect(payload.voipPabxDnsPolicyUUID).toBe('');
    expect(payload.voipPabxAutoDomainBase).toBe('manual.example.com');
  });
});
