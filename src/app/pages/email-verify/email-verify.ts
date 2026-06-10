import {
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ApiService } from '../../services/api.service';

type VerifyState = 'loading' | 'success' | 'error';

@Component({
  standalone: true,
  selector: 'app-email-verify',
  templateUrl: './email-verify.html',
  styleUrls: ['./email-verify.scss'],
  imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailVerifyPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly state = signal<VerifyState>('loading');
  readonly message = signal('Validating your email address.');
  readonly countdown = signal(5);

  private redirectTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit() {
    void this.verify();
  }

  ngOnDestroy() {
    this.clearRedirectTimer();
  }

  async verify() {
    const token = this.route.snapshot.queryParamMap.get('token')?.trim();

    if (!token) {
      this.state.set('error');
      this.message.set('This verification link is invalid or incomplete.');
      return;
    }

    this.state.set('loading');
    this.message.set('Validating your email address.');

    try {
      const response = await this.api.post<{ message?: string }>('auth/verify-email', { token });
      this.state.set('success');
      this.message.set(response?.message || 'Email verified successfully.');
      this.startRedirectTimer();
    } catch (error: any) {
      this.state.set('error');
      this.message.set(
        error?.error?.error ||
          error?.error?.message ||
          error?.message ||
          'This verification link is invalid or expired.',
      );
    }
  }

  goToSignIn() {
    this.clearRedirectTimer();
    void this.router.navigate(['/signin'], {
      queryParams: { verified: this.state() === 'success' ? 1 : 0 },
    });
  }

  private startRedirectTimer() {
    this.clearRedirectTimer();
    this.countdown.set(5);
    this.redirectTimer = setInterval(() => {
      const next = this.countdown() - 1;
      this.countdown.set(next);
      if (next <= 0) this.goToSignIn();
    }, 1000);
  }

  private clearRedirectTimer() {
    if (!this.redirectTimer) return;
    clearInterval(this.redirectTimer);
    this.redirectTimer = null;
  }
}
