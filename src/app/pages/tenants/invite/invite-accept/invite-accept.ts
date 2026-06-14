import { afterNextRender, Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TenantsService } from '../../tenants.service';
import { StateMessageComponent } from '../../../../shared/state-message/state-message';
import { InviteSessionService } from '../../../../services/invite-session.service';
import type { InviteValidateData } from '../../../../models/invite-validate.model';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

@Component({
  selector: 'invite-accept',
  standalone: true,
  imports: [
    RouterModule,
    ReactiveFormsModule,
    StateMessageComponent,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatDatepickerModule,
    MatNativeDateModule,
  ],
  templateUrl: './invite-accept.html',
  styleUrls: ['./invite-accept.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InviteAcceptPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private accessService = inject(TenantsService);
  private inviteSession = inject(InviteSessionService);
  private fb = inject(FormBuilder);

  token: string | null = null;

  loading = signal(true);
  submitting = signal(false);
  error = signal<string | null>(null);
  message = signal<string | null>(null);
  needsProfile = signal(false);
  invite = signal<InviteValidateData | null>(null);
  showPassword = signal(false);

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.minLength(10)]],
    dateBirth: [null as Date | null, [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  constructor() {
    afterNextRender(() => void this.initializeInvite());
  }

  get canSubmit(): boolean {
    return this.form.valid && !this.submitting();
  }

  togglePassword() {
    this.showPassword.set(!this.showPassword());
  }

  private async initializeInvite() {
    this.token = this.route.snapshot.queryParamMap.get('token');

    if (!this.token) {
      this.error.set('Invalid invitation token.');
      this.loading.set(false);
      return;
    }

    let inviteData: any = null;

    try {
      const validate = await this.accessService.validateInviteToken(this.token);
      inviteData = validate?.data ?? validate;

      if (inviteData?.EnvironmentUUID && typeof localStorage !== 'undefined') {
        localStorage.setItem('mc_current_env', inviteData.EnvironmentUUID);
      }
    } catch (err: any) {
      console.error('❌ validate invite error:', err);
      this.error.set(err?.error?.message ?? 'Invalid or expired invitation token.');
      this.loading.set(false);
      return;
    }

    const session = this.inviteSession.get();
    const userUUID = session?.userUUID ?? inviteData?.UserUUID ?? inviteData?.userUUID ?? null;
    const userExists =
      typeof inviteData?.UserExists === 'number'
        ? inviteData.UserExists
        : (session?.userExists ?? 0);
    const profileComplete =
      typeof inviteData?.UserProfileComplete === 'number'
        ? inviteData.UserProfileComplete
        : (session?.userProfileComplete ?? 0);

    this.invite.set({
      InviteEmail: inviteData?.InviteEmail,
      InviteRole: inviteData?.InviteRole,
      EnvironmentUUID: inviteData?.EnvironmentUUID,
      EnvironmentName: inviteData?.EnvironmentName,
      token: this.token,
      UserUUID: userUUID,
      UserExists: userExists,
      UserProfileComplete: profileComplete,
    });

    const needsProfile = !(userExists === 1 && profileComplete === 1);
    this.needsProfile.set(needsProfile);

    if (!needsProfile && userUUID) {
      await this.acceptWithUserUUID(userUUID);
    }

    this.loading.set(false);
  }

  private async acceptWithUserUUID(userUUID: string) {
    try {
      const res = await this.accessService.acceptInvite(this.token as string, userUUID);
      this.message.set(res?.message ?? res?.data?.message ?? 'Access granted successfully.');
      this.inviteSession.clear();
    } catch (err: any) {
      console.error('❌ accept invite error:', err);
      this.error.set(err?.error?.message ?? err?.message ?? 'Failed to accept invitation.');
    }
  }

  async submitProfile(event?: Event) {
    event?.preventDefault();

    if (!this.canSubmit || !this.token) return;

    this.submitting.set(true);
    this.error.set(null);

    const value = this.form.getRawValue();
    const dateBirthStr =
      value.dateBirth instanceof Date
        ? value.dateBirth.toISOString().substring(0, 10)
        : (value.dateBirth ?? '');

    try {
      const res = await this.accessService.acceptInviteWithProfile({
        token: this.token,
        firstName: value.firstName,
        lastName: value.lastName,
        phone: value.phone,
        dateBirth: dateBirthStr,
        password: value.password,
      });

      this.message.set(res?.message ?? res?.data?.message ?? 'Access granted successfully.');
      this.inviteSession.clear();
      this.needsProfile.set(false);
    } catch (err: any) {
      console.error('❌ accept invite error:', err);
      this.error.set(err?.error?.message ?? err?.message ?? 'Failed to accept invitation.');
    } finally {
      this.submitting.set(false);
    }
  }

  goToDashboard = () => {
    this.router.navigate(['/dashboard']);
  };

  // Para StateMessage (erro)
  goSignin = () => {
    this.router.navigate(['/signin']);
  };

  goHome = () => {
    this.router.navigate(['/dashboard']);
  };
}
