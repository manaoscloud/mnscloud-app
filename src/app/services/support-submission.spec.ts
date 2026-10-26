import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiService } from './api.service';
import { ClientDiagnosticsService } from './client-diagnostics.service';
import { SnackbarService } from './snackbar.service';
import { SupportReportService } from './support-report.service';
import { ENV_STORAGE_KEY } from '../core/environment/environment-context';

describe('Support evidence submission', () => {
  const tenant = '11111111-1111-4111-8111-111111111111';
  let service: SupportReportService;
  let post: jasmine.Spy;
  let previousEnvironment: string | null;
  const pending = { State: 'preparing', EvidenceRevision: 1, Attachments: [] };
  const payload = {
    title: 'Failure',
    description: 'The form failed',
    typeUUID: null,
    priorityUUID: null,
    url: 'https://example.com',
    route: '/hosting',
    appVersion: '1',
    systemInfo: {},
  };
  beforeEach(() => {
    previousEnvironment = localStorage.getItem(ENV_STORAGE_KEY);
    localStorage.setItem(ENV_STORAGE_KEY, tenant);
    post = jasmine.createSpy('post').and.resolveTo({
      data: { SupportTicketUUID: 'ticket', SupportTicketID: 'TKT-TEST', Submission: pending },
    });
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ApiService, useValue: { post } },
        { provide: SnackbarService, useValue: { success: () => {}, error: () => {} } },
        { provide: ClientDiagnosticsService, useValue: { snapshot: () => ({}) } },
      ],
    });
    service = TestBed.inject(SupportReportService);
  });
  afterEach(() => {
    if (previousEnvironment === null) localStorage.removeItem(ENV_STORAGE_KEY);
    else localStorage.setItem(ENV_STORAGE_KEY, previousEnvironment);
  });
  it('declares files before uploads and retries the same creation request', async () => {
    service.images.set([
      {
        id: 'image',
        fileName: 'error.png',
        blob: new Blob(['png']),
        previewUrl: '',
        status: 'ready',
      },
    ]);
    const result = await service.submitReport(payload, tenant);
    const body = post.calls.first().args[1];
    expect(body.deferAnalysis).toBeTrue();
    expect(body.expectedAttachments).toEqual([{ fileName: 'error.png', sizeBytes: 3 }]);
    expect(result.Submission?.State).toBe('preparing');
    await service.retrySubmission();
    expect(post.calls.mostRecent().args).toEqual(['help/tickets', body]);
    expect(post.calls.count()).toBe(2);
  });
  it('keeps pending uploads retryable until explicit completion and then clears replay data', async () => {
    await service.submitReport(payload, tenant);
    post.and.resolveTo({ data: pending });
    expect((await service.completeSubmission('ticket')).State).toBe('preparing');
    expect(post.calls.mostRecent().args[1]).toEqual({ continueWithoutMissing: false });
    post.and.resolveTo({ data: { ...pending, State: 'ready' } });
    expect((await service.completeSubmission('ticket', true)).State).toBe('ready');
    expect(post.calls.mostRecent().args[1]).toEqual({ continueWithoutMissing: true });
    const count = post.calls.count();
    expect(await service.retrySubmission()).toBeNull();
    expect(post.calls.count()).toBe(count);
  });
  it('does not replay or complete evidence in another tenant', async () => {
    await service.submitReport(payload, tenant);
    localStorage.setItem(ENV_STORAGE_KEY, '22222222-2222-4222-8222-222222222222');
    expect(await service.retrySubmission()).toBeNull();
    await expectAsync(service.completeSubmission('ticket')).toBeRejected();
    expect(post.calls.count()).toBe(1);
  });
});
