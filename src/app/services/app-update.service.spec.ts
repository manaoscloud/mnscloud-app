import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { APP_BUILD_INFO } from '../app-build-info';
import {
  APP_UPDATE_CONFIRM_DELAY_MS,
  AppUpdateService,
  normalizeVersion,
  parseBuildMetadata,
} from './app-update.service';

describe('AppUpdateService', () => {
  let service: AppUpdateService;
  const running = normalizeVersion(APP_BUILD_INFO.version);
  const newer = '999.0.0';

  beforeEach(() => {
    localStorage.removeItem('mnscloud_app_update_snooze');
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    });
    service = TestBed.inject(AppUpdateService);
  });

  it('parses only App build metadata with a semantic version', () => {
    expect(
      parseBuildMetadata({ product: 'mnscloud-app', version: 'v1.2.3', buildRef: 'abc' }),
    ).toEqual({ version: '1.2.3', buildRef: 'abc', minimumVersion: null });
    expect(parseBuildMetadata({ product: 'mnscloud-api', version: '1.2.3' })).toBeNull();
    expect(parseBuildMetadata({ product: 'mnscloud-app', version: '<script>' })).toBeNull();
    expect(parseBuildMetadata('1.2.3')).toBeNull();
  });

  it('treats a busy registered source (the phone dock) as open work with its own message', () => {
    expect(service.openWorkKey()).toBeNull();
    let phoneActive = true;
    service.registerBusySource('phoneDock.updateOpenWork', () => phoneActive);
    expect(service.hasOpenWork()).toBe(true);
    expect(service.openWorkKey()).toBe('phoneDock.updateOpenWork');
    phoneActive = false;
    expect(service.hasOpenWork()).toBe(false);
  });

  it('stays quiet while the deployed version equals the running bundle', () => {
    service.observe({ version: running, buildRef: null }, 0);
    expect(service.updateAvailable()).toBe(false);
    expect(service.noticeVisible()).toBe(false);
  });

  it('announces a new version only after two reads agree over the confirmation delay', () => {
    service.observe({ version: newer, buildRef: 'n1' }, 0);
    expect(service.updateAvailable()).toBe(false);

    service.observe({ version: newer, buildRef: 'n1' }, APP_UPDATE_CONFIRM_DELAY_MS - 1);
    expect(service.updateAvailable()).toBe(false);

    service.observe({ version: newer, buildRef: 'n1' }, APP_UPDATE_CONFIRM_DELAY_MS);
    expect(service.updateAvailable()).toBe(true);
    expect(service.noticeVisible()).toBe(true);
  });

  it('ignores a node still on the old version during a rolling rollout', () => {
    service.observe({ version: newer, buildRef: 'n1' }, 0);
    service.observe({ version: running, buildRef: null }, 10_000);
    service.observe({ version: newer, buildRef: 'n1' }, APP_UPDATE_CONFIRM_DELAY_MS + 20_000);
    expect(service.updateAvailable()).toBe(false);
  });

  it('keeps the notice hidden after "later" until another version arrives', () => {
    service.observe({ version: newer, buildRef: 'n1' }, 0);
    service.observe({ version: newer, buildRef: 'n1' }, APP_UPDATE_CONFIRM_DELAY_MS);
    service.postpone();
    expect(service.noticeVisible()).toBe(false);
    expect(service.updateAvailable()).toBe(true);

    service.observe({ version: '999.0.1', buildRef: 'n2' }, 100_000);
    service.observe({ version: '999.0.1', buildRef: 'n2' }, 100_000 + APP_UPDATE_CONFIRM_DELAY_MS);
    expect(service.noticeVisible()).toBe(true);
  });

  it('shows the notice again on request', () => {
    service.observe({ version: newer, buildRef: 'n1' }, 0);
    service.observe({ version: newer, buildRef: 'n1' }, APP_UPDATE_CONFIRM_DELAY_MS);
    service.postpone();
    service.showNotice();
    expect(service.noticeVisible()).toBe(true);
  });

  it('reads the critical minimum version from the build metadata', () => {
    expect(
      parseBuildMetadata({ product: 'mnscloud-app', version: '1.2.3', minimumVersion: '1.2.0' }),
    ).toEqual({ version: '1.2.3', buildRef: null, minimumVersion: '1.2.0' });
    expect(
      parseBuildMetadata({ product: 'mnscloud-app', version: '1.2.3', minimumVersion: 'x' }),
    ).toEqual({ version: '1.2.3', buildRef: null, minimumVersion: null });
  });

  it('cannot postpone a critical update (running below the minimum version)', () => {
    const critical = { version: newer, buildRef: 'n1', minimumVersion: newer };
    service.observe(critical, 0);
    service.observe(critical, APP_UPDATE_CONFIRM_DELAY_MS);
    expect(service.critical()).toBe(true);
    service.postpone();
    expect(service.noticeVisible()).toBe(true);
  });

  it('keeps a regular update postponable when the running version meets the minimum', () => {
    const regular = { version: newer, buildRef: 'n1', minimumVersion: running };
    service.observe(regular, 0);
    service.observe(regular, APP_UPDATE_CONFIRM_DELAY_MS);
    expect(service.critical()).toBe(false);
    service.postpone();
    expect(service.noticeVisible()).toBe(false);
  });

  it('turns a new API version hint into one immediate build.json read', () => {
    const check = spyOn(service, 'check').and.returnValue(Promise.resolve());
    service.hint(running);
    expect(check).not.toHaveBeenCalled();
    service.hint(newer);
    service.hint(newer);
    service.hint('not-a-version');
    expect(check).toHaveBeenCalledTimes(1);
    expect(check).toHaveBeenCalledWith(true);
  });

  it('clears the update when the environment returns to the running version (rollback)', () => {
    service.observe({ version: newer, buildRef: 'n1' }, 0);
    service.observe({ version: newer, buildRef: 'n1' }, APP_UPDATE_CONFIRM_DELAY_MS);
    service.observe({ version: running, buildRef: null }, 200_000);
    service.observe({ version: running, buildRef: null }, 200_000 + APP_UPDATE_CONFIRM_DELAY_MS);
    expect(service.updateAvailable()).toBe(false);
  });
});
