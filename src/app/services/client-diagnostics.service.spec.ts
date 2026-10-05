import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ClientDiagnosticsService, redactDiagnosticText } from './client-diagnostics.service';
import { maskSensitiveContent } from './support-report.service';

describe('ClientDiagnosticsService', () => {
  let service: ClientDiagnosticsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    });
    service = TestBed.inject(ClientDiagnosticsService);
  });

  it('redacts bearer tokens, JWTs and secret parameters', () => {
    const text = redactDiagnosticText(
      'Authorization: Bearer abc.def password=hunter2 eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature12',
    );
    expect(text).not.toContain('hunter2');
    expect(text).not.toContain('abc.def');
    expect(text).not.toContain('eyJhbGci');
  });

  it('keeps a bounded trail of console errors and failed requests', () => {
    for (let index = 0; index < 40; index++) service.recordConsole('ERROR', `failure ${index}`);
    for (let index = 0; index < 25; index++) {
      service.recordFailedRequest({
        method: 'get',
        url: `/api/v1/x?api_key=secret&n=${index}`,
        status: 500,
        requestId: null,
        message: null,
      });
    }
    const snapshot = service.snapshot();
    expect(snapshot.consoleLogs.length).toBe(30);
    expect(snapshot.consoleLogs[0].message).toBe('failure 10');
    expect(snapshot.failedRequests.length).toBe(20);
    expect(snapshot.failedRequests[0].method).toBe('GET');
    expect(JSON.stringify(snapshot)).not.toContain('secret');
  });

  it('captures console.error calls', () => {
    console.error('Unexpected', new Error('kaboom'));
    expect(service.snapshot().consoleLogs.at(-1)?.message).toContain('kaboom');
  });

  it('masks passwords and marked elements in the screenshot clone', () => {
    const doc = document.implementation.createHTMLDocument('clone');
    doc.body.innerHTML =
      '<input type="password" value="hunter2"><div data-report-mask><span>4111 1111</span></div>';
    maskSensitiveContent(doc);
    expect((doc.querySelector('input') as HTMLInputElement).value).toBe('••••••');
    expect((doc.querySelector('span') as HTMLElement).style.visibility).toBe('hidden');
  });
});
