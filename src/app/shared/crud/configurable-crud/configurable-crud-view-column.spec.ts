import { BreakpointObserver } from '@angular/cdk/layout';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from './configurable-crud-page-base';
import { configurableCrudTestingModule } from './configurable-crud-testing';
import { ApiService } from '../../../services/api.service';
import { defineCrud } from './define-crud';

const editableConfig = defineCrud({
  endpoint: 'test/view-column',
  uuidField: 'uuid',
  pageTitle: 'Items',
  pageDescription: 'Items used to test the table view column.',
  statusFilter: false,
  initialValues: {},
  columns: [{ id: 'name', label: 'Name', field: 'name', kind: 'identity' }],
  fields: [],
});

const listOnlyConfig: ConfigurableCrudConfig = {
  ...editableConfig,
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
};

@Component({
  selector: 'app-view-column-test-page',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: './configurable-crud-page.html',
})
class ViewColumnTestPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  static config = listOnlyConfig;

  constructor() {
    super(ViewColumnTestPage.config);
  }
}

describe('Configurable CRUD table view column', () => {
  async function render(config: ConfigurableCrudConfig): Promise<HTMLElement> {
    ViewColumnTestPage.config = config;
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get']);
    api.get.and.resolveTo({ data: { items: [{ uuid: 'item-1', name: 'One' }], total: 1 } });
    await TestBed.configureTestingModule(
      configurableCrudTestingModule({
        page: ViewColumnTestPage,
        api,
        snackbar: {},
        // Desktop table layout regardless of the test browser width.
        providers: [
          { provide: BreakpointObserver, useValue: { observe: () => of({ matches: false }) } },
        ],
      }),
    ).compileComponents();
    const fixture = TestBed.createComponent(ViewColumnTestPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('keeps the tune button in a narrow trailing header column without row actions', async () => {
    const element = await render(listOnlyConfig);
    const header = element.querySelector('th.actions-col-header');

    expect(element.querySelector('.crud-card-toolbar')).toBeNull();
    expect(header?.classList).toContain('view-only-col');
    expect(header?.querySelector('.crud-view-button')).not.toBeNull();
    expect(header?.textContent).not.toContain('Actions');
    expect(element.querySelector('td.actions-col-cell .actions-col')).toBeNull();
  });

  it('labels the trailing column Actions when rows have actions', async () => {
    const element = await render(editableConfig);
    const header = element.querySelector('th.actions-col-header');

    expect(header?.classList).not.toContain('view-only-col');
    expect(header?.textContent).toContain('Actions');
    expect(header?.querySelector('.crud-view-button')).not.toBeNull();
  });
});
