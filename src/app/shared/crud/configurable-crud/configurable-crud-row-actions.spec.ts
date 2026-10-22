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

const baseConfig = defineCrud({
  endpoint: 'test/row-actions',
  uuidField: 'uuid',
  pageTitle: 'Row actions test',
  pageDescription: 'Tests for inline and menu row actions.',
  statusFilter: false,
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  initialValues: {},
  columns: [{ id: 'name', label: 'Name', field: 'name', kind: 'identity' }],
  fields: [],
});

@Component({
  selector: 'app-row-actions-test-page',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: './configurable-crud-page.html',
})
class RowActionsTestPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  static config: ConfigurableCrudConfig = baseConfig;

  constructor() {
    super(RowActionsTestPage.config);
  }
}

describe('Configurable CRUD row actions', () => {
  async function render(
    config: ConfigurableCrudConfig,
    items: ConfigurableCrudRecord[] = [{ uuid: 'item-1', name: 'One' }],
  ): Promise<{ element: HTMLElement; page: RowActionsTestPage }> {
    RowActionsTestPage.config = config;
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get']);
    api.get.and.resolveTo({ data: { items, total: items.length } });
    await TestBed.configureTestingModule(
      configurableCrudTestingModule({
        page: RowActionsTestPage,
        api,
        snackbar: {},
        providers: [
          { provide: BreakpointObserver, useValue: { observe: () => of({ matches: false }) } },
        ],
      }),
    ).compileComponents();
    const fixture = TestBed.createComponent(RowActionsTestPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { element: fixture.nativeElement as HTMLElement, page: fixture.componentInstance };
  }

  it('renders an inline row action directly in the actions cell and omits the more_vert button when no other menu actions exist', async () => {
    const inlineSpy = jasmine.createSpy('inlineRun');
    const config: ConfigurableCrudConfig = {
      ...baseConfig,
      rowActions: [
        {
          key: 'subscribe',
          label: 'Subscribe',
          icon: 'add_shopping_cart',
          inline: true,
          run: inlineSpy,
        },
      ],
    };

    const { element } = await render(config);
    const actionsCell = element.querySelector('td.actions-col-cell .actions-col');
    expect(actionsCell).not.toBeNull();

    const buttons = actionsCell!.querySelectorAll('button');
    // Only the inline action button should be rendered (no edit, no delete, no more_vert)
    expect(buttons.length).toBe(1);
    expect(buttons[0].querySelector('mat-icon')?.textContent?.trim()).toBe('add_shopping_cart');
    expect(buttons[0].getAttribute('aria-label')).toBe('Subscribe');

    buttons[0].click();
    expect(inlineSpy).toHaveBeenCalledWith(jasmine.objectContaining({ uuid: 'item-1' }));
  });

  it('renders both the inline action button and the more_vert button when a menu action exists', async () => {
    const inlineSpy = jasmine.createSpy('inlineRun');
    const menuSpy = jasmine.createSpy('menuRun');
    const config: ConfigurableCrudConfig = {
      ...baseConfig,
      rowActions: [
        {
          key: 'composition',
          label: 'Package composition',
          icon: 'list',
          run: menuSpy,
        },
        {
          key: 'subscribe',
          label: 'Subscribe',
          icon: 'add_shopping_cart',
          inline: true,
          run: inlineSpy,
        },
      ],
    };

    const { element, page } = await render(config);
    const row = { uuid: 'item-1', name: 'One' };
    expect(page.inlineRowActions(row).map((a) => a.key)).toEqual(['subscribe']);
    expect(page.menuRowActions(row).map((a) => a.key)).toEqual(['composition']);

    const actionsCell = element.querySelector('td.actions-col-cell .actions-col');
    expect(actionsCell).not.toBeNull();

    const buttons = actionsCell!.querySelectorAll('button');
    // Inline button + more_vert button
    expect(buttons.length).toBe(2);
    expect(buttons[0].querySelector('mat-icon')?.textContent?.trim()).toBe('add_shopping_cart');
    expect(buttons[1].querySelector('mat-icon')?.textContent?.trim()).toBe('more_vert');
  });

  it('disables an inline action when disabledReason is set', async () => {
    const config: ConfigurableCrudConfig = {
      ...baseConfig,
      rowActions: [
        {
          key: 'subscribe',
          label: 'Subscribe',
          icon: 'add_shopping_cart',
          inline: true,
          disabledReason: () => 'Already subscribed',
        },
      ],
    };

    const { element } = await render(config);
    const button = element.querySelector(
      'td.actions-col-cell .actions-col button',
    ) as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.disabled).toBeTrue();
  });
});
