import { TestBed } from '@angular/core/testing';

import { TerminalComponent, TerminalNotice } from './terminal';

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

function pasteEvent(text: string): ClipboardEvent {
  const data = new DataTransfer();
  data.setData('text/plain', text);
  return new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true });
}

describe('TerminalComponent paste', () => {
  let component: TerminalComponent;
  let element: HTMLElement;
  let sent: string[];
  let notices: TerminalNotice[];

  beforeEach(async () => {
    const fixture = TestBed.createComponent(TerminalComponent);
    element = fixture.nativeElement as HTMLElement;
    element.style.width = '640px';
    element.style.height = '320px';
    document.body.appendChild(element);
    component = fixture.componentInstance;
    sent = [];
    notices = [];
    spyOn(component.terminalInput, 'emit').and.callFake((data: string) => sent.push(data));
    spyOn(component.notice, 'emit').and.callFake((notice: TerminalNotice) => notices.push(notice));
    fixture.detectChanges();
    for (let attempt = 0; attempt < 100 && !component.size(); attempt++) await tick(20);
  });

  afterEach(() => element.remove());

  it('sends a browser paste through the input path with CR line ends', () => {
    const textarea = element.querySelector('textarea')!;
    const event = pasteEvent('show run\nexit');
    textarea.dispatchEvent(event);
    expect(event.defaultPrevented).toBeTrue();
    expect(sent.join('')).toBe('show run\rexit');
  });

  it('wraps the paste when the remote enabled bracketed paste', async () => {
    component.write('\x1b[?2004h');
    await tick(50);
    component.paste('a\nb');
    expect(sent.join('')).toBe('\x1b[200~a\rb\x1b[201~');
  });

  it('refuses a paste above the limit and tells why', () => {
    component.paste('x'.repeat(70 * 1024));
    expect(sent).toEqual([]);
    expect(notices[0]?.code).toBe('paste_too_large');
  });

  it('reports the fitted grid', () => {
    const size = component.size()!;
    expect(size.cols).toBeGreaterThan(20);
    expect(size.rows).toBeGreaterThan(5);
  });
});
