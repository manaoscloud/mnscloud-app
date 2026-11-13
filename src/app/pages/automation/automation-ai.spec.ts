import { aiErrorKey } from './ai-dialogs';
import { portsOf } from './automation-graph';

describe('automation AI blocks', () => {
  it('derives the intent ports from the options, plus unknown and error', () => {
    const node = {
      id: 'n',
      type: 'ai.classify_intent',
      typeVersion: 1,
      position: { x: 0, y: 0 },
      config: {
        options: [
          { id: 'boleto', label: 'Segunda via' },
          { id: '', label: 'x' },
        ],
      },
    };
    expect(portsOf(node as never, undefined).map((port) => port.id)).toEqual([
      'option:boleto',
      'unknown',
      'error',
    ]);
  });

  it('maps API AI refusals to messages', () => {
    expect(aiErrorKey({ error: { code: 'automation.ai.no_credit' } })).toBe(
      'automation.ai.error.no_credit',
    );
    expect(aiErrorKey({ error: { code: 'automation.ai.not_configured' } })).toBe(
      'automation.ai.error.not_configured',
    );
    expect(aiErrorKey(new Error('x'))).toBe('automation.ai.error.failed');
  });
});
