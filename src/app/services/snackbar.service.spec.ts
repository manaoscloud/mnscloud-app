import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { SnackbarService } from './snackbar.service';
import { AppI18nService } from './app-i18n.service';

describe('SnackbarService', () => {
  let service: SnackbarService;
  let i18nMock: { t: jasmine.Spy };

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 0, 1));

    i18nMock = {
      t: jasmine.createSpy('t').and.callFake((key: string) => key),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        SnackbarService,
        { provide: AppI18nService, useValue: i18nMock },
      ],
    });

    service = TestBed.inject(SnackbarService);
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('stacks multiple alerts simultaneously instead of replacing the previous one', () => {
    service.info('Notice 1');
    service.warning('Notice 2');
    service.error('Notice 3');

    const toasts = service.toasts();
    expect(toasts.length).toBe(3);
    expect(toasts[0].message).toBe('Notice 1');
    expect(toasts[0].type).toBe('info');
    expect(toasts[1].message).toBe('Notice 2');
    expect(toasts[1].type).toBe('warning');
    expect(toasts[2].message).toBe('Notice 3');
    expect(toasts[2].type).toBe('error');
  });

  it('dismisses the oldest alert first when its duration expires (vai sumindo o mais antigo para o novo)', () => {
    service.info('Notice 1', 3000);
    jasmine.clock().tick(1000);
    service.error('Notice 2', 5000);

    expect(service.toasts().length).toBe(2);

    // After 2001ms more (total 3001ms for Notice 1):
    // Notice 1 starts dismissing
    jasmine.clock().tick(2001);
    expect(service.toasts()[0].dismissing).toBeTrue();
    expect(service.toasts()[1].dismissing).toBeFalse();

    // After animation delay (250ms), Notice 1 is removed from list, Notice 2 remains
    jasmine.clock().tick(250);
    const active = service.toasts();
    expect(active.length).toBe(1);
    expect(active[0].message).toBe('Notice 2');
    expect(active[0].dismissing).toBeFalse();

    // Notice 2 was created at t=1000 with duration 5000ms, so it dismisses at t=6000ms
    // Current time is t=3251ms. Tick 2750ms -> t=6001ms
    jasmine.clock().tick(2750);
    expect(service.toasts()[0].dismissing).toBeTrue();

    jasmine.clock().tick(250);
    expect(service.toasts().length).toBe(0);
  });

  it('deduplicates identical alerts by bumping count and refreshing timer', () => {
    service.error('Server unavailable', 4000);
    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0].count).toBe(1);

    jasmine.clock().tick(2000);
    service.error('Server unavailable', 4000);

    // Still only 1 toast item, but count is 2
    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0].count).toBe(2);

    // At 2500ms after second call, it is still active because timer was reset
    jasmine.clock().tick(2500);
    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0].dismissing).toBeFalse();

    // After remaining 1600ms (total 4100ms since reset), it dismisses
    jasmine.clock().tick(1600);
    expect(service.toasts()[0].dismissing).toBeTrue();
    jasmine.clock().tick(250);
    expect(service.toasts().length).toBe(0);
  });

  it('caps visible toasts at maximum limit and auto-dismisses oldest', () => {
    for (let i = 1; i <= 6; i++) {
      service.info(`Message ${i}`, 10000);
    }

    // Oldest (Message 1) was auto-dismissed to stay within MAX_VISIBLE_TOASTS (5)
    expect(service.toasts()[0].dismissing).toBeTrue();
    jasmine.clock().tick(250);
    expect(service.toasts().length).toBe(5);
    expect(service.toasts()[0].message).toBe('Message 2');
    expect(service.toasts()[4].message).toBe('Message 6');
  });

  it('supports errorWithAction and executes callback on click', () => {
    let actionExecuted = false;
    service.errorWithAction('Network timeout', 'Report problem', () => {
      actionExecuted = true;
    });

    const toast = service.toasts()[0];
    expect(toast).toBeTruthy();
    expect(toast.action?.label).toBe('Report problem');

    toast.action?.onClick();
    expect(actionExecuted).toBeTrue();
    expect(service.toasts()[0].dismissing).toBeTrue();
  });

  it('pauses and resumes countdown timers on hover', () => {
    service.success('Saved', 4000);

    jasmine.clock().tick(1500);
    service.pause();
    expect(service.isPaused()).toBeTrue();

    // Advance clock while paused: toast must NOT dismiss
    jasmine.clock().tick(10000);
    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0].dismissing).toBeFalse();

    // Resume: remaining time should run (remaining: 4000 - 1500 = 2500ms)
    service.resume();
    expect(service.isPaused()).toBeFalse();

    jasmine.clock().tick(2400);
    expect(service.toasts()[0].dismissing).toBeFalse();

    jasmine.clock().tick(200);
    expect(service.toasts()[0].dismissing).toBeTrue();
  });

  it('manually dismisses a specific toast by id', () => {
    const id1 = service.info('Notice 1', 10000);
    const id2 = service.info('Notice 2', 10000);

    expect(service.toasts().length).toBe(2);

    service.dismiss(id1);
    expect(service.toasts().find((t) => t.id === id1)?.dismissing).toBeTrue();
    expect(service.toasts().find((t) => t.id === id2)?.dismissing).toBeFalse();

    jasmine.clock().tick(250);
    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0].id).toBe(id2);
  });

  it('clears all toasts with clearAll', () => {
    service.info('Notice 1');
    service.warning('Notice 2');
    service.error('Notice 3');

    expect(service.toasts().length).toBe(3);

    service.clearAll();
    expect(service.toasts().every((t) => t.dismissing)).toBeTrue();

    jasmine.clock().tick(250);
    expect(service.toasts().length).toBe(0);
  });
});
