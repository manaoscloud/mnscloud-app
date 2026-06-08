import { Component, inject } from '@angular/core';

import { MatCardModule } from '@angular/material/card';
import { fadeIn } from '../../shared/animations/fade.animation';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [MatCardModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss'],
  animations: [fadeIn],
})
export class Dashboard {
  private auth = inject(AuthService);
  user = this.auth.user;

  get firstName(): string {
    return this.user()?.firstName ?? '';
  }

  get fullName(): string {
    const u = this.user();
    return u ? `${u.firstName} ${u.lastName}` : '';
  }
}
