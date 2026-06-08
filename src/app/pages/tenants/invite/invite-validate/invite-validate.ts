import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';

import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TenantsService } from '../../tenants.service';
import { StateMessageComponent } from '../../../../shared/state-message/state-message';
import { InviteValidateData } from '../../../../models/invite-validate.model';
import { InviteSessionService } from '../../../../services/invite-session.service';

@Component({
  selector: 'invite-validate',
  standalone: true,
  imports: [RouterModule, StateMessageComponent],
  templateUrl: './invite-validate.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./invite-validate.scss'],
})
export class InviteValidatePage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(TenantsService);
  private inviteSession = inject(InviteSessionService);

  loading = signal(true);
  error = signal<string | null>(null);
  invite = signal<InviteValidateData | null>(null);

  async ngOnInit() {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.error.set('Invalid invitation token.');
      this.loading.set(false);
      return;
    }

    try {
      const res = await this.service.validateInviteToken(token);

      const data = res?.data;
      if (!data || res.status !== 'success') {
        this.error.set(res?.message ?? 'Invalid or expired invitation link.');
        this.loading.set(false);
        return;
      }

      const userUUID: string | null = data.UserUUID ?? data.userUUID ?? null;
      const userExists: number | null =
        typeof data.UserExists === 'number' ? data.UserExists : null;
      const userProfileComplete: number | null =
        typeof data.UserProfileComplete === 'number' ? data.UserProfileComplete : null;

      // Mantém o que você já exibia (modelo InviteValidateData em PascalCase)
      this.invite.set({
        InviteEmail: data.InviteEmail,
        InviteRole: data.InviteRole,
        EnvironmentUUID: data.EnvironmentUUID,
        EnvironmentName: data.EnvironmentName,
        token,
        UserUUID: userUUID,
        UserExists: userExists ?? undefined,
        UserProfileComplete: userProfileComplete ?? undefined,
      });

      // ✅ Corrigido: salva sessão do convite no padrão do InviteSession (camelCase)
      this.inviteSession.set({
        token,
        userUUID,
        inviteEmail: data.InviteEmail ?? null,
        inviteRole: data.InviteRole ?? null,
        environmentUUID: data.EnvironmentUUID ?? null,
        environmentName: data.EnvironmentName ?? null,
        userExists,
        userProfileComplete,
      });
    } catch (err) {
      console.error('❌ validate invite error:', err);
      this.error.set('Failed to validate invitation.');
    }

    this.loading.set(false);
  }

  goToAccept(token: string) {
    this.router.navigate(['/invite/accept'], {
      queryParams: { token },
    });
  }

  // Usado pelo StateMessage (erro / navegação)
  goSignin = () => {
    this.router.navigate(['/signin']);
  };

  goHome = () => {
    this.router.navigate(['/dashboard']);
  };
}
