import { Component, Input } from '@angular/core';

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
  @Input() type: 'empty' | 'error' | 'success' = 'empty';

  @Input() icon = 'info';
  @Input() title = '';
  @Input() message = '';

  @Input() primaryLabel?: string;
  @Input() secondaryLabel?: string;

  /**
   * Layout:
   *  - 'inline' (padrão) → ocupa só o espaço do container pai
   *  - 'page'            → tela cheia, estilo Signin / Forgot Password
   */
  @Input() layout: 'inline' | 'page' = 'inline';

  @Input() primaryAction?: () => void;
  @Input() secondaryAction?: () => void;

  onPrimary() {
    this.primaryAction?.();
  }

  onSecondary() {
    this.secondaryAction?.();
  }
}
