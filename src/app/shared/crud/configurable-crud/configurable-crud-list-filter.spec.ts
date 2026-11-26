import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiService } from '../../../services/api.service';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudListFilter,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from './configurable-crud-page-base';
import { configurableCrudTestingModule } from './configurable-crud-testing';
import { defineCrud } from './define-crud';

const listFilterTestConfig = defineCrud({
  endpoint: 'test/vps-plans',
  uuidField: 'uuid',
  pageTitle: 'VPS Plans',
  pageDescription: 'Test VPS plans list filter matching.',
  statusFilter: false,
  listFilters: [
    {
      key: 'providerFilter',
      label: 'Provider',
      paramKey: 'providerUUID',
      type: 'search-select',
    },
  ],
  initialValues: { name: '', providerUUID: '' },
  columns: [
    { id: 'name', label: 'Name', field: 'name', kind: 'identity' },
    {
      id: 'provider',
      label: 'Provider',
      kind: 'related',
      lookupKey: 'providerUUID',
      uuidField: 'HostingVpsProviderHvrUUID',
    },
  ],
  fields: [
    { key: 'name', label: 'Name', required: true, span: 1 },
    {
      key: 'providerUUID',
      source: 'HostingVpsProviderHvrUUID',
      payloadKey: 'providerUUID',
      label: 'Provider',
      type: 'search-select',
      required: true,
      quickCreate: false,
      quickCreateExemptReason: 'Test fixture.',
      span: 1,
    },
  ],
});

const mockRows: ConfigurableCrudRecord[] = [
  {
    uuid: 'plan-1',
    name: 'DO EUA Basic',
    HostingVpsProviderHvrUUID: '0344C432B18511F193D1BC2411DB6508',
  },
  {
    uuid: 'plan-2',
    name: 'Proxmox SP Micro',
    HostingVpsProviderHvrUUID: '7BAFE753B29811F193D1BC2411DB6508',
  },
];

const providerOptions: readonly ConfigurableCrudOption[] = [
  { value: '0344C432B18511F193D1BC2411DB6508', label: 'PRV-DIGITALOCEAN-SFO-2' },
  { value: '7BAFE753B29811F193D1BC2411DB6508', label: 'PRV-MNS-BR-SP-STP01-C01' },
];

@Component({
  selector: 'app-list-filter-test-page',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: './configurable-crud-page.html',
})
class ListFilterTestPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(listFilterTestConfig);
  }

  protected override async fetchItems(): Promise<ConfigurableCrudRecord[]> {
    return mockRows;
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'providerFilter' || key === 'providerUUID') return providerOptions;
    return [];
  }
}

describe('ConfigurableCrud list filter matching', () => {
  let api: jasmine.SpyObj<ApiService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'post', 'put', 'delete']);
    api.get.and.resolveTo({ data: { items: mockRows, total: 2 } });
    api.post.and.resolveTo({ data: {} });
    api.put.and.resolveTo({ data: {} });
    await TestBed.configureTestingModule(
      configurableCrudTestingModule({
        page: ListFilterTestPage,
        api,
        snackbar: jasmine.createSpyObj('SnackbarService', ['success', 'error', 'warning', 'info']),
      }),
    ).compileComponents();
  });

  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((el) => el.remove()));

  it('filters rows when filter key uses paramKey mapped to a database source field', async () => {
    const fixture = TestBed.createComponent(ListFilterTestPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const page = fixture.componentInstance;
    const filter = page.listFilters()[0] as ConfigurableCrudListFilter;
    expect(filter).toBeDefined();

    // Initially without filter, all rows are shown
    expect(page.filteredRows().length).toBe(2);

    // Apply filter for DigitalOcean (using lowercase hex)
    page.onListFilterChange(filter, '0344c432b18511f193d1bc2411db6508');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(page.filteredRows().length).toBe(1);
    expect(page.filteredRows()[0]['name']).toBe('DO EUA Basic');

    // Apply filter for Proxmox (with hyphens)
    page.onListFilterChange(filter, '7bafe753-b298-11f1-93d1-bc2411db6508');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(page.filteredRows().length).toBe(1);
    expect(page.filteredRows()[0]['name']).toBe('Proxmox SP Micro');

    // Clear filter
    page.clearSearchFilters();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(page.filteredRows().length).toBe(2);
  });
});
