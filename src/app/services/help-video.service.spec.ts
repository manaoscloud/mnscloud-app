import { Route } from '@angular/router';
import { HelpVideo, appRoutePatterns, pickHelpVideo } from './help-video.service';
import { helpVideoEmbedUrl } from '../shared/help-video/help-video-dialog';

const video = (Route: string, Locale: string, YoutubeVideoId = 'dQw4w9WgXcQ'): HelpVideo => ({
  Route,
  Locale,
  Title: `${Route} ${Locale}`,
  YoutubeVideoId,
});

describe('help videos', () => {
  const catalog = [
    video('/voip/pabx/trunks', 'pt-BR'),
    video('/voip/pabx/trunks', 'en-US', 'AbC-_123xyZ'),
    video('/support/tickets/:uuid', 'es-ES'),
    video('/broken', 'pt-BR', 'not-an-id'),
  ];

  it('picks the video of the page in the user language', () => {
    expect(pickHelpVideo(catalog, '/voip/pabx/trunks', 'pt-BR')?.Locale).toBe('pt-BR');
    expect(pickHelpVideo(catalog, '/voip/pabx/trunks', 'en-US')?.Locale).toBe('en-US');
  });

  it('falls back to English, then any language, and ignores invalid ids', () => {
    expect(pickHelpVideo(catalog, '/voip/pabx/trunks', 'es-ES')?.Locale).toBe('en-US');
    expect(pickHelpVideo(catalog, '/support/tickets/:uuid', 'pt-BR')?.Locale).toBe('es-ES');
    expect(pickHelpVideo(catalog, '/broken', 'pt-BR')).toBeNull();
    expect(pickHelpVideo(catalog, '/dashboard', 'pt-BR')).toBeNull();
  });

  it('lists every App page as a route pattern with its title', () => {
    const routes: Route[] = [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: '',
        loadComponent: () => Promise.resolve(class {}),
        children: [
          {
            path: 'voip/pabx/trunks',
            loadComponent: () => Promise.resolve(class {}),
            title: 'VoIP • Trunks | mnscloud',
          },
          { path: 'support/tickets/:uuid', loadComponent: () => Promise.resolve(class {}) },
        ],
      },
      { path: '**', redirectTo: '' },
    ];
    expect(appRoutePatterns(routes)).toEqual([
      { route: '/', title: '' },
      { route: '/voip/pabx/trunks', title: 'VoIP • Trunks' },
      { route: '/support/tickets/:uuid', title: '' },
    ]);
  });

  it('embeds only validated ids from youtube-nocookie', () => {
    expect(helpVideoEmbedUrl('dQw4w9WgXcQ', 'pt-BR')).toMatch(
      /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?autoplay=1&.*hl=pt-BR/,
    );
    expect(helpVideoEmbedUrl('javascript:x', 'pt-BR')).toBeNull();
    expect(helpVideoEmbedUrl('../../evil', 'en-US')).toBeNull();
  });
});
