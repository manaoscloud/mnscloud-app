import { Injectable, signal } from '@angular/core';
import { dialableNumber } from './phone-bridge';

/**
 * Click-to-call entry for shared components (global table `kind: 'phone'` columns). Has no
 * dependencies: the App phone dock registers itself here when the tenant has PhoneWeb.
 */
@Injectable({ providedIn: 'root' })
export class PhoneDialer {
  /** A phone is available to dial (tenant entitled and dock registered). */
  readonly available = signal(false);
  private handler: ((number: string) => void) | null = null;

  register(handler: ((number: string) => void) | null) {
    this.handler = handler;
  }

  canDial(value: unknown): boolean {
    return (
      this.available() && this.handler !== null && dialableNumber(String(value ?? '')) !== null
    );
  }

  dial(value: unknown) {
    const number = dialableNumber(String(value ?? ''));
    if (number && this.handler) this.handler(number);
  }
}
