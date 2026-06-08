import { Component } from '@angular/core';

import { RouterModule } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-invite-sent',
  imports: [RouterModule],
  templateUrl: './invite-sent.html',
  styleUrls: ['./invite-sent.scss'],
})
export class InviteSentPage {
  goToLogin() {
    window.location.href = '/signin';
  }
}
