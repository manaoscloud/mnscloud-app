import { AUTOMATION_SURFACE_FORM_OPTIONS } from './flows/flows';
import {
  DEFAULT_PRESET,
  cronToPreset,
  eventVariables,
  groupEvents,
  parseTime,
  presetToCron,
  scheduleSummary,
  toEventCatalog,
  withEvent,
  withFilterTo,
} from './event-triggers';

const catalog = toEventCatalog({
  data: {
    items: [
      {
        name: 'support.ticket.status_changed',
        module: 'support',
        label: { 'pt-BR': 'Situação alterada', en: 'Status changed', es: 'Estado' },
        filterTo: ['open', 'closed'],
        payload: ['ticket', 'to'],
        hasCustomer: true,
        locked: false,
      },
      {
        name: 'crm.lead.created',
        module: 'crm',
        label: { 'pt-BR': 'Lead', en: 'Lead', es: 'Lead' },
        filterTo: [],
        payload: ['lead'],
        hasCustomer: false,
        locked: true,
      },
    ],
  },
});

describe('automation event triggers', () => {
  it('builds cron strings from presets and reads them back', () => {
    const daily = { ...DEFAULT_PRESET, kind: 'daily' as const, hour: 8, minute: 30 };
    expect(presetToCron(daily)).toBe('30 8 * * *');
    expect(presetToCron({ ...daily, kind: 'weekly', weekday: 5 })).toBe('30 8 * * 5');
    expect(presetToCron({ ...daily, kind: 'monthly', day: 15 })).toBe('30 8 15 * *');
    expect(presetToCron({ ...daily, kind: 'hourly' })).toBe('0 * * * *');
    expect(presetToCron({ ...daily, kind: 'custom', cron: ' */5 * * * * ' })).toBe('*/5 * * * *');
    for (const kind of ['daily', 'weekly', 'monthly', 'hourly'] as const) {
      const preset = { ...daily, kind, weekday: 2, day: 10 };
      expect(cronToPreset(presetToCron(preset)).kind).toBe(kind);
    }
    expect(cronToPreset('30 8 * * 5')).toEqual(
      jasmine.objectContaining({ kind: 'weekly', weekday: 5, hour: 8 }),
    );
    expect(cronToPreset('0 9 31 * *')).toEqual(
      jasmine.objectContaining({ kind: 'monthly', day: 31 }),
    );
  });

  it('keeps unknown expressions as advanced', () => {
    expect(cronToPreset('*/5 * * * *').kind).toBe('custom');
    expect(cronToPreset('0 8 * 6 *').kind).toBe('custom');
    expect(cronToPreset('0 25 * * *').kind).toBe('custom');
    expect(cronToPreset('0 8 * * 1-5').kind).toBe('custom');
    expect(cronToPreset('').kind).toBe('custom');
  });

  it('summarizes a schedule with its time zone', () => {
    const daily = scheduleSummary('0 8 * * *', 'America/Sao_Paulo');
    expect(daily.key).toBe('automation.schedule.summary.daily');
    expect(daily.params).toEqual(
      jasmine.objectContaining({ time: '08:00', timezone: 'America/Sao_Paulo' }),
    );
    const weekly = scheduleSummary('5 17 * * 5', 'UTC');
    expect(weekly.key).toBe('automation.schedule.summary.weekly');
    expect(weekly.params['weekdayKey']).toBe('automation.schedule.weekday.5');
    expect(scheduleSummary('*/5 * * * *', '').params).toEqual(
      jasmine.objectContaining({
        cron: '*/5 * * * *',
        timezone: 'America/Sao_Paulo',
      }),
    );
  });

  it('parses the time input and ignores invalid text', () => {
    expect(parseTime('07:05', { hour: 1, minute: 1 })).toEqual({ hour: 7, minute: 5 });
    expect(parseTime('25:00', { hour: 1, minute: 1 })).toEqual({ hour: 1, minute: 1 });
  });

  it('groups events by module and lists the run variables', () => {
    expect(groupEvents(catalog).map((group) => group.module)).toEqual(['support', 'crm']);
    expect(eventVariables(catalog[0])).toEqual([
      '{{vars.event.name}}',
      '{{vars.event.payload.ticket}}',
      '{{vars.event.payload.to}}',
      '{{vars.ticket}}',
    ]);
    expect(eventVariables(catalog[1])).toContain('{{vars.lead}}');
    expect(eventVariables(undefined)).toEqual(['{{vars.event.name}}']);
  });

  it('keeps the status filter only when the new event supports it', () => {
    const item = { type: 'event', event: 'support.ticket.status_changed', filter: { to: 'open' } };
    expect(withEvent(item, catalog[0], 'support.ticket.status_changed')['filter']).toEqual({
      to: 'open',
    });
    expect(withEvent(item, catalog[1], 'crm.lead.created')['filter']).toEqual({});
    expect(withFilterTo(item, '')['filter']).toEqual({});
    expect(withFilterTo(item, 'closed')['filter']).toEqual({ to: 'closed' });
  });

  it('offers conversations and events when creating a flow, not voice (FL8)', () => {
    expect(AUTOMATION_SURFACE_FORM_OPTIONS.map((option) => option.value)).toEqual([
      'conversation',
      'event',
    ]);
  });
});
