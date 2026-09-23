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
});
