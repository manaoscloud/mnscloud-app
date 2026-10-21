import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthShell } from './auth-shell';
import { LoginLocale, loginText } from './login-appearance';
import { PublicThemeRuntimeContext } from '../../services/public-theme-context.service';
import { ReportProblemButtonComponent } from '../support-report-dialog/report-problem-button';

@Component({
  standalone: true,
  imports: [
    AuthShell,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    TranslocoPipe,
    ReportProblemButtonComponent,
  ],
  template: `
    <div class="dialog-header">
      <div>
        <h2>{{ 'access.preview' | transloco }}</h2>
        <p>{{ 'access.previewDescription' | transloco }}</p>
      </div>
      <div class="header-actions"><mns-report-problem-button /></div>
    </div>
    <mat-dialog-content>
      <div class="preview-tools">
        @for (app of modules; track app.key) {
          <button
            mat-stroked-button
            (click)="module.set(app.key)"
            [attr.aria-pressed]="module() === app.key"
          >
            {{ app.label }}
          </button>
        }
        @for (lang of languages; track lang) {
          <button
            mat-stroked-button
            (click)="language.set(lang)"
            [attr.aria-pressed]="language() === lang"
          >
            {{ lang }}
          </button>
        }
        <button mat-stroked-button (click)="mobile.set(!mobile())">
          {{ (mobile() ? 'access.desktop' : 'access.mobile') | transloco }}
        </button>
        <button mat-stroked-button (click)="dark.set(!dark())">
          {{ (dark() ? 'access.light' : 'access.dark') | transloco }}
        </button>
      </div>
      <p>{{ 'access.previewOnly' | transloco }}</p>
      <div class="preview-frame" [class.phone]="mobile()">
        <mns-auth-shell
          [preview]="true"
          [previewContext]="context()"
          [previewLocale]="language()"
          [previewMobile]="mobile()"
          [module]="module()"
        >
          <div class="auth-card">
            <p class="access-kicker">{{ copy('eyebrow') }}</p>
            <h1 class="title">{{ copy('title') }}</h1>
            <p class="subtitle">{{ copy('subtitle') }}</p>
            <div class="preview-label">
              {{ t(identityLabel[module()]) }}
            </div>
            <div class="preview-input">
              {{ module() === 'pulse' ? 'ABC12345' : 'nome@example.com' }}
            </div>
            <div class="preview-label">{{ t('signin.password') }}</div>
            <div class="preview-input">••••••••<mat-icon>visibility</mat-icon></div>
            <button
              mat-flat-button
              class="submit-btn"
              type="button"
              tabindex="-1"
              aria-disabled="true"
            >
              {{ t('signin.submit') }}
            </button>
          </div>
        </mns-auth-shell>
      </div>
    </mat-dialog-content>
    <div class="form-actions">
      <div class="secondary-actions">
        <button mat-button mat-dialog-close>{{ 'Close' | transloco }}</button>
      </div>
    </div>
  `,
  styles: [
    `
      @use './auth-form';
      :host {
        display: flex;
        flex-direction: column;
        min-height: 0;
        height: 100%;
      }
      .dialog-header {
        display: flex;
        justify-content: space-between;
        padding: 20px 24px 0;
        gap: 20px;
      }
      .dialog-header h2 {
        margin: 0;
      }
      .dialog-header p {
        font-size: 14px;
      }
      mat-dialog-content {
        flex: 1;
        max-height: none;
      }
      .preview-tools {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .preview-tools [aria-pressed='true'] {
        border-width: 2px;
      }
      .preview-frame {
        border: 1px solid var(--mat-sys-color-outline-variant);
        overflow: hidden;
        border-radius: 12px;
      }
      .phone {
        max-width: 390px;
        margin: auto;
      }
      .preview-label {
        font-size: 14px;
        margin-bottom: 8px;
      }
      .preview-input {
        border: 1px solid var(--access-line);
        padding: 14px;
        margin-bottom: 22px;
        border-radius: 7px;
        display: flex;
        justify-content: space-between;
      }
      .form-actions {
        padding: 12px 24px;
      }
      .secondary-actions {
        display: flex;
        justify-content: flex-end;
      }
    `,
  ],
})
export class AuthPreviewDialog {
  constructor() {
    for (const language of this.languages) void firstValueFrom(this.transloco.load(language));
  }
  readonly data = inject<{
    app: PublicThemeRuntimeContext;
    pulse: PublicThemeRuntimeContext;
    pos: PublicThemeRuntimeContext;
    phoneweb: PublicThemeRuntimeContext;
    module: 'app' | 'pulse' | 'pos' | 'phoneweb';
  }>(MAT_DIALOG_DATA);
  /** First field of each login: App/POS e-mail, Pulse code, PhoneWeb any MNSCloud login. */
  readonly identityLabel = {
    app: 'signin.email',
    pos: 'signin.email',
    pulse: 'access.employeeCode',
    phoneweb: 'access.phonewebUser',
  } as const;
  readonly modules = [
    { key: 'app', label: 'App' },
    { key: 'pulse', label: 'Pulse' },
    { key: 'pos', label: 'POS' },
    { key: 'phoneweb', label: 'PhoneWeb' },
  ] as const;
  private readonly transloco = inject(TranslocoService);
  private readonly translationEvents = toSignal(this.transloco.events$);
  readonly module = signal(this.data.module);
  readonly language = signal<LoginLocale>('pt-BR');
  readonly languages: LoginLocale[] = ['pt-BR', 'en-US', 'es-ES'];
  readonly mobile = signal(false);
  readonly dark = signal(false);
  readonly context = computed(() => ({
    ...this.data[this.module()],
    LoginAppearance: {
      ...this.data[this.module()].LoginAppearance,
      appearance: this.dark() ? ('dark' as const) : ('light' as const),
    },
  }));
  t(key: string) {
    this.translationEvents();
    return this.transloco.translate(key, {}, this.language());
  }
  copy(key: 'title' | 'subtitle' | 'eyebrow') {
    return (
      loginText(this.context().LoginAppearance, this.language(), key) ||
      this.t(`access.${this.module()}.${key}`)
    );
  }
}
