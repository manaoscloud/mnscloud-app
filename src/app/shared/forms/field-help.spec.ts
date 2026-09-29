import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { FieldHelpComponent } from './field-help';

describe('Shared contextual field help', () => {
  it('opens escaped guidance, traps focus and closes on Escape without propagating to the form', async () => {
    await TestBed.configureTestingModule({
      imports: [
        FieldHelpComponent,
        TranslocoTestingModule.forRoot({
          langs: { en: { 'Help for': 'Help for', 'Close help': 'Close help' } },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(FieldHelpComponent);
    fixture.componentRef.setInput('label', 'TTL');
    fixture.componentRef.setInput('text', '<img src=x onerror=alert(1)> is plain text');
    fixture.detectChanges();
    await fixture.whenStable();
    const trigger = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    trigger.focus();
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const panel = document.querySelector('.field-help-panel')!;
    expect(panel.getAttribute('aria-label')).toBe('Help for: TTL');
    expect(panel.querySelector('img')).toBeNull();
    expect(panel.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(panel.contains(document.activeElement)).toBeTrue();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    const stop = spyOn(escape, 'stopPropagation').and.callThrough();
    document.activeElement!.dispatchEvent(escape);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(stop).toHaveBeenCalled();
    expect(escape.defaultPrevented).toBeTrue();
    expect(document.querySelector('.field-help-panel')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    fixture.destroy();
  });
});
