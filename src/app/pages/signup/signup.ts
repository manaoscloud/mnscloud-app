import {
  AfterViewInit,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { merge } from 'rxjs';
import { Router, RouterModule } from '@angular/router';
import { fadeIn } from '../../shared/animations/fade.animation';

// Angular Material
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
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
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    PhoneInputComponent,
    DateMaskDirective,
  ],
  templateUrl: './signup.html',
  styleUrls: ['./signup.scss'],
  animations: [fadeIn],
})
export class Signup implements OnInit, AfterViewInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly snack = inject(SnackbarService);

  @ViewChild('captchaContainer') captchaContainer?: ElementRef<HTMLDivElement>;

  readonly form: FormGroup = this.fb.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.pattern(/^\d{8,15}$/)]],
    email: ['', [Validators.required, Validators.email]],
    dateBirth: [null, [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  readonly showPassword = signal(false);
  readonly isLoading = signal(false);
  readonly apiError = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly emailError = signal('');
  readonly signupPolicy = signal<SignupPolicy>({
    captchaEnabled: false,
    captchaProvider: null,
    captchaSiteKey: null,
  });
  readonly captchaToken = signal<string | null>(null);

  constructor() {
    merge(this.form.get('email')!.statusChanges, this.form.get('email')!.valueChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.updateEmailError());
  }

  ngOnInit() {
    void this.loadSignupPolicy();
  }

  ngAfterViewInit() {
    queueMicrotask(() => void this.renderCaptcha());
  }

  get canSubmit(): boolean {
    const policy = this.signupPolicy();
    const captchaReady = !policy.captchaEnabled || !!this.captchaToken();
    return this.form.valid && captchaReady && !this.isLoading();
  }

  async onSubmit(event?: Event) {
    event?.preventDefault();

    if (!this.canSubmit) return;

    this.isLoading.set(true);
    this.apiError.set(null);
    this.successMessage.set(null);

    try {
      const value = this.form.getRawValue();

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
      this.form.reset();
      this.captchaToken.set(null);
      await this.renderCaptcha(true);
      setTimeout(() => void this.router.navigate(['/signin']), 2500);
    } catch (err: any) {
      const msg = err?.error?.error || err?.message || 'Registration failed.';
      this.apiError.set(msg);
      this.snack.error(msg);
    }

    this.isLoading.set(false);
  }

  togglePassword(event?: MouseEvent) {
    this.showPassword.set(!this.showPassword());
    event?.stopPropagation();
  }

  updateEmailError() {
    const control = this.form.get('email');
    if (!control) return;
    if (control.hasError('required')) {
      this.emailError.set('You must enter a value');
    } else if (control.hasError('email')) {
      this.emailError.set('Not a valid email');
    } else {
      this.emailError.set('');
    }
  }

  private async loadSignupPolicy() {
    try {
      const result = await this.api.get<any>('auth/signup/policy');
      const data = result?.data ?? {};
      this.signupPolicy.set({
        captchaEnabled: data.captchaEnabled === true,
        captchaProvider:
          data.captchaProvider === 'turnstile' || data.captchaProvider === 'hcaptcha'
            ? data.captchaProvider
            : null,
        captchaSiteKey: typeof data.captchaSiteKey === 'string' ? data.captchaSiteKey : null,
      });
      await this.renderCaptcha();
    } catch {
      this.signupPolicy.set({ captchaEnabled: false, captchaProvider: null, captchaSiteKey: null });
    }
  }

  private async renderCaptcha(forceReset = false) {
    const policy = this.signupPolicy();
    const container = this.captchaContainer?.nativeElement;
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
      return new Promise((resolve) => {
        const timer = window.setInterval(() => {
          const loaded = (window as any)[globalName];
          if (loaded?.render) {
            window.clearInterval(timer);
            resolve(loaded);
          }
        }, 100);
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
}
