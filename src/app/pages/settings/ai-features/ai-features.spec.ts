import {
  AI_FEATURE_OPTIONS,
  OPENAI_VOICE_OPTIONS,
  aiFeatureLabel,
  isSpeechFeature,
} from './ai-features';

describe('AI feature catalog', () => {
  it('lists the text and speech features of the API catalog', () => {
    expect(AI_FEATURE_OPTIONS.map((option) => option.value)).toEqual([
      'registry.documents.assist',
      'support.triage',
      'help.tutorial.script',
      'help.tutorial.narration',
    ]);
    expect(aiFeatureLabel('help.tutorial.narration')).toBe('Tutorial video narration');
  });

  it('marks only narration as a speech feature', () => {
    expect(isSpeechFeature('help.tutorial.narration')).toBeTrue();
    expect(isSpeechFeature('help.tutorial.script')).toBeFalse();
    expect(isSpeechFeature('support.triage')).toBeFalse();
    expect(isSpeechFeature(null)).toBeFalse();
  });

  it('offers the OpenAI voices with readable labels', () => {
    expect(OPENAI_VOICE_OPTIONS.find((option) => option.value === 'coral')?.label).toBe('Coral');
    expect(OPENAI_VOICE_OPTIONS.every((option) => /^[a-z]+$/.test(option.value))).toBeTrue();
  });
});
