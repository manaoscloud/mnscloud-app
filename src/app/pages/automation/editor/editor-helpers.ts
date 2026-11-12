// Pure helpers of the flow editor (layout breakpoints, lock rule, palette grouping, node summary).

import { Dict, FlowDetail, GraphNode, NodeTypeDef } from '../automation-adapter';

export type EditorLayout = 'wide' | 'medium' | 'phone';
export type RightPane = 'inspector' | 'test' | 'issues';
export type PhonePane = 'steps' | 'palette' | 'inspector' | 'test' | 'issues';
export type SaveState = 'saved' | 'dirty' | 'saving' | 'error' | 'locked' | 'conflict';

/** Width of the workspace (not of the window) at which the panes rearrange. */
export function editorLayoutFor(width: number): EditorLayout {
  if (width <= 760) return 'phone';
  if (width <= 1100) return 'medium';
  return 'wide';
}

const LOCK_MS = 10 * 60 * 1000;

/** The draft lock is held by another user who edited it less than ten minutes ago. */
export function lockedByOther(flow: FlowDetail | null, me: string, now = Date.now()): boolean {
  const lock = flow?.lock;
  if (!lock || !lock.userUUID || lock.userUUID === me) return false;
  const edited = Date.parse(lock.editedAt);
  return Number.isFinite(edited) && now - edited < LOCK_MS;
}

export interface PaletteGroup {
  module: string;
  locked: boolean;
  reason: string;
  items: NodeTypeDef[];
}

/** Palette groups by module (core first); a group is locked when every type in it is. */
export function paletteGroups(defs: readonly NodeTypeDef[], filter: string): PaletteGroup[] {
  const needle = filter.trim().toLowerCase();
  const groups = new Map<string, NodeTypeDef[]>();
  for (const def of defs) {
    if (needle && !`${def.type} ${def.module}`.toLowerCase().includes(needle)) continue;
    groups.set(def.module, [...(groups.get(def.module) ?? []), def]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === 'core' ? -1 : b === 'core' ? 1 : a.localeCompare(b)))
    .map(([module, items]) => ({
      module,
      locked: items.every((item) => item.locked),
      reason: items.find((item) => item.locked)?.lockReason ?? '',
      items,
    }));
}

const MODULE_COLORS = [
  '--mns-channel-whatsapp',
  '--mns-chart-1',
  '--mns-chart-2',
  '--mns-channel-instagram',
  '--mns-channel-telegram',
  '--mns-channel-email',
];

/** Theme token used as accent of a module (header of its nodes and palette group). */
export function moduleAccent(module: string): string {
  if (module === 'core') return '--mat-sys-color-primary';
  let hash = 0;
  for (const char of module) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return MODULE_COLORS[hash % MODULE_COLORS.length];
}

/** One-line description of a node config for the card and the list (first filled text). */
export function nodeSummary(node: GraphNode): string {
  const first = (value: unknown): string => {
    if (typeof value === 'string') return value.trim();
    if (Array.isArray(value)) {
      for (const item of value) {
        const text = first(item);
        if (text) return text;
      }
      return '';
    }
    if (value && typeof value === 'object') {
      for (const item of Object.values(value as Dict)) {
        const text = first(item);
        if (text) return text;
      }
    }
    return '';
  };
  const text = first(node.config).replace(/\s+/g, ' ');
  return text.length > 70 ? `${text.slice(0, 67)}...` : text;
}
