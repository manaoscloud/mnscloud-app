import { ElementRef, Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ApiService } from '../../services/api.service';
import { SnackbarService } from '../../services/snackbar.service';
import { injectSettingsForm, settingsErrorMessage } from './settings-form';

type Form = { name: string };

describe('injectSettingsForm', () => {
  let get: jasmine.Spy;
  let put: jasmine.Spy;

  function create() {
    const injector = TestBed.inject(Injector);
    return runInInjectionContext(injector, () =>
      injectSettingsForm<Form, 'name'>({
        endpoint: 'system/example/parameters',
        initial: { name: '' },
        read: (item) => ({ name: String(item['name'] ?? '') }),
        payload: (form) => ({ name: form.name || null }),
        rules: (form) => ({ name: () => form().name.length <= 5 }),
      }),
    );
  }

  async function settle() {
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
      TestBed.tick();
    }
  }

  beforeEach(() => {
    get = jasmine.createSpy('get').and.resolveTo({ data: { item: { name: 'abc' } } });
    put = jasmine.createSpy('put').and.callFake(async (_endpoint: string, body: any) => ({
      data: { item: { name: body.name } },
    }));
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: { get, put } },
        {
          provide: SnackbarService,
          useValue: jasmine.createSpyObj('SnackbarService', ['warning']),
        },
        { provide: ElementRef, useValue: new ElementRef(document.createElement('div')) },
      ],
    });
  });

  it('loads, tracks changes and cancels to the loaded value', async () => {
    const settings = create();
    await settle();
    expect(get).toHaveBeenCalledWith('system/example/parameters');
    expect(settings.form()).toEqual({ name: 'abc' });
    expect(settings.hasChanges()).toBeFalse();
    settings.update({ name: 'xy' });
    expect(settings.hasChanges()).toBeTrue();
    settings.cancel();
    expect(settings.form()).toEqual({ name: 'abc' });
  });

  it('blocks an invalid save and saves the mapped payload', async () => {
    const settings = create();
    await settle();
    settings.update({ name: 'too long' });
    await settings.save();
    expect(put).not.toHaveBeenCalled();
    expect(settings.invalid('name')).toBeTrue();
    settings.update({ name: 'ok' });
    await settings.save();
    expect(put).toHaveBeenCalledWith('system/example/parameters', { name: 'ok' });
    expect(settings.success()).toBe('Parameters saved successfully.');
    expect(settings.hasChanges()).toBeFalse();
  });

  it('marks the fields the API rejected until they change', async () => {
    put.and.rejectWith({ error: { error: 'Name is taken', fields: ['name'] } });
    const settings = create();
    await settle();
    settings.update({ name: 'dup' });
    await settings.save();
    expect(settings.feedback()).toBe('Name is taken');
    expect(settings.invalid('name')).toBeTrue();
    settings.update({ name: 'new' });
    expect(settings.invalid('name')).toBeFalse();
  });

  it('falls back to a default error message', () => {
    expect(settingsErrorMessage({ error: { error: 'Bad' } }, 'x')).toBe('Bad');
    expect(settingsErrorMessage(new Error('Boom'), 'x')).toBe('Boom');
    expect(settingsErrorMessage(null, 'x')).toBe('x');
  });
});
