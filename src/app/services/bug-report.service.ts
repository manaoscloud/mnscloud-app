import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import html2canvas from 'html2canvas';
import { ApiService } from './api.service';
import { SnackbarService } from './snackbar.service';

export interface BugReportPayload {
  title: string;
  description: string;
  type: 'bug' | 'performance' | 'ui' | 'suggestion' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  url?: string;
  screenshot?: string;
  systemInfo?: Record<string, unknown>;
}

export interface RecentLogItem {
  type: string;
  message: string;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class BugReportService {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);
  private readonly router = inject(Router);

  private readonly recentLogs: RecentLogItem[] = [];
  private isLoggerInitialized = false;

  constructor() {
    this.initErrorListener();
  }

  private initErrorListener() {
    if (this.isLoggerInitialized || typeof window === 'undefined') return;
    this.isLoggerInitialized = true;

    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      try {
        const message = args
          .map((item) => {
            if (item instanceof Error) return `${item.name}: ${item.message}\n${item.stack}`;
            if (typeof item === 'object') {
              try {
                return JSON.stringify(item);
              } catch {
                return String(item);
              }
            }
            return String(item);
          })
          .join(' ');

        this.addLog('ERROR', message);
      } catch {
        // fail-safe
      }
      originalError.apply(console, args);
    };
  }

  private addLog(type: string, message: string) {
    if (this.recentLogs.length >= 20) {
      this.recentLogs.shift();
    }
    this.recentLogs.push({
      type,
      message: message.slice(0, 1000),
      timestamp: new Date().toISOString(),
    });
  }

  getRecentLogs(): RecentLogItem[] {
    return [...this.recentLogs];
  }

  async captureScreen(): Promise<string | null> {
    if (typeof window === 'undefined' || !document?.body) return null;

    try {
      const canvas = await html2canvas(document.body, {
        scale: Math.min(window.devicePixelRatio || 1, 1.25),
        logging: false,
        useCORS: true,
        allowTaint: true,
        ignoreElements: (el) => {
          if (!el || !el.classList) return false;
          return (
            el.classList.contains('cdk-overlay-container') ||
            el.classList.contains('mat-mdc-menu-panel') ||
            el.classList.contains('cdk-overlay-backdrop')
          );
        },
      });

      return canvas.toDataURL('image/jpeg', 0.82);
    } catch (err) {
      console.warn('[BugReportService] Falha ao capturar tela:', err);
      return null;
    }
  }

  async openReportDialog(): Promise<void> {
    // Dynamic import to avoid circular dependency
    const { BugReportDialogComponent } = await import(
      '../shared/bug-report-dialog/bug-report-dialog'
    );

    // Pequeno delay para que menus abertos se fechem antes do print
    await new Promise((resolve) => setTimeout(resolve, 80));

    const screenshot = await this.captureScreen();

    this.dialog.open(BugReportDialogComponent, {
      data: {
        screenshot: screenshot || undefined,
        url: window.location.href,
        consoleLogs: this.getRecentLogs(),
      },
      width: '660px',
      maxWidth: '96vw',
      panelClass: 'crud-dialog-panel',
      autoFocus: false,
    });
  }

  async submitReport(payload: BugReportPayload): Promise<void> {
    try {
      await this.api.post('/system/bug-reports', payload);
      this.snack.success('topbar.reportBugSuccess');
    } catch (err) {
      console.error('[BugReportService] Erro ao submeter relatório:', err);
      this.snack.error('topbar.reportBugError');
      throw err;
    }
  }
}
