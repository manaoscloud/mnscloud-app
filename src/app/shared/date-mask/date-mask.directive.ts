import { Directive, ElementRef, HostListener, effect, inject, Renderer2 } from '@angular/core';

import { AppI18nService } from '../../services/app-i18n.service';
import {
  applyDateInputMask,
  dateInputPattern,
  formatDateInput,
  parseDateInput,
} from './date-input-format';

@Directive({
  selector: '[appDateMask]',
  standalone: true,
})
export class DateMaskDirective {
  private readonly elementRef = inject(ElementRef<HTMLInputElement>);
  private readonly renderer = inject(Renderer2);
  private readonly i18n = inject(AppI18nService);
  private previousLocale: string = this.i18n.language();

  constructor() {
    this.renderer.setAttribute(this.elementRef.nativeElement, 'inputmode', 'numeric');
    effect(() => this.applyLocale(this.i18n.language()));
  }

  @HostListener('input')
  onInput() {
    const input = this.elementRef.nativeElement;
    const masked = applyDateInputMask(input.value, this.i18n.language());
    if (masked !== input.value) this.renderer.setProperty(input, 'value', masked);
  }

  private applyLocale(locale: string): void {
    const input = this.elementRef.nativeElement;
    const previousValue = input.value;
    const previousDate = parseDateInput(previousValue, this.previousLocale);

    this.renderer.setAttribute(input, 'placeholder', dateInputPattern(locale).placeholder);
    if (previousDate) {
      this.renderer.setProperty(input, 'value', formatDateInput(previousDate, locale));
    }

    this.previousLocale = locale;
  }
}
