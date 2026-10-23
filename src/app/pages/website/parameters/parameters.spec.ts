import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { ApiService } from '../../../services/api.service';
import { AppI18nService } from '../../../services/app-i18n.service';
import { WebsiteParametersPage, websiteParameterForm, websiteParameterPayload } from './parameters';

describe('WebsiteParametersPage', () => {
  let fixture: ComponentFixture<WebsiteParametersPage>;
  let page: WebsiteParametersPage;
  let get: jasmine.Spy;
  let put: jasmine.Spy;

  beforeEach(async () => {
    get = jasmine.createSpy('get').and.callFake(async (endpoint: string) =>
      endpoint.includes('dns-policies')
        ? { data: { items: [], total: 0 } }
        : {
            data: {
              item: {
                autoDomainEnabled: true,
                autoDomainDnsMode: 'identity_only',
                autoDomainBase: 'site.example.com',
                autoDomainUuidLength: 12,
                edgeIPv4: '203.0.113.10',
                defaultLocale: 'pt-BR',
              },
            },
          },
    );
    put = jasmine.createSpy('put').and.callFake(async (_endpoint: string, body: unknown) => ({
      data: { item: body },
    }));
    TestBed.configureTestingModule({
      imports: [
        WebsiteParametersPage,
        TranslocoTestingModule.forRoot({
          langs: { en: {} },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
      providers: [
        { provide: ApiService, useValue: { get, put } },
        { provide: AppI18nService, useValue: { availableLanguages: [], language: signal('en') } },
      ],
    }).overrideComponent(WebsiteParametersPage, { set: { template: '' } });
    fixture = TestBed.createComponent(WebsiteParametersPage);
    page = fixture.componentInstance;
    TestBed.tick();
    await fixture.whenStable();
    TestBed.tick();
  });

  it('reads the platform parameters', () => {
    expect(get.calls.allArgs().map((args) => args[0])).toContain('system/website/parameters');
    expect(page.form().autoDomainBase).toBe('site.example.com');
    expect(page.hasChanges()).toBeFalse();
  });

  it('accepts the edge IPv6 alone in managed DNS', () => {
    page.update({
      autoDomainDnsMode: 'managed_dns',
      edgeIPv4: '',
      edgeIPv6: '2001:db8::1',
      dnsPolicyUUID: 'p1',
    });
    expect(page.rules.check()).toBeTrue();
  });

  it('requires a DNS policy and an edge address in managed DNS', async () => {
    page.update({ autoDomainDnsMode: 'managed_dns', edgeIPv4: '' });
    await page.save();
    expect(put).not.toHaveBeenCalled();
    expect(page.invalid('dnsPolicyUUID')).toBeTrue();
    expect(page.invalid('edgeIPv4')).toBeTrue();
  });

  it('saves the base only in identity-only mode', async () => {
    page.update({ autoDomainBase: ' Site.Example.COM. ', edgeIPv6: '2001:DB8::10' });
    await page.save();
    expect(put).toHaveBeenCalledWith('system/website/parameters', {
      autoDomainEnabled: true,
      autoDomainDnsMode: 'identity_only',
      autoDomainBase: 'site.example.com',
      autoDomainUuidLength: 12,
      dnsPolicyUUID: null,
      edgeIPv4: '203.0.113.10',
      edgeIPv6: '2001:db8::10',
      defaultLocale: 'pt-BR',
    });
  });

  it('normalizes the stored item and the managed payload', () => {
    const form = websiteParameterForm({ autoDomainDnsMode: 'managed_dns', dnsPolicyUUID: 'p1' });
    expect(form.defaultLocale).toBe('pt-BR');
    const payload = websiteParameterPayload({ ...form, autoDomainBase: 'ignored.example.com' });
    expect(payload['autoDomainBase']).toBeNull();
    expect(payload['dnsPolicyUUID']).toBe('p1');
  });
});
