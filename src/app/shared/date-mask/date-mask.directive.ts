import { Directive, ElementRef, HostListener, inject, Renderer2 } from '@angular/core';
import { MAT_DATE_LOCALE } from '@angular/material/core';

type DatePart = 'day' | 'month' | 'year';

@Directive({
  selector: '[appDateMask]',
  standalone: true,
})
export class DateMaskDirective {
  private elementRef = inject(ElementRef<HTMLInputElement>);
  private renderer = inject(Renderer2);
  private locale = inject(MAT_DATE_LOCALE, { optional: true }) as string | null;

  private cachedPattern?: {
    order: DatePart[];
    separator: string;
    totalDigits: number;
  };

  constructor() {
    this.renderer.setAttribute(this.elementRef.nativeElement, 'inputmode', 'numeric');
  }

  @HostListener('input')
  onInput() {
    const input = this.elementRef.nativeElement;
    const digits = input.value.replace(/\D/g, '');
    const pattern = this.getPattern();
    const sizes: Record<DatePart, number> = { day: 2, month: 2, year: 4 };

    let out = '';
    let pos = 0;

    pattern.order.forEach((part, index) => {
      const size = sizes[part];
      const chunk = digits.slice(pos, pos + size);
      if (!chunk) return;
      out += chunk;
      pos += chunk.length;
      if (chunk.length === size && index < pattern.order.length - 1) {
        out += pattern.separator;
      }
    });

    if (out !== input.value) {
      this.renderer.setProperty(input, 'value', out);
    }
  }

  private getPattern() {
    if (this.cachedPattern) return this.cachedPattern;
    const locale = this.locale || (typeof navigator !== 'undefined' ? navigator.language : 'en-US');
    const sample = new Date(2001, 10, 22);
    const parts = new Intl.DateTimeFormat(locale).formatToParts(sample);
    const order = parts
      .filter((p) => p.type === 'day' || p.type === 'month' || p.type === 'year')
      .map((p) => p.type as DatePart);
    const separator = parts.find((p) => p.type === 'literal')?.value ?? '/';
    const totalDigits = order.reduce((sum, part) => sum + (part === 'year' ? 4 : 2), 0);

    this.cachedPattern = {
      order: order.length ? order : ['month', 'day', 'year'],
      separator,
      totalDigits,
    };
    return this.cachedPattern;
  }
}
