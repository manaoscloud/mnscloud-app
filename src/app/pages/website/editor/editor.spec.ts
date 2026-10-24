import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';

import { SnackbarService } from '../../../services/snackbar.service';
import { WebsiteService, type WebsiteSiteDetail } from '../website.service';
import { WebsiteEditorPage } from './editor';

function detail(revision: number, draftContent: unknown = null): WebsiteSiteDetail {
  return {
    site: {
      siteUUID: 'u-1',
      name: 'Shop',
      status: 'draft',
      defaultLocale: 'pt-BR',
      locales: ['pt-BR', 'en-US'],
      autoDomain: 'abc.site.example.com',
      themeDomainUUID: null,
      themeDomain: null,
      siteUrl: 'https://abc.site.example.com',
      publishedVersion: 0,
      publishedAt: null,
      dns: { status: 'published', error: null, canRetry: false },
      revision,
    },
    draftContent,
    hasUnpublishedChanges: false,
  };
}

describe('WebsiteEditorPage', () => {
  let fixture: ComponentFixture<WebsiteEditorPage>;
  let page: WebsiteEditorPage;
  let website: jasmine.SpyObj<WebsiteService>;
  let snack: jasmine.SpyObj<SnackbarService>;

  beforeEach(async () => {
    website = jasmine.createSpyObj<WebsiteService>('WebsiteService', [
      'get',
      'saveContent',
      'publish',
      'unpublish',
    ]);
    website.get.and.resolveTo(detail(3));
    snack = jasmine.createSpyObj<SnackbarService>('SnackbarService', [
      'success',
      'warning',
      'error',
    ]);
    TestBed.configureTestingModule({
      imports: [
        WebsiteEditorPage,
        TranslocoTestingModule.forRoot({
          langs: { en: {} },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: new Map([['uuid', 'u-1']]) } },
        },
        { provide: WebsiteService, useValue: website },
        { provide: SnackbarService, useValue: snack },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(true) }) } },
      ],
    }).overrideComponent(WebsiteEditorPage, { set: { template: '' } });
    fixture = TestBed.createComponent(WebsiteEditorPage);
    page = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('loads the site and one content block per enabled locale, default first', () => {
    expect(website.get).toHaveBeenCalledWith('u-1');
    expect(page.locales()).toEqual(['pt-BR', 'en-US']);
    expect(Object.keys(page.content().locales)).toEqual(['pt-BR', 'en-US']);
    expect(page.dirty()).toBeFalse();
    expect(page.siteUrl()).toBe('https://abc.site.example.com');
  });

  it('saves the draft with the loaded revision and resets the dirty state', async () => {
    page.set('pt-BR.hero.title', 'Olá');
    expect(page.dirty()).toBeTrue();
    website.saveContent.and.resolveTo(detail(4, page.content()));
    expect(await page.saveDraft()).toBeTrue();
    const [uuid, revision, content] = website.saveContent.calls.mostRecent().args;
    expect([uuid, revision]).toEqual(['u-1', 3]);
    expect(content.locales['pt-BR']?.hero.title).toBe('Olá');
    expect(page.site()?.revision).toBe(4);
    expect(page.dirty()).toBeFalse();
  });

  it('blocks publishing without titles and opens the tab of the first missing field', async () => {
    page.selectedTab.set(0);
    await page.publish();
    expect(website.publish).not.toHaveBeenCalled();
    expect(page.invalid('pt-BR.seo.title')).toBeTrue();
    expect(page.selectedTab()).toBe(1);
    expect(page.tabInvalid(1)).toBeTrue();
    expect(page.tabInvalid(0)).toBeFalse();
  });

  it('saves pending changes before publishing', async () => {
    for (const locale of ['pt-BR', 'en-US']) {
      page.set(`${locale}.seo.title`, 'Shop');
      page.set(`${locale}.hero.title`, 'Welcome');
    }
    website.saveContent.and.resolveTo(detail(4, page.content()));
    website.publish.and.resolveTo({ ...detail(5), hasUnpublishedChanges: false });
    await page.publish();
    expect(website.saveContent).toHaveBeenCalled();
    expect(website.publish).toHaveBeenCalledWith('u-1', 4);
  });

  it('reloads with a clear message on a revision conflict', async () => {
    page.set('pt-BR.hero.title', 'Mine');
    website.saveContent.and.rejectWith({
      status: 409,
      error: { code: 'WEBSITE_REVISION_CONFLICT' },
    });
    website.get.and.resolveTo(detail(7));
    expect(await page.saveDraft()).toBeFalse();
    expect(snack.warning).toHaveBeenCalledWith('website.revisionConflict', 8000);
    expect(page.site()?.revision).toBe(7);
    expect(page.dirty()).toBeFalse();
  });

  it('marks the field named by a server content validation path', async () => {
    page.set('en-US.hero.title', 'x');
    website.saveContent.and.rejectWith({
      status: 400,
      error: {
        code: 'VALIDATION_FAILED',
        fields: ['content'],
        path: 'content.locales.en-US.hero.title',
      },
    });
    expect(await page.saveDraft()).toBeFalse();
    expect(page.invalid('en-US.hero.title')).toBeTrue();
    expect(page.selectedTab()).toBe(2);
  });

  it('adds, moves and removes sections of one locale', () => {
    page.newSectionType.set('faq');
    page.addSection('pt-BR');
    page.newSectionType.set('text');
    page.addSection('pt-BR');
    expect(page.block('pt-BR').sections.map((s) => s.type)).toEqual(['faq', 'text']);
    page.moveSection('pt-BR', 1, -1);
    expect(page.block('pt-BR').sections.map((s) => s.type)).toEqual(['text', 'faq']);
    page.removeSection('pt-BR', 0);
    expect(page.block('pt-BR').sections.map((s) => s.type)).toEqual(['faq']);
    expect(page.block('en-US').sections).toEqual([]);
  });
});
