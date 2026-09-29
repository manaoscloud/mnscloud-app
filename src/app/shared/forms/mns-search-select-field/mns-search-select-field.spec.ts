import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { MnsSearchSelectFieldComponent } from './mns-search-select-field';

describe('Remote relationship dropdown accessibility', () => {
  it('keeps search enabled and page navigation separate from value selection', async () => {
    await TestBed.configureTestingModule({
      imports: [
        MnsSearchSelectFieldComponent,
        TranslocoTestingModule.forRoot({
          langs: {
            en: { Search: 'Search', 'Next page': 'Next page', 'Previous page': 'Previous page' },
          },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(MnsSearchSelectFieldComponent);
    fixture.componentRef.setInput('label', 'Tenant');
    fixture.componentRef.setInput('remoteSearch', true);
    fixture.componentRef.setInput('hasNext', true);
    fixture.componentRef.setInput('options', [{ value: 'saved', label: 'Saved tenant' }]);
    fixture.componentRef.setInput('value', 'saved');
    const searches = spyOn(fixture.componentInstance.searchChange, 'emit').and.callThrough();
    const pages = spyOn(fixture.componentInstance.pageChange, 'emit').and.callThrough();
    const selections = spyOn(fixture.componentInstance.valueChange, 'emit').and.callThrough();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.nativeElement.querySelector('mat-select').click();
    fixture.detectChanges();
    await fixture.whenStable();
    const panel = document.querySelector('.mat-mdc-select-panel')!;
    const search = panel.querySelector('input')!;
    // Material writes host attributes after rendering. The final accessible state
    // must still enable the input inside its non-selectable option container.
    expect(search.closest('[aria-disabled]')?.getAttribute('aria-disabled')).toBe('false');
    search.focus();
    expect(document.activeElement).toBe(search);
    search.value = 'remote tenant';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(searches).toHaveBeenCalledWith('remote tenant');
    const next = panel.querySelector<HTMLButtonElement>('button[aria-label="Next page"]')!;
    expect(next.disabled).toBeFalse();
    expect(next.closest('[aria-disabled="true"]')).toBeNull();
    next.click();
    expect(pages).toHaveBeenCalledOnceWith(1);
    expect(selections).not.toHaveBeenCalled();
    fixture.destroy();
  });
  it('opens suffix help without opening the dropdown or changing its value', async () => {
    await TestBed.configureTestingModule({
      imports: [
        MnsSearchSelectFieldComponent,
        TranslocoTestingModule.forRoot({
          langs: { en: { 'Help for': 'Help for', 'Close help': 'Close help' } },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(MnsSearchSelectFieldComponent);
    fixture.componentRef.setInput('label', 'Provider');
    fixture.componentRef.setInput('help', 'Choose an authorized provider.');
    fixture.componentRef.setInput('options', [{ value: 'saved', label: 'Saved provider' }]);
    fixture.componentRef.setInput('value', 'saved');
    const selections = spyOn(fixture.componentInstance.valueChange, 'emit');
    fixture.detectChanges();
    await fixture.whenStable();
    const help = fixture.nativeElement.querySelector('mns-field-help button') as HTMLButtonElement;
    expect(help.closest('.mat-mdc-form-field-icon-suffix')).not.toBeNull();
    help.focus();
    help.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    help.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.querySelector('.field-help-panel')?.textContent).toContain(
      'Choose an authorized provider.',
    );
    expect(document.querySelector('.mat-mdc-select-panel')).toBeNull();
    expect(selections).not.toHaveBeenCalled();
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(help);
    fixture.nativeElement.querySelector('mat-select').click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.querySelector('.mat-mdc-select-panel')).not.toBeNull();
    expect(fixture.componentInstance.value()).toBe('saved');
    fixture.destroy();
  });
});
