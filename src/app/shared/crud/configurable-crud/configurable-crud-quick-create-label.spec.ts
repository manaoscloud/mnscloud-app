import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiService } from '../../../services/api.service';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from './configurable-crud-page-base';
import { configurableCrudTestingModule } from './configurable-crud-testing';
import { defineCrud } from './define-crud';

const config = defineCrud({
  endpoint: 'test/departments',
  uuidField: 'DepartmentUUID',
  pageTitle: 'Departments',
  pageDescription: 'Departments used to test the quick-create option label.',
  statusFilter: false,
  initialValues: { name: '' },
  columns: [{ id: 'name', label: 'Name', field: 'Name', kind: 'identity' }],
  fields: [{ key: 'name', source: 'Name', label: 'Name', required: true, span: 1 }],
});

@Component({
  selector: 'app-quick-create-label-test-page',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: './configurable-crud-page.html',
})
class QuickCreateLabelTestPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  option(response: unknown, payload: ConfigurableCrudRecord): Promise<ConfigurableCrudOption | null> {
    return this.quickCreateOption(response, payload);
  }
}

describe('Configurable CRUD quick-create option label', () => {
  let api: jasmine.SpyObj<ApiService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'post', 'put', 'delete']);
    api.get.and.callFake(async (url: string) => {
      if (url === 'test/departments/d1')
        return { data: { item: { DepartmentUUID: 'd1', Name: 'FINANCEIRO' } } } as never;
      return { data: { items: [], total: 0 } } as never;
    });
    await TestBed.configureTestingModule(
      configurableCrudTestingModule({
        page: QuickCreateLabelTestPage,
        api,
        snackbar: jasmine.createSpyObj('SnackbarService', ['success', 'error', 'warning', 'info']),
      }),
    ).compileComponents();
  });

  function page(): QuickCreateLabelTestPage {
    return TestBed.createComponent(QuickCreateLabelTestPage).componentInstance;
  }

  it('labels the option with the persisted value when the response carries only the id', async () => {
    const option = await page().option({ data: { DepartmentUUID: 'd1' } }, { name: 'financeiro' });

    expect(api.get).toHaveBeenCalledWith('test/departments/d1');
    expect(option?.value).toBe('d1');
    expect(option?.label).toBe('FINANCEIRO');
  });

  it('uses the response label without another request when it is present', async () => {
    const option = await page().option(
      { data: { DepartmentUUID: 'd2', Name: 'RH' } },
      { name: 'rh' },
    );

    expect(api.get).not.toHaveBeenCalledWith('test/departments/d2');
    expect(option?.label).toBe('RH');
  });

  it('falls back to the typed label when the record cannot be read', async () => {
    api.get.and.rejectWith(new Error('offline'));
    const option = await page().option({ data: { DepartmentUUID: 'd3' } }, { name: 'compras' });

    expect(option?.label).toBe('compras');
  });
});
