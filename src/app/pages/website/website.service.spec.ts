import { TestBed } from '@angular/core/testing';

import { ApiService } from '../../services/api.service';
import { normalizeWebsiteContent } from './website-content';
import { WebsiteService, isRevisionConflict, websiteContentErrorPath } from './website.service';

describe('WebsiteService', () => {
  let api: jasmine.SpyObj<ApiService>;
  let service: WebsiteService;
  const item = {
    siteUUID: 'u-1',
    name: 'Shop',
    revision: 4,
    locales: ['pt-BR'],
    defaultLocale: 'pt-BR',
  };

  beforeEach(() => {
    api = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'put', 'post']);
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: api }] });
    service = TestBed.inject(WebsiteService);
  });

  it('reads the site, its draft and the unpublished flag', async () => {
    api.get.and.resolveTo({
      data: { ...item, draftContent: { version: 1 }, hasUnpublishedChanges: true },
    });
    const detail = await service.get('u-1');
    expect(api.get).toHaveBeenCalledWith('website/sites/u-1');
    expect(detail.site.name).toBe('Shop');
    expect(detail.draftContent).toEqual({ version: 1 });
    expect(detail.hasUnpublishedChanges).toBeTrue();
  });

  it('fails clearly when the site is missing', async () => {
    api.get.and.resolveTo({ data: {} });
    await expectAsync(service.get('u-1')).toBeRejected();
  });

  it('saves the draft with the loaded revision', async () => {
    api.put.and.resolveTo({ data: { ...item, revision: 5, draftContent: null } });
    const content = normalizeWebsiteContent(null, ['pt-BR']);
    const result = await service.saveContent('u-1', 4, content);
    expect(api.put).toHaveBeenCalledWith('website/sites/u-1/content', { revision: 4, content });
    expect(result?.site.revision).toBe(5);
  });

  it('publishes, unpublishes and retries DNS on the site routes', async () => {
    api.post.and.resolveTo({ data: {} });
    expect(await service.publish('u-1', 4)).toBeNull();
    await service.unpublish('u-1', 5);
    await service.retryDns('u-1');
    expect(api.post.calls.allArgs()).toEqual([
      ['website/sites/u-1/publish', { revision: 4 }],
      ['website/sites/u-1/unpublish', { revision: 5 }],
      ['website/sites/u-1/dns/retry', {}],
    ]);
  });

  it('reloads mutations that return no draft', async () => {
    api.post.and.resolveTo({ data: { ...item } });
    expect(await service.publish('u-1', 4)).toBeNull();
  });

  it('recognizes only the revision conflict code', () => {
    expect(
      isRevisionConflict({ status: 409, error: { code: 'WEBSITE_REVISION_CONFLICT' } }),
    ).toBeTrue();
    expect(isRevisionConflict({ status: 409, error: { code: 'WEBSITE_SUSPENDED' } })).toBeFalse();
    expect(isRevisionConflict(null)).toBeFalse();
  });

  it('maps a content validation path to the editor field', () => {
    expect(
      websiteContentErrorPath({
        error: {
          code: 'VALIDATION_FAILED',
          fields: ['content'],
          path: 'content.locales.pt-BR.hero.title',
        },
      }),
    ).toBe('pt-BR.hero.title');
    expect(websiteContentErrorPath({ error: { path: 'content.theme.primaryColor' } })).toBe(
      'theme.primaryColor',
    );
    expect(websiteContentErrorPath({ error: { path: '<script>' } })).toBeNull();
  });
});
