import { BreakpointObserver } from '@angular/cdk/layout';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from './configurable-crud-page-base';
import { configurableCrudTestingModule } from './configurable-crud-testing';
import { ApiService } from '../../../services/api.service';
import { defineCrud } from './define-crud';

const runs: { ids: string[]; rows: ConfigurableCrudRecord[] }[] = [];
let visible = true;

const config = defineCrud({
  endpoint: 'test/bulk-actions',
  uuidField: 'uuid',
  pageTitle: 'Bulk actions test',
  pageDescription: 'Bulk actions besides delete show the selection.',
  statusFilter: false,
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkActions: [
    {
      key: 'fix',
      label: 'Fix selected',
      icon: 'build',
      max: 2,
      visible: () => visible,
      run: (ids, rows) => {
        runs.push({ ids, rows });
        return true;
      },
    },
  ],
  initialValues: {},
  columns: [{ id: 'name', label: 'Name', field: 'name', kind: 'identity' }],
  fields: [],
});

@Component({
  selector: 'app-bulk-actions-test-page',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: './configurable-crud-page.html',
})
class BulkActionsTestPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}

describe('Configurable CRUD bulk actions', () => {
  async function render() {
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'delete']);
    api.get.and.resolveTo({
      data: {
        items: [
          { uuid: 'a', name: 'A' },
          { uuid: 'b', name: 'B' },
          { uuid: 'c', name: 'C' },
        ],
        total: 3,
      },
    });
    const snackbar = jasmine.createSpyObj('SnackbarService', [
      'success',
      'warning',
      'error',
      'info',
    ]);
    await TestBed.configureTestingModule(
      configurableCrudTestingModule({
        page: BulkActionsTestPage,
        api,
        snackbar,
        providers: [
          { provide: BreakpointObserver, useValue: { observe: () => of({ matches: false }) } },
        ],
      }),
    ).compileComponents();
    const fixture = TestBed.createComponent(BulkActionsTestPage);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, page: fixture.componentInstance, api, snackbar };
  }

  beforeEach(() => {
    runs.length = 0;
    visible = true;
  });

  it('shows the selection without bulk delete and runs the action on the selected rows', async () => {
    const { fixture, page, api } = await render();
    expect(page.bulkDeleteEnabled()).toBeFalse();
    expect(page.selectionEnabled()).toBeTrue();
    expect(page.displayedColumns()[0]).toBe('select');
    page.selectedUUIDs.set(new Set(['a', 'c']));
    fixture.detectChanges();
    const labels = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.filter-actions-start button'),
    ).map((button) => button.textContent ?? '');
    expect(labels.some((text) => text.includes('Fix selected'))).toBeTrue();
    expect(labels.some((text) => text.includes('Delete selected'))).toBeFalse();
    await page.runBulkAction(page.bulkActions()[0]);
    expect(runs.length).toBe(1);
    expect(runs[0].ids).toEqual(['a', 'c']);
    expect(runs[0].rows.map((row) => row['uuid'])).toEqual(['a', 'c']);
    expect(page.selectedCount()).toBe(0);
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('refuses a selection larger than the action limit', async () => {
    const { page, snackbar } = await render();
    page.selectedUUIDs.set(new Set(['a', 'b', 'c']));
    await page.runBulkAction(page.bulkActions()[0]);
    expect(runs.length).toBe(0);
    expect(snackbar.warning).toHaveBeenCalled();
    expect(page.selectedCount()).toBe(3);
  });

  it('hides the selection when no bulk action is visible', async () => {
    visible = false;
    const { page } = await render();
    expect(page.selectionEnabled()).toBeFalse();
    expect(page.displayedColumns()).not.toContain('select');
  });
});
