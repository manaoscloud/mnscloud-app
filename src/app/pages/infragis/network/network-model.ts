/**
 * InfraGIS FTTH network helpers shared by the network page and its print view: ABNT NBR 14721 fiber
 * colors, splitter presets and the splice diagram layout (connections placed at a box).
 */

export type Row = Record<string, unknown>;

/** Fiber and tube colors (ABNT NBR 14721 sequence) as screen colors. */
export const FIBER_COLORS: Record<string, string> = {
  verde: '#16A34A',
  amarelo: '#EAB308',
  branco: '#F8FAFC',
  azul: '#2563EB',
  vermelho: '#DC2626',
  violeta: '#7C3AED',
  marrom: '#92400E',
  rosa: '#EC4899',
  preto: '#111827',
  cinza: '#6B7280',
  laranja: '#F97316',
  aqua: '#06B6D4',
};

export const fiberColor = (name: unknown): string =>
  FIBER_COLORS[String(name ?? '').toLowerCase()] ?? '#94A3B8';

/** Typical maximum insertion loss of balanced PLC splitters (dB). */
export const SPLITTER_PRESETS = [
  { value: '2', label: '1:2', outputs: 2, lossDb: 3.7 },
  { value: '4', label: '1:4', outputs: 4, lossDb: 7.3 },
  { value: '8', label: '1:8', outputs: 8, lossDb: 10.5 },
  { value: '16', label: '1:16', outputs: 16, lossDb: 13.7 },
  { value: '32', label: '1:32', outputs: 32, lossDb: 17.1 },
  { value: '64', label: '1:64', outputs: 64, lossDb: 20.5 },
] as const;

export const PORT_KINDS = [
  { value: 'FIBER', label: 'Fiber' },
  { value: 'PORT', label: 'Customer port' },
  { value: 'SPLITTER_IN', label: 'Splitter input' },
  { value: 'SPLITTER_OUT', label: 'Splitter output' },
];
export const CONNECTION_KINDS = [
  { value: 'FUSION', label: 'Fusion' },
  { value: 'CONNECTOR', label: 'Connector' },
  { value: 'PATCH', label: 'Patch cord' },
  { value: 'DROP', label: 'Drop to customer' },
];
export const RELATION_KINDS = [
  { value: 'CONTAINS', label: 'Contains' },
  { value: 'ATTACHED_TO', label: 'Is attached to' },
  { value: 'PASSES_THROUGH', label: 'Passes through' },
];

const KIND_SHORT: Record<string, string> = {
  FIBER: 'F',
  PORT: 'P',
  SPLITTER_IN: 'IN',
  SPLITTER_OUT: 'OUT',
};

/** "F 13 (T2)" for a fiber, "P 4" for a port, "OUT 3" for a splitter output. */
export function portLabel(kind: unknown, number: unknown, tube?: unknown): string {
  const prefix = KIND_SHORT[String(kind ?? '')] ?? String(kind ?? '');
  return `${prefix} ${number ?? ''}${tube && tube !== 'NULL' ? ` (T${tube})` : ''}`.trim();
}

export type SpliceEnd = { asset: string; label: string; color: string; y: number };
export type SpliceLine = { from: SpliceEnd; to: SpliceEnd; kind: string; loss: string };
export type SpliceDiagram = {
  width: number;
  height: number;
  groups: { side: 'left' | 'right'; asset: string; y: number; height: number }[];
  lines: SpliceLine[];
};

const ROW = 22;
const HEADER = 28;

/**
 * Splice diagram of the connections at a box: each connection is a row, the "from" ends on the
 * left grouped by asset and the "to" ends on the right, both sorted by asset and port number.
 */
export function spliceDiagram(connections: readonly Row[], width = 760): SpliceDiagram {
  const sorted = [...connections].sort(
    (a, b) =>
      String(a['FromAssetName']).localeCompare(String(b['FromAssetName'])) ||
      Number(a['FromNumber']) - Number(b['FromNumber']),
  );
  const groups: SpliceDiagram['groups'] = [];
  const lines: SpliceLine[] = [];
  let y = HEADER;
  let current = '';
  for (const connection of sorted) {
    const asset = String(connection['FromAssetName'] ?? '');
    if (asset !== current) {
      current = asset;
      y += 8;
      groups.push({ side: 'left', asset, y, height: 0 });
    }
    const end = (side: 'From' | 'To'): SpliceEnd => ({
      asset: String(connection[`${side}AssetName`] ?? ''),
      label: portLabel(
        connection[`${side}Kind`],
        connection[`${side}Number`],
        connection[`${side}Tube`],
      ),
      color: fiberColor(connection[`${side}Color`]),
      y,
    });
    lines.push({
      from: end('From'),
      to: end('To'),
      kind: String(connection['IcnKind'] ?? ''),
      loss: String(connection['IcnLossDb'] ?? ''),
    });
    groups[groups.length - 1].height += ROW;
    y += ROW;
  }
  // Right-side groups follow the "to" assets in the order they appear.
  let open: SpliceDiagram['groups'][number] | null = null;
  for (const line of lines) {
    if (!open || open.asset !== line.to.asset) {
      open = { side: 'right', asset: line.to.asset, y: line.to.y, height: 0 };
      groups.push(open);
    }
    open.height = line.to.y + ROW - open.y;
  }
  return { width, height: y + 16, groups, lines };
}

/** Occupancy class of a box (share of customer ports taken). */
export function occupancyLevel(occupied: number, total: number): 'none' | 'ok' | 'high' | 'full' {
  if (!total) return 'none';
  const share = occupied / total;
  if (share >= 1) return 'full';
  return share >= 0.7 ? 'high' : 'ok';
}
