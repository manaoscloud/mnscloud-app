import { matchScreens, type AssistantScreen } from './assistant-dialog';
import {
  assistantErrorCode,
  assistantLocale,
  assistantToolKey,
  safeAssistantRoute,
} from './assistant.service';

const screens: AssistantScreen[] = [
  { label: 'Ramais', path: 'Telefonia › PABX › Ramais', route: '/voip/pabx/extensions' },
  { label: 'Troncos', path: 'Telefonia › PABX › Troncos', route: '/voip/pabx/trunks' },
  { label: 'Chamados', path: 'Suporte › Chamados', route: '/support/requests' },
];

describe('App assistant', () => {
  it('matches screens by every typed word, accents ignored, shortest path first', () => {
    expect(matchScreens(screens, 'pabx').map((item) => item.route)).toEqual([
      '/voip/pabx/extensions',
      '/voip/pabx/trunks',
    ]);
    expect(matchScreens(screens, 'telefonia ramais').map((item) => item.route)).toEqual([
      '/voip/pabx/extensions',
    ]);
    expect(matchScreens(screens, 'SUPORTE')[0].route).toBe('/support/requests');
    expect(matchScreens(screens, '')).toEqual([]);
    expect(matchScreens(screens, 'x')).toEqual([]);
  });

  it('navigates only to internal App routes', () => {
    expect(safeAssistantRoute('/voip/pabx')).toBe('/voip/pabx');
    for (const bad of ['https://evil.example', '//evil.example', '/a b', '/\\x', '', null]) {
      expect(safeAssistantRoute(bad)).toBeNull();
    }
  });

  it('maps languages and error codes', () => {
    expect(assistantLocale('pt-BR')).toBe('pt-BR');
    expect(assistantLocale('en-US')).toBe('en');
    expect(assistantLocale('es-ES')).toBe('es');
    expect(assistantErrorCode({ status: 429, error: { code: 'AI_ASSISTANT_RATE_LIMIT' } })).toBe(
      'AI_ASSISTANT_RATE_LIMIT',
    );
    expect(assistantErrorCode({ status: 409, error: {} })).toBe('AI_ASSISTANT_CONVERSATION_FULL');
    expect(assistantErrorCode({ status: 404 })).toBe('AI_ASSISTANT_NOT_FOUND');
    expect(assistantErrorCode(new Error('x'))).toBe('AI_PROVIDER_ERROR');
  });

  it('labels read tools by translation key, unknown ones generically', () => {
    expect(assistantToolKey('voip.pabx.extensions.list')).toBe(
      'assistant.tool.voip.pabx.extensions.list',
    );
    expect(assistantToolKey('x.y.z')).toBe('assistant.tool.generic');
  });
});
