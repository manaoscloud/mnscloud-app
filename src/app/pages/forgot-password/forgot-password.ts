import { Component, computed, inject, signal } from '@angular/core';
import { FormField, email, form, required } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ApiService } from '../../services/api.service';

@Component({
  standalone: true,
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.html',
  styleUrls: ['./forgot-password.scss'],
  imports: [
    FormField,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
})
export class ForgotPasswordComponent {
  private api = inject(ApiService);

  readonly formModel = signal({
    email: '',
  });

  readonly form = form(this.formModel, (schema) => {
    required(schema.email);
    email(schema.email);
  });

  readonly isLoading = signal(false);
  readonly infoMessage = signal<string | null>(null);
  readonly hasSubmitted = signal(false);
  readonly emailError = computed(() => {
    const emailField = this.form.email();
    const errors = emailField.errors();
    if (errors.some((error) => error.kind === 'required')) return 'You must enter a value';
    if (errors.some((error) => error.kind === 'email')) return 'Not a valid email';
    return '';
  });

  get canSubmit(): boolean {
    return this.form().valid() && !this.isLoading() && !this.hasSubmitted();
  }

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();

    if (!this.canSubmit) return;

    this.isLoading.set(true);
    this.infoMessage.set(null);

    const email = this.formModel().email.trim();

    try {
      await this.api.post('auth/forgot-password', { email });

      this.infoMessage.set(
        'If your email exists in our system, you will receive reset instructions shortly.',
      );

      this.hasSubmitted.set(true);
    } catch {
      this.infoMessage.set(
        'If your email exists in our system, you will receive reset instructions shortly.',
      );
      this.hasSubmitted.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }
}
