import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MNS_MENU } from './mns-menu';

@Component({
  imports: [MatMenuModule, MatIconModule, MNS_MENU],
  template: `
    <button type="button" [matMenuTriggerFor]="menu">Open</button>
    <mat-menu #menu="matMenu" class="mns-menu">
      <mns-menu-title hint="Ramal 2001">Actions</mns-menu-title>
      <mns-menu-search [(value)]="search" label="Search columns" />
      <button
        mat-menu-item
        mnsMenuItem
        type="button"
        selection="checkbox"
        keepOpen
        [checked]="visible()"
        (click)="visible.set(!visible())"
      >
        <mns-menu-label description="Always visible">Name</mns-menu-label>
      </button>
      <button mat-menu-item mnsMenuItem type="button" selection="radio" [checked]="false">
        <mns-menu-label
          >Compact rows
          <span mnsMenuDescription class="mns-menu-description">Projected detail</span>
        </mns-menu-label>
      </button>
      <button mat-menu-item mnsMenuItem type="button" tone="danger" (click)="deleted.set(true)">
        <mns-menu-label>Delete</mns-menu-label>
      </button>
    </mat-menu>
  `,
})
class MenuHost {
  readonly visible = signal(true);
  readonly deleted = signal(false);
  readonly search = signal('');
}

async function openMenu() {
  await TestBed.configureTestingModule({ imports: [MenuHost] }).compileComponents();
  const fixture = TestBed.createComponent(MenuHost);
  fixture.detectChanges();
  const trigger = fixture.debugElement.children[0].injector.get(MatMenuTrigger);
  trigger.openMenu();
  fixture.detectChanges();
  await fixture.whenStable();
  const panel = document.querySelector('.mat-mdc-menu-panel.mns-menu') as HTMLElement;
  const items = Array.from(panel.querySelectorAll<HTMLButtonElement>('[mat-menu-item]'));
  return { fixture, trigger, panel, items };
}

describe('Global mns-menu primitives', () => {
  afterEach(() =>
    document.querySelectorAll('.cdk-overlay-container').forEach((node) => node.remove()),
  );

  it('renders the shared shell, title hint, description and selection semantics', async () => {
    const { fixture, panel, items } = await openMenu();
    expect(panel.querySelector('.mns-menu-title')?.textContent).toContain('Actions');
    expect(panel.querySelector('.mns-menu-hint')?.textContent).toContain('Ramal 2001');

    const [column, density, remove] = items;
    expect(column.getAttribute('role')).toBe('menuitemcheckbox');
    expect(column.getAttribute('aria-checked')).toBe('true');
    expect(column.querySelector('.mns-menu-description')?.textContent).toContain('Always visible');
    expect(column.querySelector('.mns-menu-check')).not.toBeNull();

    expect(density.getAttribute('role')).toBe('menuitemradio');
    expect(density.getAttribute('aria-checked')).toBe('false');
    expect(density.querySelector('.mns-menu-check')).toBeNull();
    const projected = density.querySelector('.mns-menu-label-text > .mns-menu-description');
    expect(projected?.textContent).toContain('Projected detail');
    expect(density.querySelector('.mns-menu-label-primary')?.textContent).not.toContain(
      'Projected',
    );

    expect(remove.getAttribute('role')).toBe('menuitem');
    expect(remove.hasAttribute('aria-checked')).toBeFalse();
    expect(remove.classList).toContain('mns-menu-danger');
    fixture.destroy();
  });

  it('keeps the panel open for keepOpen items and closes it for actions', async () => {
    const { fixture, trigger, items } = await openMenu();
    items[0].click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(trigger.menuOpen).toBeTrue();
    expect(items[0].getAttribute('aria-checked')).toBe('false');
    expect(items[0].querySelector('.mns-menu-check')).toBeNull();

    items[2].click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.deleted()).toBeTrue();
    expect(trigger.menuOpen).toBeFalse();
    fixture.destroy();
  });

  it('keeps typing inside the search field but lets Escape reach the menu', async () => {
    const { fixture, trigger, panel } = await openMenu();
    const input = panel.querySelector('.mns-menu-search input') as HTMLInputElement;
    input.value = 'nam';
    input.dispatchEvent(new Event('input'));
    const letter = new KeyboardEvent('keydown', { key: 'n', bubbles: true });
    const stopLetter = spyOn(letter, 'stopPropagation').and.callThrough();
    input.dispatchEvent(letter);
    expect(stopLetter).toHaveBeenCalled();
    expect(fixture.componentInstance.search()).toBe('nam');

    (panel.querySelector('.mns-menu-title') as HTMLElement).click();
    fixture.detectChanges();
    expect(trigger.menuOpen).toBeTrue();

    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    expect(trigger.menuOpen).toBeFalse();
    fixture.destroy();
  });
});
