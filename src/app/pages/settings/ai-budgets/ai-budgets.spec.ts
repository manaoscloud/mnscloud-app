import {
  AI_BUDGET_PERIOD_OPTIONS,
  AI_BUDGET_SCOPE_OPTIONS,
  aiBudgetPeriodLabel,
  aiBudgetScopeLabel,
} from './ai-budgets';

describe('AI budgets page configuration', () => {
  it('provides scope options with proper labels', () => {
    expect(AI_BUDGET_SCOPE_OPTIONS.map((o) => o.value)).toEqual(['platform', 'feature', 'tenant']);
    expect(aiBudgetScopeLabel('platform')).toBe('Platform');
    expect(aiBudgetScopeLabel('feature')).toBe('Feature');
    expect(aiBudgetScopeLabel('tenant')).toBe('Tenant');
    expect(aiBudgetScopeLabel('unknown')).toBe('unknown');
  });

  it('provides period options with proper labels', () => {
    expect(AI_BUDGET_PERIOD_OPTIONS.map((o) => o.value)).toEqual(['month', 'day']);
    expect(aiBudgetPeriodLabel('month')).toBe('Monthly');
    expect(aiBudgetPeriodLabel('day')).toBe('Daily');
    expect(aiBudgetPeriodLabel('year')).toBe('year');
  });
});
