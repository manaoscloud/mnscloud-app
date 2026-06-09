import {
  AfterViewInit,
  Component,
  ElementRef,
  OnInit,
  inject,
  signal,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';

import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { merge } from 'rxjs';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { fadeIn } from '../../shared/animations/fade.animation';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';

import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { SnackbarService } from '../../services/snackbar.service';
import { AppI18nService, AppLanguage, LanguageOptionCode } from '../../services/app-i18n.service';
import { TranslocoPipe } from '@jsverse/transloco';

type SigninPolicy = {
  captchaEnabled: boolean;
  captchaProvider: 'turnstile' | 'hcaptcha' | null;
  captchaSiteKey: string | null;
  rememberMeEnabled: boolean;
};

@Component({
  selector: 'app-signin',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatSelectModule,
    MatCheckboxModule,
    TranslocoPipe,
  ],
  templateUrl: './signin.html',
  styleUrls: ['./signin.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [fadeIn],
})
export class Signin implements OnInit, AfterViewInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snack = inject(SnackbarService);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(AppI18nService);

  readonly captchaContainer = viewChild<ElementRef<HTMLDivElement>>('captchaContainer');

  readonly currentLanguageOption = this.i18n.selectedLanguageOption;
  readonly languageOptions = this.i18n.languageOptions;

  readonly form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    rememberMe: [false],
  });

  readonly isLoading = signal(false);
  readonly showPassword = signal(false);
  readonly apiError = signal<string | null>(null);
  readonly emailError = signal('');
  readonly signinPolicy = signal<SigninPolicy>({
    captchaEnabled: false,
    captchaProvider: null,
    captchaSiteKey: null,
    rememberMeEnabled: true,
  });
  readonly captchaToken = signal<string | null>(null);

  constructor() {
    merge(this.form.get('email')!.statusChanges, this.form.get('email')!.valueChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.updateEmailError());
  }

  // token de convite vindo da URL: /signin?inviteToken=XYZ
  private readonly inviteTokenFromUrl: string | null =
    this.route.snapshot.queryParamMap.get('inviteToken');

  ngOnInit() {
    void this.loadSigninPolicy();
  }

  ngAfterViewInit() {
    queueMicrotask(() => void this.renderCaptcha());
  }

  get canSubmit(): boolean {
    const policy = this.signinPolicy();
    const captchaReady = !policy.captchaEnabled || !!this.captchaToken();
    return this.form.valid && captchaReady && !this.isLoading();
  }

  async onSubmit(event?: Event) {
    event?.preventDefault();

    if (!this.canSubmit) return;

    this.isLoading.set(true);
    this.apiError.set(null);

    try {
      const { email, password, rememberMe } = this.form.getRawValue();

      const result = await this.api.post<any>('auth/signin', {
        email,
        password,
        rememberMe: rememberMe === true,
        captchaToken: this.captchaToken(),
      });

      const jwt = result?.data?.jwt;
      if (!jwt) {
        throw new Error(this.i18n.t('signin.error.invalidResponse'));
      }

      await this.auth.login(
        jwt,
        result?.data?.user ?? null,
        this.api,
        result?.data?.rememberMe === true,
      );

      this.snack.success(this.i18n.t('signin.success.welcomeBack'));

      // 🔗 Se veio de um convite, volta para o fluxo de ACCEPT
      if (this.inviteTokenFromUrl) {
        await this.router.navigate(['/invite/accept'], {
          queryParams: { token: this.inviteTokenFromUrl },
        });
      } else {
        await this.router.navigate(['/dashboard']);
      }
    } catch (err: any) {
      const msg =
        err?.error?.error || err?.message || this.i18n.t('signin.error.invalidCredentials');
      this.apiError.set(msg);
      this.snack.error(msg);
      this.captchaToken.set(null);
      await this.renderCaptcha(true);
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
      this.emailError.set(this.i18n.t('signin.error.requiredEmail'));
    } else if (control.hasError('email')) {
      this.emailError.set(this.i18n.t('signin.error.invalidEmail'));
    } else {
      this.emailError.set('');
    }
  }

  changeLanguage(language: LanguageOptionCode) {
    if (language === 'auto') {
      this.i18n.useSystemLanguage(true);
      return;
    }
    this.i18n.setLanguage(language as AppLanguage, true);
  }

  private async loadSigninPolicy() {
    try {
      const result = await this.api.get<any>('auth/signin/policy');
      const data = result?.data ?? {};
      this.signinPolicy.set({
        captchaEnabled: data.captchaEnabled === true,
        captchaProvider:
          data.captchaProvider === 'turnstile' || data.captchaProvider === 'hcaptcha'
            ? data.captchaProvider
            : null,
        captchaSiteKey: typeof data.captchaSiteKey === 'string' ? data.captchaSiteKey : null,
        rememberMeEnabled: data.rememberMeEnabled !== false,
      });
      if (data.rememberMeEnabled === false) {
        this.form.patchValue({ rememberMe: false }, { emitEvent: false });
      }
      await this.renderCaptcha();
    } catch {
      this.signinPolicy.set({
        captchaEnabled: false,
        captchaProvider: null,
        captchaSiteKey: null,
        rememberMeEnabled: true,
      });
    }
  }

  private async renderCaptcha(forceReset = false) {
    const policy = this.signinPolicy();
    const container = this.captchaContainer()?.nativeElement;
    if (!policy.captchaEnabled || !policy.captchaProvider || !policy.captchaSiteKey || !container) {
      return;
    }

    if (forceReset) {
      container.innerHTML = '';
      delete container.dataset['rendered'];
    }

    if (container.dataset['rendered'] === 'true' && !forceReset) return;

    const api = await this.loadCaptchaApi(policy.captchaProvider);
    container.innerHTML = '';
    container.dataset['rendered'] = 'true';

    api.render(container, {
      sitekey: policy.captchaSiteKey,
      callback: (token: string) => this.captchaToken.set(token),
      'expired-callback': () => this.captchaToken.set(null),
      'error-callback': () => this.captchaToken.set(null),
      theme: 'dark',
    });
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
