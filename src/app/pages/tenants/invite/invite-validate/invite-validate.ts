import { afterNextRender, Component, inject, signal } from '@angular/core';

import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { TenantsService } from '../../tenants.service';
import { StateMessageComponent } from '../../../../shared/state-message/state-message';
import { InviteValidateData } from '../../../../models/invite-validate.model';
import { InviteSessionService } from '../../../../services/invite-session.service';
import { AppI18nService } from '../../../../services/app-i18n.service';

@Component({
  selector: 'invite-validate',
  standalone: true,
  imports: [StateMessageComponent, TranslocoPipe],
  templateUrl: './invite-validate.html',
})
export class InviteValidatePage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(TenantsService);
  private inviteSession = inject(InviteSessionService);
  private i18n = inject(AppI18nService);

  loading = signal(true);
  error = signal<string | null>(null);
  invite = signal<InviteValidateData | null>(null);

  constructor() {
    afterNextRender(() => void this.validateInvite());
  }

  private async validateInvite() {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.error.set(this.i18n.t('Invalid invitation token.'));
      this.loading.set(false);
      return;
    }

    try {
      const res = await this.service.validateInviteToken(token);

      const data = res?.data;
      if (!data || res.status !== 'success') {
        this.error.set(res?.message ?? this.i18n.t('Invalid or expired invitation link.'));
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
      this.error.set(this.i18n.t('Failed to validate invitation.'));
    }

    this.loading.set(false);
  }

  goToAccept(token: string) {
    this.router.navigate(['/invite/accept'], {
      queryParams: { token },
    });
  }

  goToCurrentInvite = () => {
    const invite = this.invite();
    if (invite) this.goToAccept(invite.token);
  };

  // Usado pelo StateMessage (erro / navegação)
  goSignin = () => {
    this.router.navigate(['/signin']);
  };

  goHome = () => {
    this.router.navigate(['/dashboard']);
  };
}
