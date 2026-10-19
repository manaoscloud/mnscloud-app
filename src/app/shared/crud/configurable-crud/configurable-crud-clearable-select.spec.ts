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
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from './configurable-crud-page-base';
import { defineCrud } from './define-crud';

const config = defineCrud({
  endpoint: 'test/clearable-items',
  uuidField: 'uuid',
  pageTitle: 'Items',
  pageDescription: 'Items used to test clearing optional relationship selects.',
  statusFilter: false,
  initialValues: { name: '', ownerUUID: '', planUUID: '', tagUUIDs: [] },
  columns: [{ id: 'name', label: 'Name', field: 'name', kind: 'identity' }],
  fields: [
    { key: 'name', label: 'Name', required: true, span: 1 },
    {
      key: 'ownerUUID',
      label: 'Owner',
      type: 'search-select',
      required: true,
      quickCreate: false,
      quickCreateExemptReason: 'Test fixture.',
      span: 1,
    },
    {
      key: 'planUUID',
      label: 'Plan',
      type: 'search-select',
      quickCreate: false,
      quickCreateExemptReason: 'Test fixture.',
      span: 1,
    },
    {
      key: 'tagUUIDs',
      label: 'Tags',
      type: 'search-select',
      multiple: true,
      quickCreate: false,
      quickCreateExemptReason: 'Test fixture.',
      span: 1,
    },
  ],
});

const onlyPlan: readonly ConfigurableCrudOption[] = [{ value: 'plan-1', label: 'Only plan' }];

@Component({
  selector: 'app-clearable-select-test-page',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: './configurable-crud-page.html',
})
class ClearableSelectTestPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  protected override lookupOptions(): readonly ConfigurableCrudOption[] {
    return onlyPlan;
  }
}

describe('Configurable CRUD optional relationship select', () => {
  let api: jasmine.SpyObj<ApiService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'post', 'put', 'delete']);
    api.get.and.resolveTo({ data: { items: [], total: 0 } });
    api.post.and.resolveTo({ data: {} });
    api.put.and.resolveTo({ data: {} });
    await TestBed.configureTestingModule({
      imports: [
        ClearableSelectTestPage,
        TranslocoTestingModule.forRoot({
          langs: { 'en-US': {} },
          translocoConfig: {
            availableLangs: ['en-US'],
            defaultLang: 'en-US',
            missingHandler: { logMissingKey: false },
          },
          preloadLangs: true,
        }),
      ],
      providers: [
        provideRouter([]),
        { provide: ApiService, useValue: api },
        {
          provide: SnackbarService,
          useValue: jasmine.createSpyObj('SnackbarService', [
            'success',
            'error',
            'warning',
            'info',
          ]),
        },
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

  async function render() {
    const fixture = TestBed.createComponent(ClearableSelectTestPage);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, page: fixture.componentInstance };
  }

  async function openPanel(
    fixture: { detectChanges(): void; whenStable(): Promise<unknown> },
    key: string,
  ) {
    document.querySelectorAll('.cdk-overlay-backdrop').forEach((el) => (el as HTMLElement).click());
    const host = document.querySelector(`.crud-form-dialog [data-field-key="${key}"]`)!;
    (host.querySelector('mat-select') as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    return document.querySelector('.mat-mdc-select-panel') as HTMLElement;
  }

  it('offers an empty choice only on optional single selects', async () => {
    const { fixture, page } = await render();
    page.startCreate();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(page.isFieldClearable(config.fields[2])).toBeTrue();
    expect(page.isFieldClearable(config.fields[1])).toBeFalse();
    expect(page.isFieldClearable(config.fields[3])).toBeFalse();

    const planPanel = await openPanel(fixture, 'planUUID');
    expect(planPanel.querySelector('.select-clear-option')?.textContent).toContain('No selection');
    expect(
      (await openPanel(fixture, 'ownerUUID')).querySelector('.select-clear-option'),
    ).toBeNull();
    expect((await openPanel(fixture, 'tagUUIDs')).querySelector('.select-clear-option')).toBeNull();
  });

  it('removes the only available option and saves the record without it', async () => {
    const { fixture, page } = await render();
    page.startCreate();
    page.setFieldValue('name', 'Alpha');
    page.setFieldValue('ownerUUID', 'plan-1');
    page.setFieldValue('planUUID', 'plan-1');
    fixture.detectChanges();
    await fixture.whenStable();

    const panel = await openPanel(fixture, 'planUUID');
    (panel.querySelector('.select-clear-option') as HTMLElement).click();
    fixture.detectChanges();
    expect(page.formValues()['planUUID']).toBe('');

    await page.saveItem();
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post.calls.mostRecent().args[1]).toEqual(
      jasmine.objectContaining({ planUUID: null }),
    );
  });

  it('clears a stored option when editing so the update removes it', async () => {
    const { fixture, page } = await render();
    page.startEdit({ uuid: 'item-1', name: 'Alpha', ownerUUID: 'plan-1', planUUID: 'plan-1' });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(page.formValues()['planUUID']).toBe('plan-1');

    const panel = await openPanel(fixture, 'planUUID');
    (panel.querySelector('.select-clear-option') as HTMLElement).click();
    fixture.detectChanges();

    await page.saveItem();
    expect(api.put).toHaveBeenCalledTimes(1);
    const body = api.put.calls.mostRecent().args[1] as ConfigurableCrudRecord;
    expect(Object.prototype.hasOwnProperty.call(body, 'planUUID')).toBeTrue();
    expect(body['planUUID']).toBeNull();
  });
});
