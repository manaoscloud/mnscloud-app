import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { applyDashboardLayout, DashboardLayoutDialogComponent } from './dashboard-layout-dialog';

describe('Dashboard layout', () => {
  const tabs = ['voip', 'support', 'hosting'].map((key) => ({ key }));

  it('orders saved tabs first, keeps new tabs in the default order and hides tabs', () => {
    const { ordered, visible } = applyDashboardLayout([...tabs, { key: 'crm' }], {
      order: ['hosting', 'voip'],
      hidden: ['voip', 'unknown'],
    });
    expect(ordered.map((tab) => tab.key)).toEqual(['hosting', 'voip', 'support', 'crm']);
    expect(visible.map((tab) => tab.key)).toEqual(['hosting', 'support', 'crm']);
  });

  it('keeps the default order for an empty layout', () => {
    const { ordered, visible } = applyDashboardLayout(tabs, { order: [], hidden: [] });
    expect(ordered).toEqual(tabs);
    expect(visible).toEqual(tabs);
  });

  describe('dialog', () => {
    let close: jasmine.Spy;
    let dialog: DashboardLayoutDialogComponent;

    beforeEach(() => {
      close = jasmine.createSpy('close');
      TestBed.configureTestingModule({
        providers: [
          {
            provide: MAT_DIALOG_DATA,
            useValue: {
              tabs: tabs.map((tab) => ({ key: tab.key, label: `home.tab.${tab.key}` })),
              hidden: ['support'],
            },
          },
          { provide: MatDialogRef, useValue: { close } },
        ],
      });
      dialog = TestBed.runInInjectionContext(() => new DashboardLayoutDialogComponent());
    });

    afterEach(() => TestBed.resetTestingModule());

    it('moves, shows and hides tabs and saves the full order', () => {
      dialog.move(2, -1);
      dialog.move(0, -1);
      dialog.setVisible('support', true);
      dialog.setVisible('voip', false);
      dialog.save();
      expect(close).toHaveBeenCalledWith({
        order: ['voip', 'hosting', 'support'],
        hidden: ['voip'],
      });
    });

    it('resets to the default layout or cancels without a result', () => {
      dialog.reset();
      expect(close).toHaveBeenCalledWith({ order: [], hidden: [] });
      dialog.cancel();
      expect(close).toHaveBeenCalledWith();
    });
  });
});
