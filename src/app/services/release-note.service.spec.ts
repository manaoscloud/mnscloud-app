import { localizedText, productLabel, releaseNoteIcon } from './release-note.service';

describe('release note display helpers', () => {
  it('uses the user language, then English, Portuguese and Spanish', () => {
    const value = { 'pt-BR': 'Painel', 'en-US': 'Panel', 'es-ES': null };
    expect(localizedText(value, 'pt-BR')).toBe('Painel');
    expect(localizedText(value, 'es-ES')).toBe('Panel');
    expect(localizedText({ 'es-ES': 'Panel ES' }, 'pt-BR')).toBe('Panel ES');
    expect(localizedText(undefined, 'pt-BR')).toBe('');
  });

  it('names products and types', () => {
    expect(productLabel('mnscloud-api')).toBe('API');
    expect(productLabel('mnscloud-customer-portal')).toBe('Portal');
    expect(productLabel('mnscloud-agent')).toBe('Agent');
    expect(releaseNoteIcon('security')).toBe('verified_user');
    expect(releaseNoteIcon('other')).toBe('campaign');
  });
});
