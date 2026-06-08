import { Component, inject, ChangeDetectionStrategy } from '@angular/core';

// Angular Material
import { MatCardModule } from '@angular/material/card';
import { MatRadioModule } from '@angular/material/radio';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';

// Services
import { ThemeService, ThemeMode } from '../../services/theme.service';

// Animação
import { fadeIn } from '../../shared/animations/fade.animation';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [MatCardModule, MatRadioModule, MatIconModule, MatDividerModule],
  templateUrl: './settings.html',
  styleUrls: ['./settings.scss'],
  animations: [fadeIn],
  changeDetection: ChangeDetectionStrategy.Eager,
  host: {
    '[@fadeIn]': '', // aplica animação no host em vez do template
  },
})
export class SettingsComponent {
  private readonly themeService = inject(ThemeService);

  /** Tema atual (light | dark | system) */
  readonly theme = this.themeService.theme;

  /** Opções visíveis no UI */
  readonly themeOptions: {
    value: ThemeMode;
    label: string;
    icon: string;
    description: string;
  }[] = [
    {
      value: 'light',
      label: 'Light',
      icon: 'light_mode',
      description: 'Always use the light theme.',
    },
    {
      value: 'dark',
      label: 'Dark',
      icon: 'dark_mode',
      description: 'Always use the dark theme.',
    },
    {
      value: 'system',
      label: 'Follow system',
      icon: 'settings_suggest',
      description: 'Automatically follow your OS theme.',
    },
  ];

  /** Atualiza tema */
  setTheme(mode: ThemeMode) {
    this.themeService.setTheme(mode);
  }
}
