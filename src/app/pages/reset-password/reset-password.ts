import {
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormField, form, minLength, required } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';

import { ApiService } from '../../services/api.service';

@Component({
  standalone: true,
  selector: 'app-reset-password',
  templateUrl: './reset-password.html',
  styleUrls: ['./reset-password.scss'],
  imports: [
    FormField,
    RouterModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordComponent {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // 🔥 Agora só token — email foi removido do fluxo
  private token = this.route.snapshot.queryParamMap.get('token');

  readonly isLoading = signal(false);
  readonly apiError = signal<string | null>(null);
  readonly success = signal(false);
  readonly showPassword = signal(false);
  private redirectTimer: ReturnType<typeof setTimeout> | null = null;

  readonly formModel = signal({
    newPassword: '',
    confirmPassword: '',
  });

  readonly form = form(this.formModel, (schema) => {
    required(schema.newPassword);
    minLength(schema.newPassword, 8);
    required(schema.confirmPassword);
  });

  readonly passwordMismatch = computed(() => {
    const value = this.formModel();
    return (
      !!value.newPassword && !!value.confirmPassword && value.newPassword !== value.confirmPassword
    );
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.clearRedirectTimer());
  }

  readonly canSubmit = computed(
    () => this.form().valid() && !this.passwordMismatch() && !this.isLoading(),
  );

  togglePassword() {
    this.showPassword.update((v) => !v);
  }

  async onSubmit(event: Event) {
    event.preventDefault();

    if (!this.canSubmit()) {
      return;
    }

    // 🔥 Agora valida SOMENTE o token
    if (!this.token) {
      this.apiError.set('Invalid or expired reset link. Please request a new one.');
      return;
    }

    this.apiError.set(null);
    this.isLoading.set(true);

    const newPassword = this.formModel().newPassword;

    try {
      await this.api.post('auth/reset-password', {
        token: this.token,
        newPassword,
      });

      this.success.set(true);

      this.scheduleRedirect();
    } catch (err: any) {
      const msg =
        err?.error?.message ||
        err?.error?.error ||
        err?.message ||
        'Unable to reset password. Please try again.';
      this.apiError.set(msg);
    } finally {
      this.isLoading.set(false);
    }
  }

  private scheduleRedirect() {
    this.clearRedirectTimer();
    this.redirectTimer = setTimeout(() => {
      this.redirectTimer = null;
      void this.router.navigate(['/signin']);
    }, 2000);
  }

  private clearRedirectTimer() {
    if (!this.redirectTimer) return;
    clearTimeout(this.redirectTimer);
    this.redirectTimer = null;
  }
}
