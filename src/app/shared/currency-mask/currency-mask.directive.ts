import {
  Directive,
  ElementRef,
  HostListener,
  Renderer2,
  forwardRef,
  inject,
} from '@angular/core';
import { LOCALE_ID } from '@angular/core';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';

@Directive({
  selector: '[appCurrencyMask]',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CurrencyMaskDirective),
      multi: true,
    },
  ],
})
export class CurrencyMaskDirective implements ControlValueAccessor {
  private elementRef = inject(ElementRef<HTMLInputElement>);
  private renderer = inject(Renderer2);
  private locale = inject(LOCALE_ID, { optional: true }) as string | null;

  private onChange: (value: number) => void = () => {};
  private onTouched: () => void = () => {};

  private formatter = this.buildFormatter();
  private decimalSeparator = this.getDecimalSeparator();
  private groupSeparator = this.getGroupSeparator();
  private fractionDigits = this.formatter.resolvedOptions().maximumFractionDigits ?? 2;

  constructor() {
    this.renderer.setAttribute(this.elementRef.nativeElement, 'inputmode', 'decimal');
    this.renderer.setAttribute(this.elementRef.nativeElement, 'autocomplete', 'off');
  }

  writeValue(value: number | null) {
    const input = this.elementRef.nativeElement;
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      this.renderer.setProperty(input, 'value', '');
      return;
    }
    this.renderer.setProperty(input, 'value', this.formatNumber(Number(value)));
  }

  registerOnChange(fn: (value: number) => void) {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void) {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean) {
    this.renderer.setProperty(this.elementRef.nativeElement, 'disabled', isDisabled);
  }

  @HostListener('input')
  onInput() {
    const input = this.elementRef.nativeElement;
    const cleaned = this.cleanInput(input.value);
    if (cleaned !== input.value) {
      this.renderer.setProperty(input, 'value', cleaned);
    }
    const parsed = this.parseNumber(cleaned);
    this.onChange(Number.isFinite(parsed) ? parsed : 0);
  }

  @HostListener('blur')
  onBlur() {
    const input = this.elementRef.nativeElement;
    const parsed = this.parseNumber(input.value);
    if (!Number.isFinite(parsed) || parsed === 0) {
      this.renderer.setProperty(input, 'value', input.value ? this.formatNumber(0) : '');
    } else {
      this.renderer.setProperty(input, 'value', this.formatNumber(parsed));
    }
    this.onTouched();
  }

  private buildFormatter() {
    const locale = this.locale || (typeof navigator !== 'undefined' ? navigator.language : 'en-US');
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  private formatNumber(value: number) {
    return this.formatter.format(value);
  }

  private cleanInput(value: string) {
    if (!value) return '';
    const digits = value.replace(new RegExp(`[^0-9${this.escape(this.decimalSeparator)}]`, 'g'), '');
    const normalized = digits.replace(/\./g, this.decimalSeparator).replace(/,/g, this.decimalSeparator);
    const parts = normalized.split(this.decimalSeparator);
    if (parts.length === 1) return parts[0];
    const integer = parts[0];
    const fraction = parts.slice(1).join('');
    return `${integer}${this.decimalSeparator}${fraction.slice(0, this.fractionDigits)}`;
  }

  private parseNumber(value: string) {
    if (!value) return 0;
    const cleaned = value
      .replace(new RegExp(`\\${this.groupSeparator}`, 'g'), '')
      .replace(this.decimalSeparator, '.')
      .replace(/[^\d.]/g, '');
    return Number(cleaned);
  }

  private getDecimalSeparator() {
    const locale = this.locale || (typeof navigator !== 'undefined' ? navigator.language : 'en-US');
    const parts = new Intl.NumberFormat(locale).formatToParts(1.1);
    return parts.find((part) => part.type === 'decimal')?.value ?? '.';
  }

  private getGroupSeparator() {
    const locale = this.locale || (typeof navigator !== 'undefined' ? navigator.language : 'en-US');
    const parts = new Intl.NumberFormat(locale).formatToParts(1000);
    return parts.find((part) => part.type === 'group')?.value ?? ',';
  }

  private escape(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

}
