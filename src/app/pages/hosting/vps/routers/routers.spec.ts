import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { configurableCrudTestingModule } from '../../../../shared/crud/configurable-crud/configurable-crud-testing';
import { HostingVpsRoutersPage } from './routers';
import {
  ConfigurableCrudColumn,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';

describe('HostingVpsRoutersPage', () => {
  const api = {
    get: jasmine.createSpy('get').and.returnValue(of([])),
    post: jasmine.createSpy('post').and.returnValue(of({})),
    put: jasmine.createSpy('put').and.returnValue(of({})),
    delete: jasmine.createSpy('delete').and.returnValue(of({})),
  };
  const snackbar = {
    openSuccess: jasmine.createSpy('openSuccess'),
    openError: jasmine.createSpy('openError'),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule(
      configurableCrudTestingModule({
        page: HostingVpsRoutersPage,
        api,
        snackbar,
      }),
    ).compileComponents();
  });

  it('instantiates and configures HA column and actions', () => {
    const fixture = TestBed.createComponent(HostingVpsRoutersPage);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();

    const columns: ConfigurableCrudColumn[] = typeof component.columns === 'function' ? component.columns() : component.columns;
    const haCol = columns.find((c) => c.id === 'ha');
    expect(haCol).toBeDefined();
    expect(haCol?.label).toBe('High Availability');

    const rawActions = component.rowActions;
    const getActions = (row: Record<string, unknown>): readonly ConfigurableCrudRowAction[] => {
      if (typeof rawActions === 'function') {
        return rawActions(row);
      }
      return rawActions ?? [];
    };

    // engine 2, ha = 0: enable-ha should be visible, disable-ha hidden
    const standaloneRow = { zoneUUID: 'zone-123', engine: 2, ha: 0, size: 'S' };
    const standaloneActions = getActions(standaloneRow);
    const enableHa = standaloneActions.find((a) => a.key === 'enable-ha');
    const disableHa = standaloneActions.find((a) => a.key === 'disable-ha');

    expect(enableHa).toBeDefined();
    expect(disableHa).toBeDefined();
    expect(enableHa?.visible?.(standaloneRow)).toBeTrue();
    expect(disableHa?.visible?.(standaloneRow)).toBeFalse();

    // engine 2, ha = 1: enable-ha hidden, disable-ha visible
    const haRow = { zoneUUID: 'zone-123', engine: 2, ha: 1, size: 'S' };
    expect(enableHa?.visible?.(haRow)).toBeFalse();
    expect(disableHa?.visible?.(haRow)).toBeTrue();

    // engine 1: neither should be visible
    const legacyRow = { zoneUUID: 'zone-123', engine: 1, ha: 0, size: 'S' };
    expect(enableHa?.visible?.(legacyRow)).toBeFalse();
    expect(disableHa?.visible?.(legacyRow)).toBeFalse();

    // Endpoint resolution
    if (typeof enableHa?.request?.endpoint === 'function') {
      expect(enableHa.request.endpoint(standaloneRow)).toBe('hosting/vps/tenant-zones/zone-123/ha');
    }
    if (typeof disableHa?.request?.endpoint === 'function') {
      expect(disableHa.request.endpoint(haRow)).toBe('hosting/vps/tenant-zones/zone-123/ha');
    }
  });
});
