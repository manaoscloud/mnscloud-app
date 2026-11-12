import { escapeHtml, printListHtml, printTableHtml } from './print-html';

describe('print-html', () => {
  it('escapes markup characters', () => {
    expect(escapeHtml(`<img src=x onerror="a('b')">&`)).toBe(
      '&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;',
    );
    expect(escapeHtml(undefined)).toBe('');
  });

  it('escapes every cell and header of a table', () => {
    const html = printTableHtml({
      headers: ['<b>H</b>'],
      rows: [['<script>alert(1)</script>'], ['a\nb']],
      numericColumns: [0],
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('a<br>b');
    expect(html).toContain('class="num"');
  });

  it('escapes title, subtitle and footer of a list document', () => {
    const html = printListHtml({
      title: '<t>',
      subtitle: '<s>',
      footer: '<f>',
      table: { headers: ['h'], rows: [] },
    });
    expect(html).not.toMatch(/<t>|<s>|<f>/);
    expect(html).toContain('@page');
  });
});
