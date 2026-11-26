import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ToastContainer } from './toast-container';
import { SnackbarService } from '../../services/snackbar.service';
import { AppI18nService } from '../../services/app-i18n.service';
import { ToastItem } from './toast.model';

describe('ToastContainer', () => {
  let fixture: ComponentFixture<ToastContainer>;
  let toastsSignal: ReturnType<typeof signal<ToastItem[]>>;
  let isPausedSignal: ReturnType<typeof signal<boolean>>;
  let snackbarMock: {
    toasts: typeof toastsSignal;
    isPaused: typeof isPausedSignal;
    pause: jasmine.Spy;
    resume: jasmine.Spy;
    dismiss: jasmine.Spy;
  };
  let i18nMock: { t: jasmine.Spy };

  beforeEach(async () => {
    toastsSignal = signal<ToastItem[]>([]);
    isPausedSignal = signal<boolean>(false);

    snackbarMock = {
      toasts: toastsSignal,
      isPaused: isPausedSignal,
      pause: jasmine.createSpy('pause'),
      resume: jasmine.createSpy('resume'),
      dismiss: jasmine.createSpy('dismiss'),
    };

    i18nMock = {
      t: jasmine
        .createSpy('t')
        .and.callFake((key: string) => (key === 'snackbar.close' ? 'Fechar' : key)),
    };

    await TestBed.configureTestingModule({
      imports: [ToastContainer],
      providers: [
        provideZonelessChangeDetection(),
        { provide: SnackbarService, useValue: snackbarMock },
        { provide: AppI18nService, useValue: i18nMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ToastContainer);
    fixture.detectChanges();
  });

  it('renders nothing when there are no active toasts', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.mns-toast-container')).toBeNull();
  });

  it('renders active stacked toasts with proper icons, classes and message', () => {
    toastsSignal.set([
      {
        id: 't1',
        type: 'info',
        message: 'Info notification',
        duration: 4000,
        count: 1,
        dismissing: false,
        createdAt: Date.now(),
        remainingTime: 4000,
      },
      {
        id: 't2',
        type: 'error',
        message: 'Something went wrong',
        duration: 6000,
        count: 3,
        dismissing: false,
        createdAt: Date.now(),
        remainingTime: 6000,
      },
    ]);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const container = el.querySelector('.mns-toast-container');
    expect(container).not.toBeNull();

    const items = el.querySelectorAll('.mns-toast');
    expect(items.length).toBe(2);

    expect(items[0].classList.contains('mns-toast-info')).toBeTrue();
    expect(items[0].textContent).toContain('Info notification');

    expect(items[1].classList.contains('mns-toast-error')).toBeTrue();
    expect(items[1].textContent).toContain('Something went wrong');

    const badge = items[1].querySelector('.mns-toast-badge');
    expect(badge).not.toBeNull();
    expect(badge?.textContent?.trim()).toBe('3x');
  });

  it('renders action button and triggers its handler on click', () => {
    const onActionSpy = jasmine.createSpy('onAction');
    toastsSignal.set([
      {
        id: 't1',
        type: 'error',
        message: 'Server failed',
        duration: 8000,
        count: 1,
        dismissing: false,
        createdAt: Date.now(),
        remainingTime: 8000,
        action: {
          label: 'Report problem',
          onClick: onActionSpy,
        },
      },
    ]);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const actionBtn = el.querySelector('.mns-toast-action') as HTMLButtonElement;
    expect(actionBtn).not.toBeNull();
    expect(actionBtn.textContent?.trim()).toBe('Report problem');

    actionBtn.click();
    expect(onActionSpy).toHaveBeenCalled();
  });

  it('calls dismiss when clicking the close button', () => {
    toastsSignal.set([
      {
        id: 'toast-123',
        type: 'warning',
        message: 'Warning text',
        duration: 5000,
        count: 1,
        dismissing: false,
        createdAt: Date.now(),
        remainingTime: 5000,
      },
    ]);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const closeBtn = el.querySelector('.mns-toast-close') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();

    closeBtn.click();
    expect(snackbarMock.dismiss).toHaveBeenCalledWith('toast-123');
  });

  it('calls pause and resume on mouseenter and mouseleave', () => {
    toastsSignal.set([
      {
        id: 't1',
        type: 'success',
        message: 'Done',
        duration: 4000,
        count: 1,
        dismissing: false,
        createdAt: Date.now(),
        remainingTime: 4000,
      },
    ]);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const container = el.querySelector('.mns-toast-container') as HTMLElement;
    expect(container).not.toBeNull();

    container.dispatchEvent(new MouseEvent('mouseenter'));
    expect(snackbarMock.pause).toHaveBeenCalled();

    container.dispatchEvent(new MouseEvent('mouseleave'));
    expect(snackbarMock.resume).toHaveBeenCalled();
  });

  it('brings container to front (attaches to document.body) when toasts are active and restores when cleared', () => {
    const host = fixture.nativeElement as HTMLElement;
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    parent.appendChild(host);

    toastsSignal.set([
      {
        id: 't-front',
        type: 'info',
        message: 'Front toast',
        duration: 3000,
        count: 1,
        dismissing: false,
        createdAt: Date.now(),
        remainingTime: 3000,
      },
    ]);
    fixture.detectChanges();

    expect(host.parentElement).toBe(document.body);
    if (typeof host.showPopover === 'function') {
      expect(host.getAttribute('popover')).toBe('manual');
    }

    toastsSignal.set([]);
    fixture.detectChanges();

    expect(host.parentElement).toBe(parent);
    parent.remove();
  });
});
