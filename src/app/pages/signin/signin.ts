import { Component, signal, inject } from '@angular/core';

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

import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { SnackbarService } from '../../services/snackbar.service';
import { I18nService, AppLanguage, LanguageOptionCode } from '../../services/i18n.service';
import { TranslatePipe } from '../../shared/i18n/translate.pipe';

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
    TranslatePipe,
  ],
  templateUrl: './signin.html',
  styleUrls: ['./signin.scss'],
  animations: [fadeIn],
})
export class Signin {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snack = inject(SnackbarService);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(I18nService);

  readonly currentLanguageOption = this.i18n.selectedLanguageOption;
  readonly languageOptions = this.i18n.languageOptions;

  readonly form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  readonly isLoading = signal(false);
  readonly showPassword = signal(false);
  readonly apiError = signal<string | null>(null);
  readonly emailError = signal('');

  constructor() {
    merge(this.form.get('email')!.statusChanges, this.form.get('email')!.valueChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.updateEmailError());
  }

  // token de convite vindo da URL: /signin?inviteToken=XYZ
  private readonly inviteTokenFromUrl: string | null =
    this.route.snapshot.queryParamMap.get('inviteToken');

  get canSubmit(): boolean {
    return this.form.valid && !this.isLoading();
  }

  async onSubmit(event?: Event) {
    event?.preventDefault();

    if (!this.canSubmit) return;

    this.isLoading.set(true);
    this.apiError.set(null);

    try {
      const { email, password } = this.form.getRawValue();

      const result = await this.api.post<any>('auth/signin', {
        email,
        password,
      });

      const jwt = result?.data?.jwt;
      if (!jwt) {
        throw new Error(this.i18n.t('signin.error.invalidResponse'));
      }

      // passa só o JWT; o perfil completo vem do /user/profile
      await this.auth.login(jwt, null, this.api);

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
}
