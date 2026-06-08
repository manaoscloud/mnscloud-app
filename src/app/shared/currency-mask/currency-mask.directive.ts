import {
  Directive,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  Renderer2,
  SimpleChanges,
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
export class CurrencyMaskDirective implements ControlValueAccessor, OnChanges {
  private elementRef = inject(ElementRef<HTMLInputElement>);
  private renderer = inject(Renderer2);
  private locale = inject(LOCALE_ID, { optional: true }) as string | null;

  @Input() appCurrencyMaskCurrency: string | null = null;

  private onChange: (value: number) => void = () => {};
  private onTouched: () => void = () => {};

  private formatter = this.buildFormatter();
  private decimalSeparator = this.getDecimalSeparator();
  private fractionDigits = this.formatter.resolvedOptions().maximumFractionDigits ?? 2;

  constructor() {
    this.renderer.setAttribute(this.elementRef.nativeElement, 'inputmode', 'decimal');
    this.renderer.setAttribute(this.elementRef.nativeElement, 'autocomplete', 'off');
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!changes['appCurrencyMaskCurrency']) return;
    this.refreshFormatConfig();
    const input = this.elementRef.nativeElement;
    const parsed = this.parseNumber(input.value);
    if (input.value && Number.isFinite(parsed)) {
      this.renderer.setProperty(input, 'value', this.formatNumber(parsed));
    }
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
    const locale = this.resolveLocale();
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
    const normalized = this.normalizeLocalizedInput(value);
    const parts = normalized.split(this.decimalSeparator);
    if (parts.length === 1) return normalized;
    const integer = parts[0] || '0';
    const fraction = parts.slice(1).join('');
    return `${integer}${this.decimalSeparator}${fraction.slice(0, this.fractionDigits)}`;
  }

  private parseNumber(value: string) {
    if (!value) return 0;
    const cleaned = this.normalizeLocalizedInput(value).replace(this.decimalSeparator, '.');
    return Number(cleaned);
  }

  private normalizeLocalizedInput(value: string) {
    const raw = value.replace(/[^\d.,]/g, '');
    if (!raw) return '';

    const decimal = this.detectDecimalSeparator(raw);
    if (!decimal) return raw.replace(/[^\d]/g, '');

    const decimalIndex = raw.lastIndexOf(decimal);
    const integer = raw.slice(0, decimalIndex).replace(/[^\d]/g, '');
    const fraction = raw.slice(decimalIndex + 1).replace(/[^\d]/g, '');
    return `${integer || '0'}${this.decimalSeparator}${fraction}`;
  }

  private detectDecimalSeparator(value: string) {
    const commaIndex = value.lastIndexOf(',');
    const dotIndex = value.lastIndexOf('.');

    if (commaIndex === -1 && dotIndex === -1) return '';
    if (commaIndex !== -1 && dotIndex !== -1) return commaIndex > dotIndex ? ',' : '.';

    const separator = commaIndex !== -1 ? ',' : '.';
    const index = commaIndex !== -1 ? commaIndex : dotIndex;
    const fractionLength = value.slice(index + 1).replace(/[^\d]/g, '').length;

    if (fractionLength === 0) return separator;
    if (separator === this.decimalSeparator && fractionLength <= this.fractionDigits) {
      return separator;
    }
    if (fractionLength <= this.fractionDigits) return separator;
    return '';
  }

  private getDecimalSeparator() {
    const locale = this.resolveLocale();
    const parts = new Intl.NumberFormat(locale).formatToParts(1.1);
    return parts.find((part) => part.type === 'decimal')?.value ?? '.';
  }

  private refreshFormatConfig() {
    this.formatter = this.buildFormatter();
    this.decimalSeparator = this.getDecimalSeparator();
    this.fractionDigits = this.formatter.resolvedOptions().maximumFractionDigits ?? 2;
  }

  private resolveLocale() {
    const currency = this.appCurrencyMaskCurrency?.trim().toUpperCase();
    const currencyLocale: Record<string, string> = {
      BRL: 'pt-BR',
      EUR: 'de-DE',
      GBP: 'en-GB',
      USD: 'en-US',
    };

    return (
      (currency ? currencyLocale[currency] : null) ||
      this.locale ||
      (typeof navigator !== 'undefined' ? navigator.language : 'en-US')
    );
  }
}
