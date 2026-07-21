import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { StateMessageComponent } from '../../../../shared/state-message/state-message';

@Component({
  standalone: true,
  selector: 'app-invite-sent',
  imports: [StateMessageComponent, TranslocoPipe],
  templateUrl: './invite-sent.html',
})
export class InviteSentPage {
  private readonly router = inject(Router);

  goToLogin = () => this.router.navigate(['/signin']);
}
