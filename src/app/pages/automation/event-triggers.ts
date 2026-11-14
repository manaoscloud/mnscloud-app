// Pure helpers of the event-surface triggers (FL7a): the catalog of domain events, the cron presets of the
// schedule trigger and the variables an author can use in an event run. Covered by event-triggers.spec.ts.

import { Dict } from './automation-adapter';

export interface EventLabels {
  'pt-BR': string;
  en: string;
  es: string;
}

export interface EventCatalogItem {
  name: string;
  module: string;
  label: EventLabels;
  filterTo: string[];
  payload: string[];
  hasCustomer: boolean;
  recordVariable: string | null;
  locked: boolean;
}

const RECORD_VARIABLES: Record<string, string> = {
  'support.ticket': 'ticket',
  'workorder.order': 'workOrder',
  'sale.quotation': 'quotation',
  'crm.lead': 'lead',
};

/** `GET /automation/events` -> catalog items (tolerates the `{data:{items}}` envelope). */
export function toEventCatalog(response: unknown): EventCatalogItem[] {
  const root = (response && typeof response === 'object' ? response : {}) as Dict;
  const body = (root['data'] && typeof root['data'] === 'object' ? root['data'] : root) as Dict;
  const items = Array.isArray(body['items']) ? (body['items'] as Dict[]) : [];
  return items
    .map((item) => {
      const name = String(item['name'] ?? '');
      const labels = (
        item['label'] && typeof item['label'] === 'object' ? item['label'] : {}
      ) as Dict;
      const record =
        typeof item['recordVariable'] === 'string' && item['recordVariable']
          ? (item['recordVariable'] as string)
          : (RECORD_VARIABLES[name.split('.').slice(0, 2).join('.')] ?? null);
      return {
        name,
        module: String(item['module'] ?? name.split('.')[0]),
        label: {
          'pt-BR': String(labels['pt-BR'] ?? name),
          en: String(labels['en'] ?? name),
          es: String(labels['es'] ?? name),
        },
        filterTo: Array.isArray(item['filterTo'])
          ? (item['filterTo'] as unknown[]).map(String)
          : [],
        payload: Array.isArray(item['payload']) ? (item['payload'] as unknown[]).map(String) : [],
        hasCustomer: item['hasCustomer'] !== false,
        recordVariable: record,
        locked: item['locked'] === true,
      };
    })
    .filter((item) => item.name);
}

/** Label of an event in the active language (`pt-BR`, `en-US`, `es-ES` -> catalog keys). */
export function eventLabel(item: EventCatalogItem, lang: string): string {
  const key = lang.startsWith('pt') ? 'pt-BR' : lang.startsWith('es') ? 'es' : 'en';
  return item.label[key];
}

export interface EventGroup {
  module: string;
  events: EventCatalogItem[];
}

/** Events grouped by module, in catalog order. */
export function groupEvents(items: EventCatalogItem[]): EventGroup[] {
  const groups = new Map<string, EventCatalogItem[]>();
  for (const item of items) groups.set(item.module, [...(groups.get(item.module) ?? []), item]);
  return [...groups].map(([module, events]) => ({ module, events }));
}

/** Variables available in a run started by this event (shown as author help). */
export function eventVariables(item: EventCatalogItem | undefined): string[] {
  if (!item) return ['{{vars.event.name}}'];
  return [
    '{{vars.event.name}}',
    ...item.payload.map((key) => `{{vars.event.payload.${key}}}`),
    ...(item.recordVariable ? [`{{vars.${item.recordVariable}}}`] : []),
  ];
}

// ---- schedule presets -----------------------------------------------------------------------

export type CronPresetKind = 'daily' | 'weekly' | 'monthly' | 'hourly' | 'custom';

export interface CronPreset {
  kind: CronPresetKind;
  hour: number;
  minute: number;
  weekday: number;
  day: number;
  /** Raw expression, kept for `custom`. */
  cron: string;
}

export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';
export const TIMEZONES = [
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Belem',
  'America/Fortaleza',
  'America/Bahia',
  'America/Cuiaba',
  'America/Rio_Branco',
  'America/Noronha',
  'UTC',
] as const;

export const DEFAULT_PRESET: CronPreset = {
  kind: 'daily',
  hour: 8,
  minute: 0,
  weekday: 1,
  day: 1,
  cron: '0 8 * * *',
};

/** Cron string (minute hour day month weekday) of a preset. */
export function presetToCron(preset: CronPreset): string {
  const { hour, minute, weekday, day } = preset;
  switch (preset.kind) {
    case 'daily':
      return `${minute} ${hour} * * *`;
    case 'weekly':
      return `${minute} ${hour} * * ${weekday}`;
    case 'monthly':
      return `${minute} ${hour} ${day} * *`;
    case 'hourly':
      return '0 * * * *';
    default:
      return preset.cron.trim();
  }
}

const NUMBER = /^\d{1,2}$/;

/** Preset that produces `cron`; anything that is not exactly a preset shape is `custom`. */
export function cronToPreset(cron: string): CronPreset {
  const text = (cron ?? '').trim().replace(/\s+/g, ' ');
  const custom: CronPreset = { ...DEFAULT_PRESET, kind: 'custom', cron: text };
  const parts = text.split(' ');
  if (parts.length !== 5) return custom;
  const [m, h, dom, mon, dow] = parts;
  if (text === '0 * * * *') return { ...DEFAULT_PRESET, kind: 'hourly', cron: text };
  if (!NUMBER.test(m) || !NUMBER.test(h) || mon !== '*') return custom;
  const minute = Number(m);
  const hour = Number(h);
  if (minute > 59 || hour > 23) return custom;
  const base = { ...DEFAULT_PRESET, minute, hour, cron: text };
  if (dom === '*' && dow === '*') return { ...base, kind: 'daily' };
  if (dom === '*' && /^[0-6]$/.test(dow)) return { ...base, kind: 'weekly', weekday: Number(dow) };
  if (dow === '*' && NUMBER.test(dom) && Number(dom) >= 1 && Number(dom) <= 31) {
    return { ...base, kind: 'monthly', day: Number(dom) };
  }
  return custom;
}

export const pad2 = (value: number): string => String(value).padStart(2, '0');
export const timeText = (preset: Pick<CronPreset, 'hour' | 'minute'>): string =>
  `${pad2(preset.hour)}:${pad2(preset.minute)}`;

/** `HH:MM` -> hour/minute (invalid text keeps the previous values). */
export function parseTime(text: string, fallback: Pick<CronPreset, 'hour' | 'minute'>) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return fallback;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

export interface ScheduleSummary {
  /** i18n key under `automation.schedule.summary.*`. */
  key: string;
  params: Record<string, string | number>;
}

/** Human summary of a schedule: translation key + params (the component translates; `weekday` is a name key). */
export function scheduleSummary(cron: string, timezone: string): ScheduleSummary {
  const preset = cronToPreset(cron);
  const params = {
    time: timeText(preset),
    day: preset.day,
    weekdayKey: `automation.schedule.weekday.${preset.weekday}`,
    cron: preset.cron,
    timezone: timezone || DEFAULT_TIMEZONE,
  };
  return { key: `automation.schedule.summary.${preset.kind}`, params };
}

// ---- trigger items --------------------------------------------------------------------------

export type EventTriggerType = 'event' | 'schedule';

/** A new trigger item of the event surface. */
export function newEventTrigger(type: EventTriggerType): Dict {
  return type === 'event'
    ? { type: 'event', event: '', filter: {} }
    : { type: 'schedule', cron: DEFAULT_PRESET.cron, timezone: DEFAULT_TIMEZONE };
}

/** Event item after choosing an event: the status filter survives only when the new event supports it. */
export function withEvent(item: Dict, event: EventCatalogItem | undefined, name: string): Dict {
  const filter = (
    item['filter'] && typeof item['filter'] === 'object' ? item['filter'] : {}
  ) as Dict;
  const to = typeof filter['to'] === 'string' ? filter['to'] : '';
  const keep = !!event && !!to && event.filterTo.includes(to);
  return { type: 'event', event: name, filter: keep ? { to } : {} };
}

/** Event item with the status filter set (empty = any status). */
export function withFilterTo(item: Dict, to: string): Dict {
  return { ...item, filter: to ? { to } : {} };
}
