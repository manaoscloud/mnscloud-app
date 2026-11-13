/**
 * Shared printing helpers: build a self-contained printable HTML document (A4) from already
 * translated data and print it through a hidden iframe, so the user can print or save as PDF.
 * Every value is escaped: callers pass plain text, never markup.
 */

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

export const PRINT_STYLES = `
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font: 11px/1.35 Arial, Helvetica, sans-serif; color: #111; margin: 0; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  h2 { font-size: 12px; margin: 12px 0 4px; }
  p { margin: 0 0 4px; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0; }
  th, td { border: 1px solid #777; padding: 2px 4px; text-align: left; vertical-align: top; }
  th { background: #eee; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  .meta td { border: 0; padding: 1px 8px 1px 0; }
  .num { text-align: right; white-space: nowrap; }
  .muted { color: #555; }
  .footer { margin-top: 10px; font-size: 10px; color: #333; }
`;

export type PrintTable = {
  headers: readonly string[];
  rows: readonly (readonly unknown[])[];
  /** Header indexes aligned to the right (numbers). */
  numericColumns?: readonly number[];
};

/** Renders a table with escaped cells; a cell value with newlines keeps its line breaks. */
export function printTableHtml(table: PrintTable): string {
  const numeric = new Set(table.numericColumns ?? []);
  const cell = (tag: string, value: unknown, index: number) =>
    `<${tag}${numeric.has(index) ? ' class="num"' : ''}>${escapeHtml(value).replace(/\r?\n/g, '<br>')}</${tag}>`;
  const head = table.headers.map((header, index) => cell('th', header, index)).join('');
  const body = table.rows
    .map((row) => `<tr>${row.map((value, index) => cell('td', value, index)).join('')}</tr>`)
    .join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/** Label/value block of a printed document (header data). */
export function printKeyValueHtml(entries: readonly (readonly [string, unknown])[]): string {
  const rows = entries
    .map(
      ([label, value]) =>
        `<tr><td class="muted">${escapeHtml(label)}</td><td><strong>${escapeHtml(value)}</strong></td></tr>`,
    )
    .join('');
  return `<table class="meta"><tbody>${rows}</tbody></table>`;
}

/** Wraps already-safe body markup (built with `escapeHtml`/`printTableHtml`) in a document. */
export function printDocumentHtml(title: string, bodyHtml: string, lang = 'en'): string {
  return (
    `<!doctype html><html lang="${escapeHtml(lang)}"><head><meta charset="utf-8">` +
    `<title>${escapeHtml(title)}</title><style>${PRINT_STYLES}</style></head>` +
    `<body>${bodyHtml}</body></html>`
  );
}

/** Document that lists rows of a table under a title (list print). */
export function printListHtml(options: {
  title: string;
  subtitle?: string;
  table: PrintTable;
  footer?: string;
  lang?: string;
}): string {
  const body =
    `<h1>${escapeHtml(options.title)}</h1>` +
    (options.subtitle ? `<p class="muted">${escapeHtml(options.subtitle)}</p>` : '') +
    printTableHtml(options.table) +
    (options.footer ? `<p class="footer">${escapeHtml(options.footer)}</p>` : '');
  return printDocumentHtml(options.title, body, options.lang);
}

/**
 * Prints an HTML document through a hidden iframe (srcdoc), removed afterwards. Resolves when the
 * print dialog was requested; rejects when the browser has no printable frame.
 */
export function printHtml(html: string, doc: Document = document): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = doc.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText =
      'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      frame.remove();
    };
    frame.onload = () => {
      const win = frame.contentWindow;
      if (!win) {
        cleanup();
        reject(new Error('print frame unavailable'));
        return;
      }
      win.addEventListener('afterprint', cleanup);
      try {
        win.focus();
        win.print();
        resolve();
      } catch (error) {
        cleanup();
        reject(error);
        return;
      }
      // Browsers that never fire `afterprint` still get the frame removed.
      setTimeout(cleanup, 60000);
    };
    frame.srcdoc = html;
    doc.body.appendChild(frame);
  });
}
