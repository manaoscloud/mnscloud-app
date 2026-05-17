// src/app/pages/not-found/not-found.ts

import { Component, inject } from '@angular/core';

import { Router, RouterModule } from '@angular/router';
import { StateMessageComponent } from '../../shared/state-message/state-message';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterModule, StateMessageComponent],
  template: `
    <app-state-message
      layout="page"
      type="empty"
      icon="search_off"
      title="Page not found"
      message="The page you are looking for does not exist or has been moved."
      primaryLabel="Go to Dashboard"
      [primaryAction]="goHome"
      secondaryLabel="Back to Sign In"
      [secondaryAction]="goSignin"
    />
  `,
})
export class NotFoundPage {
  private router = inject(Router);

  // Arrow functions → mantém o this correto quando passamos como Input
  goHome = () => {
    this.router.navigate(['/dashboard']);
  };

  goSignin = () => {
    this.router.navigate(['/signin']);
  };
}