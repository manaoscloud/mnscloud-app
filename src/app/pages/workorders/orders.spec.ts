import { allowedTransitions, statusChip, workOrdersConfig } from './orders';

describe('Work orders page', () => {
  it('offers only the status moves the API accepts', () => {
    expect(allowedTransitions('OPEN')).toEqual(['IN_PROGRESS', 'CANCELLED']);
    expect(allowedTransitions('ASSIGNED')).toEqual(['IN_PROGRESS', 'ON_HOLD', 'CANCELLED']);
    expect(allowedTransitions('IN_PROGRESS')).toEqual(['ON_HOLD', 'DONE', 'CANCELLED']);
    expect(allowedTransitions('ON_HOLD')).toEqual(['IN_PROGRESS', 'CANCELLED']);
    expect(allowedTransitions('DONE')).toEqual(['OPEN']);
    expect(allowedTransitions('CANCELLED')).toEqual(['OPEN']);
  });

  it('colors running, waiting and closed orders', () => {
    expect(statusChip('IN_PROGRESS')).toBe('chip-running');
    expect(statusChip('ON_HOLD')).toBe('chip-warning');
    expect(statusChip('DONE')).toBe('chip-success');
    expect(statusChip('OPEN')).toBe('chip-queued');
  });

  it('lists only my orders on the technician page and blocks edits of closed ones', () => {
    expect(workOrdersConfig(true).listQuery).toEqual({ mine: '1' });
    expect(workOrdersConfig(false).listQuery).toBeUndefined();
    const config = workOrdersConfig(false);
    expect(config.canEditRow?.({ WorStatus: 'DONE' })).toBeFalse();
    expect(config.canDeleteRow?.({ WorStatus: 'IN_PROGRESS' })).toBeFalse();
    expect(config.canDeleteRow?.({ WorStatus: 'CANCELLED' })).toBeTrue();
  });
});
