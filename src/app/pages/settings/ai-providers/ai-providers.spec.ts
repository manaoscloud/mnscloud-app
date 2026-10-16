import { AI_PROVIDER_KIND_OPTIONS, aiModelOptions, aiProviderKindLabel } from './ai-providers';

/** Catalog entry as listed by the API (`{ id, label }`). */
const listed = (id: string, name = id) => ({ id, label: name });
const option = (value: string, name = value, description?: string) => ({
  value,
  label: name,
  ...(description ? { description } : {}),
});

describe('platform AI provider helpers', () => {
  it('offers only the three official providers', () => {
    expect(AI_PROVIDER_KIND_OPTIONS.map((kind) => kind.value)).toEqual([
      'anthropic',
      'openai',
      'gemini',
    ]);
    expect(aiProviderKindLabel('gemini')).toBe(AI_PROVIDER_KIND_OPTIONS[2].label);
    expect(aiProviderKindLabel('mock')).toBe('mock');
  });

  it('lists provider models and keeps a selected model that left the catalog', () => {
    const sonnet = 'claude-sonnet-5-5';
    const sonnetName = ['Claude', 'Sonnet', '5.5'].join(' ');
    const models = [listed(sonnet, sonnetName), listed('gpt-5')];
    expect(aiModelOptions(models, 'gpt-5')).toEqual([
      option(sonnet, sonnetName, sonnet),
      option('gpt-5'),
    ]);
    expect(aiModelOptions(models, 'claude-old')[0]).toEqual(option('claude-old'));
    expect(aiModelOptions([], '')).toEqual([]);
  });
});
