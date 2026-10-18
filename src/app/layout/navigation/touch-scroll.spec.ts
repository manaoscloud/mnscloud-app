import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_TOOLTIP_DEFAULT_OPTIONS, MatTooltipModule } from '@angular/material/tooltip';

// A finger drag that starts on a tooltip trigger (sidebar resources, table cells) must still scroll
// the list on iOS/Android: MatTooltip writes an inline `touch-action: none` on touch platforms and
// the global `src/styles/_touch-scroll.scss` rule restores native panning (app.md "Touch Scroll
// Baseline").
@Component({
  imports: [MatTooltipModule],
  template: `
    <div class="sidenav-scroll" style="height: 80px; overflow-y: auto">
      <button type="button" class="menu-item root-item">Module</button>
      <button type="button" class="menu-item child-item" matTooltip="/erp/resource">
        Resource
      </button>
      <button
        type="button"
        class="menu-item child-item"
        matTooltip="/erp/other"
        matTooltipTouchGestures="off"
      >
        Other
      </button>
    </div>
  `,
})
class TouchScrollHost {}

describe('Touch scroll on tooltip triggers', () => {
  it('keeps native panning on every tooltip trigger of a touch platform', async () => {
    await TestBed.configureTestingModule({
      imports: [TouchScrollHost],
      // Simulates iOS/Android: no hover capability, so MatTooltip takes its touch path.
      providers: [
        { provide: MAT_TOOLTIP_DEFAULT_OPTIONS, useValue: { detectHoverCapability: () => false } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(TouchScrollHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const [module, resource, other] = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    );

    // Material still disables native gestures inline on the default trigger...
    expect(resource.style.touchAction).toBe('none');
    // ...but the global rule wins, so the drag scrolls exactly as it does on a module row.
    expect(getComputedStyle(resource).touchAction).toBe('manipulation');
    expect(getComputedStyle(module).touchAction).toBe('auto');
    // Sidebar entries opt out of touch tooltips entirely.
    expect(other.style.touchAction).toBe('');
    expect(getComputedStyle(other).touchAction).toBe('manipulation');
  });
});
