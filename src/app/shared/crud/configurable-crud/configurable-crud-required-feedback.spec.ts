import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { ApiService } from '../../../services/api.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { SystemParameterService } from '../../../services/system-parameter.service';
import { AsyncOperationsService } from '../../operations/async-operations.service';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from './configurable-crud-page-base';
import { defineCrud } from './define-crud';

const config = defineCrud({
  endpoint: 'test/required-items',
  uuidField: 'uuid',
  pageTitle: 'Items',
  pageDescription: 'Items used to test required field feedback.',
  statusFilter: false,
  initialValues: { name: '', code: '', host: '' },
  columns: [{ id: 'name', label: 'Name', field: 'name', kind: 'identity' }],
  fields: [
    { key: 'name', label: 'Name', required: true, span: 1 },
    { key: 'code', label: 'Code', span: 1 },
    { key: 'host', label: 'Host', required: true, tab: 'network', span: 1 },
  ],
});

@Component({
  selector: 'app-required-feedback-test-page',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: './configurable-crud-page.html',
})
class RequiredFeedbackTestPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}

function nextFrames(count = 6): Promise<void> {
  return new Promise((resolve) => {
    const step = (left: number) => (left ? requestAnimationFrame(() => step(left - 1)) : resolve());
    step(count);
  });
}

describe('Configurable CRUD required field feedback', () => {
  let api: jasmine.SpyObj<ApiService>;
  let snack: jasmine.SpyObj<SnackbarService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'post', 'put', 'delete']);
    api.get.and.resolveTo({ data: { items: [], total: 0 } });
    snack = jasmine.createSpyObj<SnackbarService>('SnackbarService', [
      'success',
      'error',
      'warning',
      'info',
    ]);
    await TestBed.configureTestingModule({
      imports: [
        RequiredFeedbackTestPage,
        TranslocoTestingModule.forRoot({
          langs: { 'en-US': {}, 'pt-BR': {}, 'es-ES': {} },
          translocoConfig: {
            availableLangs: ['en-US', 'pt-BR', 'es-ES'],
            defaultLang: 'en-US',
            missingHandler: { logMissingKey: false },
          },
          preloadLangs: true,
        }),
      ],
      providers: [
        provideRouter([]),
        { provide: ApiService, useValue: api },
        { provide: SnackbarService, useValue: snack },
        {
          provide: SystemParameterService,
          useValue: {
            resolveDefaultCurrency: () => Promise.resolve('BRL'),
            resolveDefaultTimezone: () => Promise.resolve('UTC'),
            resolveDefaultLanguage: () => Promise.resolve('en-US'),
          },
        },
        { provide: AsyncOperationsService, useValue: { observe: () => false } },
      ],
    }).compileComponents();
  });

  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((el) => el.remove()));

  async function openCreate() {
    const fixture = TestBed.createComponent(RequiredFeedbackTestPage);
    fixture.detectChanges();
    await fixture.whenStable();
    const page = fixture.componentInstance;
    page.startCreate();
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, page };
  }

  const dialog = () => document.querySelector('.crud-form-dialog') as HTMLElement;
  const formField = (key: string) =>
    dialog().querySelector(`[data-field-key="${key}"]`)?.closest('mat-form-field');

  it('marks every missing field, names it in the toast and focuses the first one', async () => {
    const { fixture, page } = await openCreate();

    await page.saveItem();
    fixture.detectChanges();
    await nextFrames();
    fixture.detectChanges();

    expect(api.post).not.toHaveBeenCalled();
    expect([...page.fieldErrors().keys()]).toEqual(['name', 'host']);
    expect(snack.warning).toHaveBeenCalledWith('form.validation.missingMany', 5000, {
      field: 'Name',
      count: 1,
    });
    expect(formField('name')?.classList).toContain('mat-form-field-invalid');
    expect(formField('name')?.textContent).toContain('form.validation.required');
    expect(formField('code')?.classList).not.toContain('mat-form-field-invalid');
    expect(document.activeElement?.getAttribute('data-field-key')).toBe('name');
    expect(dialog().querySelector('.crud-tab-network.crud-tab-invalid')).not.toBeNull();
  });

  it('switches to the tab of the first missing field and focuses it', async () => {
    const { fixture, page } = await openCreate();
    page.setFieldValue('name', 'Alpha');

    await page.saveItem();
    fixture.detectChanges();
    await nextFrames(12);
    fixture.detectChanges();

    expect(page.formTabGroup()?.selectedIndex).toBe(1);
    expect(document.activeElement?.getAttribute('data-field-key')).toBe('host');
    expect(snack.warning).toHaveBeenCalledWith('form.validation.missingOne', 5000, {
      field: 'Host',
    });
  });

  it('clears a field error as soon as the field is filled', async () => {
    const { page } = await openCreate();
    await page.saveItem();
    expect(page.hasFieldError({ key: 'name' })).toBeTrue();

    page.setFieldValue('name', 'Alpha');
    expect(page.hasFieldError({ key: 'name' })).toBeFalse();
    page.setFieldValue('name', '');
    expect(page.hasFieldError({ key: 'name' })).toBeTrue();
  });

  it('marks the fields an API validation failure points at', async () => {
    const { fixture, page } = await openCreate();
    page.setFieldValue('name', 'Alpha');
    page.setFieldValue('host', 'bad host');
    api.post.and.rejectWith({
      status: 400,
      error: { error: 'Host is invalid.', code: 'VALIDATION_FAILED', fields: ['host'] },
    });

    await page.saveItem();
    fixture.detectChanges();

    expect(snack.error).toHaveBeenCalled();
    expect([...page.fieldErrors().keys()]).toEqual(['host']);
    expect(page.fieldErrorText({ key: 'host' })).toBe('form.validation.serverRejected');
  });
});
