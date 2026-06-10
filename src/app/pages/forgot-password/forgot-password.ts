import { Component, DestroyRef, inject, signal, ChangeDetectionStrategy } from '@angular/core';

import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { merge } from 'rxjs';
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
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly isLoading = signal(false);
  readonly infoMessage = signal<string | null>(null);
  readonly hasSubmitted = signal(false);
  readonly emailError = signal('');

  constructor() {
    merge(this.form.get('email')!.statusChanges, this.form.get('email')!.valueChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateEmailError());
  }

  get canSubmit(): boolean {
    return this.form.valid && !this.isLoading() && !this.hasSubmitted();
  }

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();

    if (!this.canSubmit) return;

    this.isLoading.set(true);
    this.infoMessage.set(null);

    const email = this.form.value.email!;

    try {
      await this.api.post('auth/forgot-password', { email });

      this.infoMessage.set(
        'If your email exists in our system, you will receive reset instructions shortly.',
      );

      this.form.disable();
      this.hasSubmitted.set(true);
    } catch {
      this.infoMessage.set(
        'If your email exists in our system, you will receive reset instructions shortly.',
      );
      this.form.disable();
      this.hasSubmitted.set(true);
    } finally {
      this.isLoading.set(false);
    }
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
}
