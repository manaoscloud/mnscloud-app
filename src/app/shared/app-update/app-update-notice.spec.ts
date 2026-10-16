import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { APP_UPDATE_CONFIRM_DELAY_MS, AppUpdateService } from '../../services/app-update.service';
import { AppUpdateNotice } from './app-update-notice';

describe('AppUpdateNotice', () => {
  let service: AppUpdateService;

  beforeEach(() => {
    localStorage.removeItem('mnscloud_app_update_snooze');
    TestBed.configureTestingModule({
      imports: [
        AppUpdateNotice,
        TranslocoTestingModule.forRoot({
          langs: {
            'en-US': {
              'appUpdate.title': 'New version available',
              'appUpdate.message': 'Update when convenient.',
              'appUpdate.openWork': 'A window is open.',
              'appUpdate.reloadNow': 'Update now',
              'appUpdate.reloadAnyway': 'Update anyway',
              'appUpdate.later': 'Later',
              'appUpdate.remindLater': 'Remind me later',
            },
          },
          translocoConfig: { availableLangs: ['en-US'], defaultLang: 'en-US' },
          preloadLangs: true,
        }),
      ],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    });
    service = TestBed.inject(AppUpdateService);
    spyOn(service, 'start');
  });

  function announce() {
    service.observe({ version: '999.0.0', buildRef: 'n1' }, 0);
    service.observe({ version: '999.0.0', buildRef: 'n1' }, APP_UPDATE_CONFIRM_DELAY_MS);
  }

  it('renders nothing while no update is pending', async () => {
    const fixture = TestBed.createComponent(AppUpdateNotice);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.app-update-notice')).toBeNull();
  });

  it('shows a polite status notice with the deployed version', async () => {
    announce();
    const fixture = TestBed.createComponent(AppUpdateNotice);
    await fixture.whenStable();
    const notice = fixture.nativeElement.querySelector('.app-update-notice') as HTMLElement;
    expect(notice.getAttribute('role')).toBe('status');
    expect(notice.getAttribute('aria-live')).toBe('polite');
    expect(notice.textContent).toContain('v999.0.0');
    expect(notice.textContent).toContain('Update now');
  });

  it('asks before reloading while a dialog is open', async () => {
    announce();
    spyOn(service, 'hasOpenWork').and.returnValue(true);
    const reload = spyOn(service, 'reloadNow');
    const fixture = TestBed.createComponent(AppUpdateNotice);
    await fixture.whenStable();
    const primary = () =>
      fixture.nativeElement.querySelector('button[mat-flat-button]') as HTMLButtonElement;

    primary().click();
    await fixture.whenStable();
    expect(reload).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('A window is open.');

    primary().click();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('hides the notice when postponed', async () => {
    announce();
    const fixture = TestBed.createComponent(AppUpdateNotice);
    await fixture.whenStable();
    (fixture.nativeElement.querySelector('button[mat-button]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.app-update-notice')).toBeNull();
  });
});
