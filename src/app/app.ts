import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { RouteLoader } from './shared/route-loader/route-loader';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouteLoader],
  template: `
    <app-route-loader />

    <main class="app-container" animate.enter="app-route-enter">
      <router-outlet />
    </main>
  `,
  styles: [
    `
      .app-container {
        display: block;
        min-height: 100vh;
        overflow-x: hidden;
        background: var(--app-bg, #f9fafb);
        transition: background-color 0.3s ease;
      }
    `,
  ],
})
export class App {}
