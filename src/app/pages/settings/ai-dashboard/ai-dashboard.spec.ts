import { formatTokens, formatUsd } from './ai-dashboard';

describe('AI dashboard formatting', () => {
  it('shows cents, and four digits for sub-cent costs', () => {
    expect(formatUsd(1.1)).toBe('US$ 1.10');
    expect(formatUsd(0.000977)).toBe('US$ 0.0010');
    expect(formatUsd(0)).toBe('US$ 0.00');
    expect(formatUsd(null)).toBe('—');
  });

  it('compacts token counts', () => {
    expect(formatTokens(950)).toBe('950');
    expect(formatTokens(4626)).toBe('4.6k');
    expect(formatTokens(3_400_000)).toBe('3.4M');
    expect(formatTokens(undefined)).toBe('—');
  });
});
