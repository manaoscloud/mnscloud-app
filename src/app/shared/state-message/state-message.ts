import { Component, input } from '@angular/core';

// Angular Material
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-state-message',
  standalone: true,
  imports: [MatIconModule, MatButtonModule],
  templateUrl: './state-message.html',
  styleUrls: ['./state-message.scss'],
})
export class StateMessageComponent {
  /**
   * Tipo visual:
   *  - 'empty'   → estados vazios
   *  - 'error'   → erro
   *  - 'success' → sucesso
   */
  readonly type = input<'empty' | 'error' | 'success'>('empty');

  readonly icon = input('info');
  readonly title = input('');
  readonly message = input('');

  readonly primaryLabel = input<string>();
  readonly secondaryLabel = input<string>();

  /**
   * Layout:
   *  - 'inline' (padrão) → ocupa só o espaço do container pai
   *  - 'page'            → tela cheia, estilo Signin / Forgot Password
   */
  readonly layout = input<'inline' | 'page'>('inline');

  readonly primaryAction = input<() => void>();
  readonly secondaryAction = input<() => void>();

  onPrimary() {
    this.primaryAction()?.();
  }

  onSecondary() {
    this.secondaryAction()?.();
  }
}
