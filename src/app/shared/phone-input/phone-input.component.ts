import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostBinding,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NgControl } from '@angular/forms';
import { MatFormFieldControl } from '@angular/material/form-field';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-phone-input',
  standalone: true,
  templateUrl: './phone-input.component.html',
  styleUrls: ['./phone-input.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: MatFormFieldControl,
      useExisting: PhoneInputComponent,
    },
  ],
})
export class PhoneInputComponent
  implements ControlValueAccessor, MatFormFieldControl<string> {
  ngControl = inject(NgControl, { optional: true, self: true });

  static nextId = 0;

  readonly stateChanges = new Subject<void>();
  readonly controlType = 'app-phone-input';
  @HostBinding() id = `app-phone-input-${PhoneInputComponent.nextId++}`;
  @HostBinding('class.phone-input-floating') get floatingClass() {
    return this.shouldLabelFloat;
  }

  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly placeholderInput = input('', { alias: 'placeholder' });
  readonly requiredInput = input(false, { alias: 'required' });
  readonly disabledInput = input(false, { alias: 'disabled' });
  readonly valueInput = input<string | null>(null, { alias: 'value' });
  readonly valueChange = output<string>();
  private readonly disabledState = signal(false);

  get placeholder() {
    return this.placeholderInput();
  }

  get required() {
    return this.requiredInput();
  }

  get disabled() {
    return this.disabledInput() || this.disabledState();
  }

  focused = false;
  touched = false;

  private _value = '';

  get value(): string {
    return this._value;
  }
  set value(val: string) {
    this._value = val;
    this.stateChanges.next();
  }

  get empty(): boolean {
    return !this._value;
  }

  get shouldLabelFloat(): boolean {
    return this.focused || !this.empty;
  }

  get errorState(): boolean {
    return !!this.ngControl && !!this.ngControl.invalid && this.touched;
  }

  userAriaDescribedBy = '';

  onChange = (_: any) => {};
  onTouched = () => {};

  constructor() {
    if (this.ngControl) {
      this.ngControl.valueAccessor = this;
    }

    effect(() => {
      const nextValue = this.normalize(this.valueInput() ?? '');
      if (nextValue !== this.value) {
        this.value = nextValue;
      }
    });
  }

  private readonly cleanupOnDestroy = inject(DestroyRef).onDestroy(() => {
    this.stateChanges.complete();
  
  });

  setDescribedByIds(ids: string[]) {
    this.userAriaDescribedBy = ids.join(' ');
  }

  onContainerClick() {
    const input = this.elementRef.nativeElement.querySelector('input');
    input?.focus();
  }

  writeValue(value: string | null): void {
    this.value = this.normalize(value ?? '');
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabledState.set(isDisabled);
    this.stateChanges.next();
  }

  handleInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const normalized = this.normalize(input.value);
    if (input.value !== normalized) {
      input.value = normalized;
    }
    this.value = normalized;
    this.onChange(normalized);
    this.valueChange.emit(normalized);
  }

  onFocusIn() {
    this.focused = true;
    this.stateChanges.next();
  }

  onFocusOut() {
    this.focused = false;
    this.touched = true;
    this.onTouched();
    this.stateChanges.next();
  }

  markTouched() {
    this.touched = true;
    this.onTouched();
    this.stateChanges.next();
  }

  private normalize(value: string) {
    return value.replace(/\D/g, '').slice(0, 15);
  }
}
