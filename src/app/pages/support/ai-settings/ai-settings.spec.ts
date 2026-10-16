import { toPercent } from './ai-settings';

describe('support AI settings helpers', () => {
  it('shows the stored 0-1 confidence as a whole percent', () => {
    expect(toPercent('0.800', 50)).toBe(80);
    expect(toPercent(0.725, 50)).toBe(73);
    expect(toPercent(null, 70)).toBe(0);
    expect(toPercent('not a number', 70)).toBe(70);
  });
});
