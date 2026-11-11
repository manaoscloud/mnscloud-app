import { AfterViewInit, Component, ElementRef, inject, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

import { CrudDialogBinding, openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';
import { ReportProblemButtonComponent } from '../../../shared/support-report-dialog/report-problem-button';

export type WebchatPreviewData = {
  name: string;
  /** Script URL of the real widget (same origin as the App). */
  scriptUrl: string;
  channelUUID: string;
  look: Partial<Record<'title' | 'subtitle' | 'greeting' | 'color' | 'position', string>>;
};

function attribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Sandboxed page that runs the real widget with the connection appearance as embed attributes,
 * opened. The frame has an opaque origin, so it never opens a visitor session or verifies the
 * installation.
 */
export function webchatPreviewDocument(data: WebchatPreviewData): string {
  const attributes = [
    `src="${attribute(data.scriptUrl)}"`,
    `data-channel="${attribute(data.channelUUID)}"`,
    'data-open="true"',
    ...Object.entries(data.look)
      .filter(([, value]) => !!value)
      .map(([key, value]) => `data-${key}="${attribute(String(value))}"`),
  ];
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    '<style>html,body{margin:0;height:100%;background:#f1f5f9;font-family:system-ui,sans-serif}</style>',
    `</head><body><script ${attributes.join(' ')}></script></body></html>`,
  ].join('');
}

@Component({
  selector: 'mns-webchat-preview-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule, ReportProblemButtonComponent, TranslocoPipe],
  template: `
    <div class="crud-dialog webchat-preview-dialog">
      <header class="dialog-header">
        <div>
          <h2>{{ 'conversations.widgetPreviewTitle' | transloco }}</h2>
          <p>{{ data.name }}</p>
        </div>
        <mns-report-problem-button />
      </header>
      <div class="dialog-content">
        <p class="webchat-preview-help">{{ 'conversations.widgetPreviewHelp' | transloco }}</p>
        <iframe
          class="webchat-preview-frame"
          sandbox="allow-scripts"
          [attr.title]="'conversations.widgetPreviewTitle' | transloco"
          #frame
        ></iframe>
      </div>
      <div class="form-actions">
        <div class="secondary-actions">
          <button mat-stroked-button type="button" mat-dialog-close>
            {{ 'Close' | transloco }}
          </button>
        </div>
        <div class="primary-actions"></div>
      </div>
    </div>
  `,
  styles: `
    .webchat-preview-help {
      margin: 0 0 12px;
    }
    .webchat-preview-frame {
      display: block;
      width: 100%;
      height: 620px;
      max-height: 70vh;
      border: 1px solid var(--mat-sys-outline-variant, #cbd5e1);
      border-radius: 12px;
    }
  `,
})
export class WebchatPreviewDialogComponent implements AfterViewInit {
  readonly data = inject<WebchatPreviewData>(MAT_DIALOG_DATA);
  private readonly frame = viewChild.required<ElementRef<HTMLIFrameElement>>('frame');

  ngAfterViewInit(): void {
    // A sandboxed frame without allow-same-origin: the page (escaped attribute values and the
    // App's own widget script) runs in an opaque origin and cannot reach the App.
    this.frame().nativeElement.srcdoc = webchatPreviewDocument(this.data);
  }
}

export function openWebchatPreviewDialog(
  dialog: MatDialog,
  data: WebchatPreviewData,
): CrudDialogBinding {
  const binding = openCrudTemplateDialog(dialog, WebchatPreviewDialogComponent, 'crud-form-dialog', {
    data,
  });
  void firstValueFrom(binding.ref.afterClosed()).finally(binding.stop);
  return binding;
}
