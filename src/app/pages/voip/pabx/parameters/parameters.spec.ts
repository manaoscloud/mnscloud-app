import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { VoipPabxParametersPage } from './parameters';
import { VoipSoftswitchParametersPage } from '../../softswitch/parameters/parameters';
import { ApiService } from '../../../../services/api.service';
import { AppI18nService } from '../../../../services/app-i18n.service';

function setup<T>(component: new (...args: never[]) => T, scope: 'master' | 'tenant') {
  const get = jasmine
    .createSpy('get')
    .and.callFake(async (endpoint: string) =>
      endpoint.includes('dns-policies') || endpoint.includes('storage')
        ? { data: { items: [], total: 0 } }
        : { data: { item: {} } },
    );
  const put = jasmine.createSpy('put').and.resolveTo({ data: { item: {} } });
  TestBed.configureTestingModule({
    imports: [
      component,
      TranslocoTestingModule.forRoot({
        langs: { en: { Unavailable: 'Unavailable', 'SIP realm base': 'SIP realm base' } },
        translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        preloadLangs: true,
      }),
    ],
    providers: [
      { provide: ActivatedRoute, useValue: { snapshot: { data: { scope } } } },
      { provide: ApiService, useValue: { get, put } },
      { provide: AppI18nService, useValue: { availableLanguages: [], language: signal('en') } },
    ],
  }).overrideComponent(component as never, { set: { template: '' } });
  return { get, put };
}

async function settle(fixture: ComponentFixture<unknown>) {
  TestBed.tick();
  await fixture.whenStable();
  TestBed.tick();
}

describe('VoIP PABX parameters', () => {
  let page: VoipPabxParametersPage;
  let fixture: ComponentFixture<VoipPabxParametersPage>;
  let get: jasmine.Spy;
  let put: jasmine.Spy;

  beforeEach(async () => {
    ({ get, put } = setup(VoipPabxParametersPage, 'master'));
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(VoipPabxParametersPage);
    page = fixture.componentInstance;
    await settle(fixture);
  });

  it('reads the platform parameters of the module endpoint', () => {
    expect(get.calls.allArgs().map((args) => args[0])).toContain('system/voip/pabx/parameters');
  });

  it('keeps an eligible saved selection outside the current page', () => {
    page.update({ autoDomainDnsMode: 'managed_dns', dnsPolicyUUID: 'saved' });
    page.info.update((info) => ({
      ...info,
      dnsPolicyEligible: true,
      dnsPolicyZoneName: 'example.com',
      dnsPolicyBase: 'sip.example.com',
    }));
    expect(page.dns.options()[0].label).toContain('sip.example.com');
    expect(page.dns.options()[0].label).not.toContain('Unavailable');
  });

  it('requests subsequent policy pages from the server', async () => {
    get.and.resolveTo({
      data: {
        items: [{ policyUUID: 'p51', base: 'sip.example.com', status: true, eligible: true }],
        total: 70,
      },
    });
    page.dns.page(1);
    await settle(fixture);
    expect(get.calls.mostRecent().args[0]).toContain('system/voip/pabx/parameters/dns-policies');
    expect(get.calls.mostRecent().args[0]).toContain('offset=50');
    expect(page.dns.total()).toBe(70);
    expect(page.dns.policies()[0].policyUUID).toBe('p51');
  });

  it('does not apply a stale response after a newer request', async () => {
    let resolveOld!: (value: unknown) => void;
    get.and.returnValue(new Promise((resolve) => (resolveOld = resolve)));
    page.dns.page(1);
    TestBed.tick();
    get.and.resolveTo({
      data: { items: [{ policyUUID: 'new', base: 'sip.example.com', status: true }], total: 1 },
    });
    page.dns.page(-1);
    await settle(fixture);
    resolveOld({ data: { items: [], total: 0 } });
    await Promise.resolve();
    TestBed.tick();
    expect(page.dns.policies()[0].policyUUID).toBe('new');
  });

  it('omits a stale policy and keeps empty retention as inherit when saving', async () => {
    page.update({
      autoDomainDnsMode: 'identity_only',
      dnsPolicyUUID: 'old',
      autoDomainBase: 'Manual.Example.com.',
      cdrRetentionDays: null,
      recordingRetentionDays: 0,
    });
    await page.save();
    const body = put.calls.mostRecent().args[1];
    expect(put.calls.mostRecent().args[0]).toBe('system/voip/pabx/parameters');
    expect(body.dnsPolicyUUID).toBeNull();
    expect(body.autoDomainBase).toBe('manual.example.com');
    expect(body.cdrRetentionDays).toBeNull();
    expect(body.recordingRetentionDays).toBe(0);
  });

  it('saves the extension offline alert and rejects more than a day', async () => {
    page.update({ extensionOfflineAlertMinutes: 1441 });
    await page.save();
    expect(put).not.toHaveBeenCalled();
    expect(page.invalid('extensionOfflineAlertMinutes')).toBeTrue();
    page.update({ extensionOfflineAlertMinutes: 15 });
    await page.save();
    expect(put.calls.mostRecent().args[1].extensionOfflineAlertMinutes).toBe(15);
  });

  it('reveals a missing storage account instead of saving', async () => {
    page.update({ recordingStorageMode: 'storage', recordingStorageBucketUUID: '' });
    await page.save();
    expect(put).not.toHaveBeenCalled();
    expect(page.invalid('recordingStorageBucketUUID')).toBeTrue();
    expect(page.selectedTab()).toBe(0);
  });
});

describe('VoIP Softswitch parameters', () => {
  it('loads tenant SIP realm policies from its own module selector', async () => {
    const { get } = setup(VoipSoftswitchParametersPage, 'tenant');
    await TestBed.compileComponents();
    const fixture = TestBed.createComponent(VoipSoftswitchParametersPage);
    const page = fixture.componentInstance;
    await settle(fixture);
    get.and.resolveTo({
      data: {
        items: [
          { policyUUID: 'sw1', base: 'softswitch.example.com', status: true, eligible: true },
        ],
        total: 1,
      },
    });
    page.dns.page(1);
    await settle(fixture);
    expect(get.calls.mostRecent().args[0]).toContain('voip/softswitch/parameters/dns-policies');
    expect(page.dns.policies()[0].policyUUID).toBe('sw1');
    expect(page.form().realmSource).toBe('inherit');
  });
});
