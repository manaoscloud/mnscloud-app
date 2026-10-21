import { AuthShell } from '../../shared/auth-shell/auth-shell';
import { PublicThemeContextService } from '../../services/public-theme-context.service';
import { loginText } from '../../shared/auth-shell/login-appearance';
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

import { FormField, email, form, minLength, required } from '@angular/forms/signals';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { RETURN_URL_PARAM, safeReturnUrl } from '../../core/navigation/return-url';

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
import { injectRevealInvalidFields } from '../../shared/forms/reveal-invalid-fields';
import { FieldErrorKeyPipe } from '../../shared/forms/field-error-key.pipe';

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
    AuthShell,
    FieldErrorKeyPipe,
    FormField,
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
})
export class Signin {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snack = inject(SnackbarService);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(AppI18nService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly publicTheme = inject(PublicThemeContextService);
  readonly eyebrow = computed(() =>
    loginText(this.publicTheme.context()?.LoginAppearance ?? {}, this.i18n.language(), 'eyebrow'),
  );
  readonly heading = computed(() =>
    loginText(this.publicTheme.context()?.LoginAppearance ?? {}, this.i18n.language(), 'title'),
  );
  readonly description = computed(() =>
    loginText(this.publicTheme.context()?.LoginAppearance ?? {}, this.i18n.language(), 'subtitle'),
  );

  readonly captchaContainer = viewChild<ElementRef<HTMLDivElement>>('captchaContainer');

  readonly currentLanguageOption = this.i18n.selectedLanguageOption;
  readonly languageOptions = this.i18n.languageOptions;

  readonly formModel = signal({
    email: '',
    password: '',
    rememberMe: false,
  });

  readonly form = form(this.formModel, (field) => {
    required(field.email);
    email(field.email);
    required(field.password);
    minLength(field.password, 6);
  });

  readonly isLoading = signal(false);
  readonly showPassword = signal(false);
  readonly apiError = signal<string | null>(null);
  /** Sign-in refused with EMAIL_NOT_VERIFIED (only after a valid password). */
  readonly emailNotVerified = signal(false);
  readonly resendingVerification = signal(false);
  /** Result of the e-mail verification link: /signin?verified=1|0. */
  readonly verificationResult = signal<'verified' | 'failed' | null>(
    this.verificationResultFromUrl(),
  );
  readonly emailError = computed(() => {
    const value = this.formModel().email.trim();
    if (!value) return this.i18n.t('signin.error.requiredEmail');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return this.i18n.t('signin.error.invalidEmail');
    return '';
  });
  private readonly signinPolicyDefault: SigninPolicy = {
    captchaEnabled: false,
    captchaProvider: null,
    captchaSiteKey: null,
    rememberMeEnabled: true,
  };
  private readonly signinPolicyResource = resource({
    defaultValue: this.signinPolicyDefault,
    loader: () => this.fetchSigninPolicy(),
  });
  readonly signinPolicy = computed(() => this.signinPolicyResource.value());
  readonly captchaToken = signal<string | null>(null);
  private readonly captchaPollTimers = new Set<ReturnType<typeof setInterval>>();

  constructor() {
    this.destroyRef.onDestroy(() => this.clearCaptchaPollTimers());
  }

  // token de convite vindo da URL: /signin?inviteToken=XYZ
  private readonly inviteTokenFromUrl: string | null =
    this.route.snapshot.queryParamMap.get('inviteToken');

  private readonly returnUrlFromUrl: string | null = safeReturnUrl(
    this.route.snapshot.queryParamMap.get(RETURN_URL_PARAM),
  );

  private readonly applySigninPolicy = effect(() => {
    if (!this.signinPolicy().rememberMeEnabled) {
      this.formModel.update((value) => ({ ...value, rememberMe: false }));
    }
    queueMicrotask(() => void this.renderCaptcha());
  });

  private readonly afterViewReady = afterNextRender(() => {
    queueMicrotask(() => void this.renderCaptcha());
  });

  private readonly revealInvalid = injectRevealInvalidFields();

  /** Invalid fields do not disable the button: submitting reveals them (app.md baseline). */
  get canSubmit(): boolean {
    const policy = this.signinPolicy();
    const captchaReady = !policy.captchaEnabled || !!this.captchaToken();
    return captchaReady && !this.isLoading();
  }

  async onSubmit(event?: Event) {
    event?.preventDefault();

    if (!this.form().valid()) return this.revealInvalid(this.form());
    if (!this.canSubmit) return;

    this.isLoading.set(true);
    this.apiError.set(null);
    this.emailNotVerified.set(false);

    try {
      const { email, password, rememberMe } = this.formModel();

      const result = await this.api.post<any>('auth/signin', {
        email,
        password,
        rememberMe: rememberMe === true,
        captchaToken: this.captchaToken(),
      });

      const loginOk = await this.auth.login(
        result?.data?.user ?? null,
        this.api,
        result?.data?.rememberMe === true,
        result?.data?.jwt ?? null,
        { deferProfileLoad: true },
      );
      if (!loginOk) {
        throw new Error(this.i18n.t('signin.error.invalidCredentials'));
      }

      this.snack.success(this.i18n.t('signin.success.welcomeBack'));
      const user = result?.data?.user;
      if (user?.emailVerificationPending) {
        this.snack.warning('signin.verification.pendingUntil', 10000, {
          date: this.formatDeadline(user.emailVerificationDeadlineAt),
        });
      }

      // 🔗 Se veio de um convite, volta para o fluxo de ACCEPT
      if (this.inviteTokenFromUrl) {
        await this.router.navigate(['/invite/accept'], {
          queryParams: { token: this.inviteTokenFromUrl },
        });
      } else {
        // E-mail links send users here with the page they asked for; only App paths are honoured.
        await this.router.navigateByUrl(this.returnUrlFromUrl ?? '/dashboard');
      }
    } catch (err: any) {
      const notVerified = err?.error?.code === 'EMAIL_NOT_VERIFIED';
      this.emailNotVerified.set(notVerified);
      const msg = notVerified
        ? this.i18n.t('signin.error.emailNotVerified')
        : err?.error?.error || err?.message || this.i18n.t('signin.error.invalidCredentials');
      this.apiError.set(msg);
      this.snack.error(msg);
      this.captchaToken.set(null);
      await this.renderCaptcha(true);
    }

    this.isLoading.set(false);
  }

  get canResendVerification(): boolean {
    const captchaReady = !this.signinPolicy().captchaEnabled || !!this.captchaToken();
    return !this.emailError() && captchaReady && !this.resendingVerification();
  }

  /** The API answers the same way for every e-mail, so the message never reveals an account. */
  async resendVerification() {
    if (!this.canResendVerification) return;
    this.resendingVerification.set(true);
    try {
      await this.api.post<any>('auth/verify-email/resend', {
        email: this.formModel().email.trim(),
        captchaToken: this.captchaToken(),
      });
      this.snack.success(this.i18n.t('signin.verification.resent'), 6000);
    } catch (err: any) {
      this.snack.error(err?.error?.error || this.i18n.t('signin.verification.resendFailed'));
    } finally {
      this.captchaToken.set(null);
      await this.renderCaptcha(true);
      this.resendingVerification.set(false);
    }
  }

  private verificationResultFromUrl(): 'verified' | 'failed' | null {
    const value = this.route.snapshot.queryParamMap.get('verified');
    return value === '1' ? 'verified' : value === '0' ? 'failed' : null;
  }

  private formatDeadline(value: unknown): string {
    const date = typeof value === 'string' && value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString(this.i18n.language());
  }

  togglePassword(event?: MouseEvent) {
    this.showPassword.set(!this.showPassword());
    event?.stopPropagation();
  }

  changeLanguage(language: LanguageOptionCode) {
    if (language === 'auto') {
      this.i18n.useSystemLanguage(true);
      return;
    }
    this.i18n.setLanguage(language as AppLanguage, true);
  }

  private async fetchSigninPolicy(): Promise<SigninPolicy> {
    try {
      const result = await this.api.get<any>('auth/signin/policy');
      const data = result?.data ?? {};
      return {
        captchaEnabled: data.captchaEnabled === true,
        captchaProvider:
          data.captchaProvider === 'turnstile' || data.captchaProvider === 'hcaptcha'
            ? data.captchaProvider
            : null,
        captchaSiteKey: typeof data.captchaSiteKey === 'string' ? data.captchaSiteKey : null,
        rememberMeEnabled: data.rememberMeEnabled !== false,
      };
    } catch {
      return this.signinPolicyDefault;
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
      theme: 'auto',
    });
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
