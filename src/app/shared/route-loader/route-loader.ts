import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-route-loader',
  standalone: true,
  imports: [],
  templateUrl: './route-loader.html',
  styleUrls: ['./route-loader.scss'],
})
export class RouteLoader {
  visible = signal(false);

  show() {
    this.visible.set(true);
  }

  hide() {
    this.visible.set(false);
  }
}
