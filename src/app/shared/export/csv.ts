/** CSV for pt-BR Excel: `;` separator, CRLF rows and a UTF-8 BOM. */
export const CSV_SEPARATOR = ';';
export const CSV_BOM = '﻿';

export function csvCell(value: unknown): string {
  let text = String(value ?? '');
  // Neutralise spreadsheet formulas typed by users (CSV injection).
  if (/^[=+@]/.test(text) || /^-(?![\d.,]*$)/.test(text)) text = `'${text}`;
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildCsv(
  headers: readonly string[],
  rows: readonly (readonly unknown[])[],
  withBom = true,
): string {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(CSV_SEPARATOR));
  return (withBom ? CSV_BOM : '') + lines.join('\r\n') + '\r\n';
}

export function csvFilename(page: string, date: Date = new Date()): string {
  const slug =
    page
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'export';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${slug}-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.csv`;
}

export function downloadCsv(filename: string, content: string, doc: Document = document): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = doc.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  doc.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
