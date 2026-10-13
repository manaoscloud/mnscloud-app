import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { AsyncOperationActivityComponent } from './async-operation-activity';
import { AsyncOperation, AsyncOperationsService } from './async-operations.service';

describe('Background activity panel', () => {
  async function render(operations: AsyncOperation[]) {
    await TestBed.configureTestingModule({
      imports: [
        AsyncOperationActivityComponent,
        TranslocoTestingModule.forRoot({
          langs: {
            en: {
              'operations.kind.vps': 'VPS',
              'operations.kind.unknown': 'Operation',
              'operations.action.changePlan': 'Change plan',
              'operations.state.running': 'Running',
              'operations.state.queued': 'Queued',
            },
          },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
      providers: [
        {
          provide: AsyncOperationsService,
          useValue: { visible: signal(operations), rechecking: signal(new Set()) },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AsyncOperationActivityComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }
  const title = (element: HTMLElement) =>
    element.querySelector('.activity-title')?.textContent?.replace(/\s+/g, ' ').trim();

  it('names the work and its resource instead of only an identifier', async () => {
    const element = await render([
      {
        operationUUID: 'cdc7c59d-1f8e-4b2a-9c3d-5e6f7a8b9c0d',
        state: 'running',
        kind: 'vps',
        action: 'change_plan',
        resourceLabel: 'app-server-01',
        createdAt: new Date().toISOString(),
      },
    ]);
    expect(title(element)).toBe('VPS · Change plan');
    expect(element.querySelector('.activity-resource')?.textContent).toContain('app-server-01');
    const meta = element.querySelector('.activity-meta')!;
    expect(meta.textContent).toContain('CDC7C59D');
    expect(meta.getAttribute('title')).toBe('cdc7c59d-1f8e-4b2a-9c3d-5e6f7a8b9c0d');
  });

  it('falls back to a readable label before the first status read', async () => {
    const element = await render([
      {
        operationUUID: '11111111111111111111111111111111',
        state: 'queued',
        action: 'firmware.upgrade',
      },
    ]);
    expect(title(element)).toBe('Operation · Firmware upgrade');
    expect(element.querySelector('.activity-resource')).toBeNull();
  });
});
