import { Component, DestroyRef, inject, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../../services/api.service';
import { openCrudComponentDialog } from '../../../shared/dialog/crud-dialog.util';
import { ReportProblemButtonComponent } from '../../../shared/support-report-dialog/report-problem-button';
import { TerminalComponent, TerminalNotice } from '../../../shared/terminal/terminal';
import { TerminalSize } from '../../../shared/terminal/terminal-protocol';
import { DeviceConsoleChannel, deviceConsoleSocketUrl } from './device-console-channel';

export { deviceConsoleSocketUrl };

export type DeviceConsoleData = {
  /** `network` or `system/network`, from the route scope of the page. */
  base: string;
  deviceUUID: string;
  deviceName: string;
};

type ConsoleOpenResponse = {
  data?: {
    connectionUUID?: string;
    relayUrl?: string | null;
    ticket?: string | null;
    expiresAt?: string | null;
  };
};

/**
 * Console of a Network device through an access gateway: the shared terminal, the gateway state,
 * the host key result, and the confirmation of every write command the gateway holds.
 */
@Component({
  selector: 'mns-network-device-console',
  standalone: true,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatTooltipModule,
    ReportProblemButtonComponent,
    TerminalComponent,
    TranslocoPipe,
  ],
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px;
        height: 100%;
        min-height: 0;
        box-sizing: border-box;
      }
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }
      .header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .title {
        font-weight: 600;
      }
      .state {
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.875rem;
      }
      .banner {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 0.875rem;
        background: var(--mat-sys-surface-container-highest, #333);
        overflow-wrap: anywhere;
      }
      .banner.error {
        color: var(--mat-sys-on-error-container, #410e0b);
        background: var(--mat-sys-error-container, #f9dedc);
      }
      .banner.warning {
        background: var(--mat-sys-tertiary-container, #ffd8e4);
        color: var(--mat-sys-on-tertiary-container, #31111d);
      }
      .banner code {
        font-family: monospace;
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
    `,
  ],
  template: `
    <div class="header">
      <div>
        <div class="title">{{ 'network.console.title' | transloco }} · {{ data.deviceName }}</div>
        <div class="state">{{ channel.stateLabel() | transloco }}</div>
      </div>
      <div class="header-actions">
        <button
          mat-icon-button
          type="button"
          (click)="terminal()?.pasteFromClipboard()"
          [matTooltip]="'Paste (Ctrl+Shift+V)' | transloco"
          [attr.aria-label]="'Paste (Ctrl+Shift+V)' | transloco"
        >
          <mat-icon>content_paste</mat-icon>
        </button>
        <mns-report-problem-button />
      </div>
    </div>
    @if (channel.hostKey(); as key) {
      <div
        class="banner"
        [class.success]="key.tone === 'success'"
        [class.error]="key.tone === 'error'"
      >
        <mat-icon>{{ key.tone === 'error' ? 'gpp_bad' : 'verified_user' }}</mat-icon>
        <span>
          {{ key.message | transloco }}
          @if (key.fingerprint) {
            <br /><code>{{ key.fingerprint }}</code>
          }
        </span>
      </div>
    }
    @for (banner of channel.banners(); track $index) {
      <div
        class="banner"
        [class.error]="banner.tone === 'error'"
        [class.warning]="banner.tone === 'warning'"
      >
        <mat-icon>{{
          banner.tone === 'error' ? 'error' : banner.tone === 'warning' ? 'warning' : 'info'
        }}</mat-icon>
        <span>{{ banner.message | transloco: banner.params }}</span>
      </div>
    }
    <mns-terminal
      (ready)="terminalReady($event)"
      (terminalInput)="channel.input($event)"
      (resized)="channel.resize($event)"
      (notice)="terminalNotice($event)"
    />
    <div class="actions">
      <button mat-stroked-button type="button" (click)="reconnect()">
        <mat-icon>refresh</mat-icon>
        {{ 'Reconnect' | transloco }}
      </button>
      <button mat-flat-button type="button" (click)="close()">{{ 'Close' | transloco }}</button>
    </div>
  `,
})
export class NetworkDeviceConsoleComponent {
  readonly data = inject<DeviceConsoleData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef);
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  readonly terminal = viewChild(TerminalComponent);

  readonly channel = new DeviceConsoleChannel({
    dialog: this.dialog,
    terminal: () => this.terminal(),
    deviceName: () => this.data.deviceName,
    open: async () => {
      const response = await this.api.post<ConsoleOpenResponse>(
        `${this.data.base}/devices/${this.data.deviceUUID}/console`,
        {},
      );
      return response?.data;
    },
    // The network console owns its connection: closing it ends the record (the gateway stops it
    // on its next poll).
    onTeardown: (connection) => {
      void this.api.delete(`${this.data.base}/connections/${connection}`).catch(() => undefined);
    },
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.channel.teardown());
  }

  terminalReady(_size: TerminalSize) {
    this.channel.terminalReady();
  }

  terminalNotice(notice: TerminalNotice) {
    this.channel.terminalNotice(notice);
  }

  async reconnect() {
    await this.channel.reconnect();
  }

  close() {
    this.ref.close();
  }
}

/** Opens the console dialog; Escape belongs to the terminal (vim, menus), never closes it. */
export async function openNetworkDeviceConsole(dialog: MatDialog, data: DeviceConsoleData) {
  const binding = openCrudComponentDialog(
    dialog,
    NetworkDeviceConsoleComponent,
    'crud-form-dialog',
    {
      data,
      onEscape: () => undefined,
    },
  );
  try {
    await firstValueFrom(binding.ref.afterClosed());
  } finally {
    binding.stop();
  }
}
