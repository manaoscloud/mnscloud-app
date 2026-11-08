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

const config = defineCrud({
  endpoint: 'test/bulk-rights',
  uuidField: 'uuid',
  pageTitle: 'Bulk delete rights test',
  pageDescription: 'Bulk delete follows the per-row delete right.',
  statusFilter: false,
  bulkDelete: true,
  canDeleteRow: (row) => Number(row['CanDelete']) === 1,
  initialValues: {},
  columns: [{ id: 'name', label: 'Name', field: 'name', kind: 'identity' }],
  fields: [],
});

@Component({
  selector: 'app-bulk-rights-test-page',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: './configurable-crud-page.html',
})
class BulkRightsTestPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}

describe('Configurable CRUD bulk delete rights', () => {
  async function render(items: ConfigurableCrudRecord[]) {
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'delete']);
    api.get.and.resolveTo({ data: { items, total: items.length } });
    api.delete.and.resolveTo({ data: { failed: [] } });
    const snackbar = jasmine.createSpyObj('SnackbarService', ['success', 'warning', 'error']);
    await TestBed.configureTestingModule(
      configurableCrudTestingModule({
        page: BulkRightsTestPage,
        api,
        snackbar,
        providers: [
          { provide: BreakpointObserver, useValue: { observe: () => of({ matches: false }) } },
        ],
      }),
    ).compileComponents();
    const fixture = TestBed.createComponent(BulkRightsTestPage);
    fixture.detectChanges();
    await fixture.whenStable();
    const page = fixture.componentInstance;
    spyOn(page as unknown as { confirm: () => Promise<boolean> }, 'confirm').and.resolveTo(true);
    return { page, api, snackbar };
  }

  it('sends only the rows the server lets the caller delete', async () => {
    const { page, api } = await render([
      { uuid: 'own', name: 'Own', CanDelete: 1 },
      { uuid: 'zone-default', name: 'Zone default', CanDelete: 0 },
    ]);
    page.selectedUUIDs.set(new Set(['own', 'zone-default']));
    await page.deleteSelectedItems();
    expect(api.delete).toHaveBeenCalledTimes(1);
    expect(api.delete.calls.mostRecent().args[1]).toEqual(
      jasmine.objectContaining({ ids: ['own'] }),
    );
  });

  it('sends nothing and warns when no selected row can be deleted', async () => {
    const { page, api, snackbar } = await render([
      { uuid: 'platform', name: 'Platform default', CanDelete: 0 },
    ]);
    page.selectedUUIDs.set(new Set(['platform']));
    await page.deleteSelectedItems();
    expect(api.delete).not.toHaveBeenCalled();
    expect(snackbar.warning).toHaveBeenCalled();
  });
});
