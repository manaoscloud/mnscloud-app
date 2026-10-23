import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiService } from '../../../services/api.service';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from './configurable-crud-page-base';
import { configurableCrudTestingModule } from './configurable-crud-testing';
import { defineCrud } from './define-crud';

const config = defineCrud({
  endpoint: 'test/migrations',
  uuidField: 'uuid',
  pageTitle: 'Migrations',
  pageDescription: 'Migrations used to test preselected and excluded relation options.',
  statusFilter: false,
  initialValues: { memberUUIDs: [], targetUUID: '' },
  columns: [{ id: 'uuid', label: 'Name', field: 'uuid', kind: 'identity' }],
  fields: [
    {
      key: 'memberUUIDs',
      label: 'Members',
      type: 'search-select',
      multiple: true,
      autoSelectAll: true,
      remoteLookup: { endpoint: 'test/members', uuidField: 'uuid', labelField: 'name' },
      quickCreate: false,
      quickCreateExemptReason: 'Test fixture.',
      span: 2,
    },
    {
      key: 'targetUUID',
      label: 'Target',
      type: 'search-select',
      remoteLookup: {
        endpoint: 'test/targets?status=1',
        uuidField: 'uuid',
        labelField: 'name',
        exclude: ['source'],
      },
      quickCreate: false,
      quickCreateExemptReason: 'Test fixture.',
      span: 2,
    },
  ],
});

@Component({
  selector: 'app-auto-select-all-test-page',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: './configurable-crud-page.html',
})
class AutoSelectAllTestPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}

describe('Configurable CRUD autoSelectAll and lookup exclude', () => {
  let api: jasmine.SpyObj<ApiService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'post', 'put', 'delete']);
    api.get.and.callFake(async (url: string) => {
      if (url.startsWith('test/members'))
        return {
          data: {
            items: [
              { uuid: 'm1', name: 'Alpha' },
              { uuid: 'm2', name: 'Beta' },
            ],
            total: 2,
          },
        } as never;
      if (url.startsWith('test/targets'))
        return {
          data: {
            items: [
              { uuid: 'source', name: 'Source' },
              { uuid: 't1', name: 'Target' },
            ],
            total: 2,
          },
        } as never;
      return { data: { items: [], total: 0 } } as never;
    });
    await TestBed.configureTestingModule(
      configurableCrudTestingModule({
        page: AutoSelectAllTestPage,
        api,
        snackbar: jasmine.createSpyObj('SnackbarService', ['success', 'error', 'warning', 'info']),
      }),
    ).compileComponents();
  });

  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((el) => el.remove()));

  async function startCreate() {
    const fixture = TestBed.createComponent(AutoSelectAllTestPage);
    fixture.detectChanges();
    await fixture.whenStable();
    const page = fixture.componentInstance;
    page.startCreate();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    return page;
  }

  it('selects every option of a multiple relation with readable labels on create', async () => {
    const page = await startCreate();

    expect(page.formValues()['memberUUIDs']).toEqual(['m1', 'm2']);
    expect(api.get).toHaveBeenCalledWith('test/members?limit=200&offset=0&search=');
    expect(page.fieldOptions(config.fields[0]).map((option) => option.label)).toEqual([
      'Alpha',
      'Beta',
    ]);
  });

  it('keeps an unticked option out of the selection', async () => {
    const page = await startCreate();
    page.setFieldValue('memberUUIDs', ['m2']);

    expect(page.formValues()['memberUUIDs']).toEqual(['m2']);
  });

  it('never offers an excluded relation value', async () => {
    const page = await startCreate();

    expect(page.fieldOptions(config.fields[1]).map((option) => option.value)).toEqual(['t1']);
  });
});
