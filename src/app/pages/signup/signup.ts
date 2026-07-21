import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  viewChild,
  afterNextRender,
} from '@angular/core';

import { FormField, email, form, minLength, pattern, required } from '@angular/forms/signals';
import { Router, RouterModule } from '@angular/router';

// Angular Material
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';

import { ApiService } from '../../services/api.service';
import { SnackbarService } from '../../services/snackbar.service';
import { PhoneInputComponent } from '../../shared/phone-input/phone-input.component';
import { DateMaskDirective } from '../../shared/date-mask/date-mask.directive';

type SignupPolicy = {
  captchaEnabled: boolean;
  captchaProvider: 'turnstile' | 'hcaptcha' | null;
  captchaSiteKey: string | null;
};

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [
    FormField,
    RouterModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDatepickerModule,
    MatButtonModule,
    PhoneInputComponent,
    DateMaskDirective,
  ],
  templateUrl: './signup.html',
  styleUrls: ['./signup.scss'],
})
export class Signup {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly snack = inject(SnackbarService);
  private readonly destroyRef = inject(DestroyRef);

  readonly captchaContainer = viewChild<ElementRef<HTMLDivElement>>('captchaContainer');

  readonly formModel = signal({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    dateBirth: null as Date | null,
    password: '',
  });

  readonly form = form(this.formModel, (field) => {
    required(field.firstName);
    minLength(field.firstName, 2);
    required(field.lastName);
    minLength(field.lastName, 2);
    required(field.phone);
    pattern(field.phone, /^\d{8,15}$/);
    required(field.email);
    email(field.email);
    required(field.dateBirth);
    required(field.password);
    minLength(field.password, 6);
  });

  readonly showPassword = signal(false);
  readonly isLoading = signal(false);
  readonly apiError = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly emailError = computed(() => {
    const value = this.formModel().email.trim();
    if (!value) return 'You must enter a value';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Not a valid email';
    return '';
  });
  private readonly signupPolicyDefault: SignupPolicy = {
    captchaEnabled: false,
    captchaProvider: null,
    captchaSiteKey: null,
  };
  private readonly signupPolicyResource = resource({
    defaultValue: this.signupPolicyDefault,
    loader: () => this.fetchSignupPolicy(),
  });
  readonly signupPolicy = computed(() => this.signupPolicyResource.value());
  readonly captchaToken = signal<string | null>(null);
  private redirectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly captchaPollTimers = new Set<ReturnType<typeof setInterval>>();

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.clearRedirectTimer();
      this.clearCaptchaPollTimers();
    });
  }

  private readonly applySignupPolicy = effect(() => {
    this.signupPolicy();
    queueMicrotask(() => void this.renderCaptcha());
  });

  private readonly afterViewReady = afterNextRender(() => {
    queueMicrotask(() => void this.renderCaptcha());
  });

  get canSubmit(): boolean {
    const policy = this.signupPolicy();
    const captchaReady = !policy.captchaEnabled || !!this.captchaToken();
    return this.form().valid() && captchaReady && !this.isLoading();
  }

  async onSubmit(event?: Event) {
    event?.preventDefault();

    if (!this.canSubmit) return;

    this.isLoading.set(true);
    this.apiError.set(null);
    this.successMessage.set(null);

    try {
      const value = this.formModel();

      const dateBirthStr =
        value.dateBirth instanceof Date
          ? value.dateBirth.toISOString().substring(0, 10)
          : (value.dateBirth ?? '');

      const result = await this.api.post<any>('auth/signup', {
        firstName: value.firstName,
        lastName: value.lastName,
        phone: value.phone,
        email: value.email,
        password: value.password,
        dateBirth: dateBirthStr,
        captchaToken: this.captchaToken(),
      });

      if (!result?.message) {
        throw new Error('Invalid API response.');
      }

      const message =
        result?.message ?? 'Account created. Check your email to verify your account.';
      this.successMessage.set(message);
      this.snack.success(message);
      this.formModel.set({
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        dateBirth: null,
        password: '',
      });
      this.captchaToken.set(null);
      await this.renderCaptcha(true);
      this.scheduleRedirect();
    } catch (err: any) {
      const msg = err?.error?.error || err?.message || 'Registration failed.';
      this.apiError.set(msg);
      this.snack.error(msg);
    }

    this.isLoading.set(false);
  }

  private scheduleRedirect() {
    this.clearRedirectTimer();
    this.redirectTimer = setTimeout(() => {
      this.redirectTimer = null;
      void this.router.navigate(['/signin']);
    }, 2500);
  }

  private clearRedirectTimer() {
    if (!this.redirectTimer) return;
    clearTimeout(this.redirectTimer);
    this.redirectTimer = null;
  }

  togglePassword(event?: MouseEvent) {
    this.showPassword.set(!this.showPassword());
    event?.stopPropagation();
  }

  private async fetchSignupPolicy(): Promise<SignupPolicy> {
    try {
      const result = await this.api.get<any>('auth/signup/policy');
      const data = result?.data ?? {};
      return {
        captchaEnabled: data.captchaEnabled === true,
        captchaProvider:
          data.captchaProvider === 'turnstile' || data.captchaProvider === 'hcaptcha'
            ? data.captchaProvider
            : null,
        captchaSiteKey: typeof data.captchaSiteKey === 'string' ? data.captchaSiteKey : null,
      };
    } catch {
      return this.signupPolicyDefault;
    }
  }

  private async renderCaptcha(forceReset = false) {
    const policy = this.signupPolicy();
    const container = this.captchaContainer()?.nativeElement;
    if (!policy.captchaEnabled || !policy.captchaProvider || !policy.captchaSiteKey || !container) {
      return;
    }

    if (forceReset) {
      container.innerHTML = '';
    }

    if (container.dataset['rendered'] === 'true' && !forceReset) return;

    const api = await this.loadCaptchaApi(policy.captchaProvider);
    container.innerHTML = '';
    container.dataset['rendered'] = 'true';

    const options = {
      sitekey: policy.captchaSiteKey,
      callback: (token: string) => this.captchaToken.set(token),
      'expired-callback': () => this.captchaToken.set(null),
      'error-callback': () => this.captchaToken.set(null),
      theme: 'dark',
    };

    api.render(container, options);
  }

  private loadCaptchaApi(provider: 'turnstile' | 'hcaptcha'): Promise<any> {
    const globalName = provider === 'turnstile' ? 'turnstile' : 'hcaptcha';
    const existing = (window as any)[globalName];
    if (existing?.render) return Promise.resolve(existing);

    const scriptId = `mnscloud-${provider}-captcha`;
    const existingScript = document.getElementById(scriptId);
    if (existingScript) {
      return new Promise((resolve, reject) => {
        let attempts = 0;
        const timer = window.setInterval(() => {
          const loaded = (window as any)[globalName];
          if (loaded?.render) {
            window.clearInterval(timer);
            this.captchaPollTimers.delete(timer);
            resolve(loaded);
            return;
          }
          attempts += 1;
          if (attempts >= 100) {
            window.clearInterval(timer);
            this.captchaPollTimers.delete(timer);
            reject(new Error('Captcha challenge did not become available.'));
          }
        }, 100);
        this.captchaPollTimers.add(timer);
      });
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.id = scriptId;
      script.async = true;
      script.defer = true;
      script.src =
        provider === 'turnstile'
          ? 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
          : 'https://js.hcaptcha.com/1/api.js?render=explicit';
      script.onload = () => resolve((window as any)[globalName]);
      script.onerror = () => reject(new Error('Could not load captcha challenge.'));
      document.head.appendChild(script);
    });
  }

  private clearCaptchaPollTimers() {
    for (const timer of this.captchaPollTimers) {
      window.clearInterval(timer);
    }
    this.captchaPollTimers.clear();
  }
}
