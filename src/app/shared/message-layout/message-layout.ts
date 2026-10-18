/**
 * Readable layout of conversation messages (support replies, AI answers, notes). Messages are
 * stored as plain text; this gives them structure for display: paragraphs, and numbered or
 * bulleted items on their own lines, including "confirm: 1) A 2) B" written inside a sentence.
 * The API e-mails apply the same rules (`mnscloud-api` services/messageLayout.ts).
 */
export type MessageBlock =
  { kind: 'paragraph'; lines: string[] } | { kind: 'ordered' | 'bullets'; items: string[] };

/** `1)` / `1.` item markers written inline inside a sentence. */
const INLINE_MARKER = /(^|[\s:;])(\d{1,2})[.)]\s+/g;
const ORDERED_ITEM = /^\s*\d{1,2}[.)]\s+(.*)$/;
const BULLET_ITEM = /^\s*[-•*]\s+(.*)$/;

/** One line per item, only when the inline markers count 1, 2, 3... in order. */
function splitInlineList(line: string): string[] {
  const markers: { at: number; end: number }[] = [];
  let expected = 1;
  for (const match of line.matchAll(INLINE_MARKER)) {
    if (Number(match[2]) !== expected) continue;
    markers.push({ at: match.index + match[1].length, end: match.index + match[0].length });
    expected++;
  }
  if (markers.length < 2) return [line];
  const lines: string[] = [];
  const lead = line.slice(0, markers[0].at).trim();
  if (lead) lines.push(lead);
  markers.forEach((marker, index) => {
    const next = markers[index + 1]?.at ?? line.length;
    lines.push(`${index + 1}. ${line.slice(marker.end, next).trim()}`);
  });
  return lines;
}

/** Normalized text: unified line breaks, inline enumerations split, single blank lines. */
export function layoutMessageText(value: unknown): string {
  const out: string[] = [];
  for (const raw of String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')) {
    const line = raw.trimEnd();
    const parts = splitInlineList(line);
    if (parts.length === 1) {
      out.push(line);
      continue;
    }
    const [first, ...items] = /^\d+\. /.test(parts[0]) ? ['', ...parts] : parts;
    if (first) out.push(first, '');
    out.push(...items, '');
  }
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Paragraphs and lists of a message (blank lines separate paragraphs). */
export function messageBlocks(value: unknown): MessageBlock[] {
  const blocks: MessageBlock[] = [];
  for (const line of layoutMessageText(value).split('\n')) {
    const last = blocks.at(-1);
    if (!line.trim()) {
      if (last?.kind === 'paragraph') blocks.push({ kind: 'paragraph', lines: [] });
      continue;
    }
    const ordered = ORDERED_ITEM.exec(line);
    const bullet = ordered ? null : BULLET_ITEM.exec(line);
    const text = (ordered?.[1] ?? bullet?.[1] ?? line).trim();
    if (!ordered && !bullet) {
      if (last?.kind === 'paragraph') last.lines.push(text);
      else blocks.push({ kind: 'paragraph', lines: [text] });
      continue;
    }
    const kind = ordered ? 'ordered' : 'bullets';
    if (last?.kind === kind) {
      last.items.push(text);
      continue;
    }
    if (last?.kind === 'paragraph' && !last.lines.length) blocks.pop();
    blocks.push({ kind, items: [text] });
  }
  return blocks.filter((block) => block.kind !== 'paragraph' || block.lines.length);
}
