import { ErrorHandler, Injectable } from '@angular/core';

const DEDUPE_WINDOW_MS = 10_000;
const MAX_REPORTS_PER_MINUTE = 10;

function sanitize(val?: string | null): string {
  if (!val) return '';
  return val
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/(password|secret|token|apiKey)=[^&\s]+/gi, '$1=[REDACTED]')
    .replace(/-----BEGIN[ A-Z_-]+KEY-----[^-]+-----END[ A-Z_-]+KEY-----/gi, '[REDACTED KEY]')
    .slice(0, 1500);
}

@Injectable({
  providedIn: 'root',
})
export class GlobalErrorHandler implements ErrorHandler {
  private recentErrors = new Map<string, number>();
  private reportsInWindow: number[] = [];

  handleError(error: unknown): void {
    // Always preserve local console output
    console.error('Unhandled application error:', error);

    try {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : '';
      const cleanMessage = sanitize(message);
      const cleanStack = sanitize(stack);
      const url = sanitize(typeof window !== 'undefined' ? window.location.href : '');

      const fingerprint = `${cleanMessage}:${cleanStack.split('\n')[0] ?? ''}`;
      const now = Date.now();

      // Deduplicate identical errors within 10 seconds
      const lastSent = this.recentErrors.get(fingerprint);
      if (lastSent && now - lastSent < DEDUPE_WINDOW_MS) {
        return;
      }
      this.recentErrors.set(fingerprint, now);

      // Clean old entries
      for (const [k, ts] of this.recentErrors.entries()) {
        if (now - ts > DEDUPE_WINDOW_MS * 2) {
          this.recentErrors.delete(k);
        }
      }

      // Rate limit to max 10 per minute
      this.reportsInWindow = this.reportsInWindow.filter((ts) => now - ts < 60_000);
      if (this.reportsInWindow.length >= MAX_REPORTS_PER_MINUTE) {
        return;
      }
      this.reportsInWindow.push(now);

      // Report to /api/v1/system/client-errors using fetch (avoiding Angular HTTP cycle)
      const endpoint = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/system/client-errors`;
      fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: cleanMessage,
          stack: cleanStack,
          url,
          component: 'mnscloud-app',
          severity: 'error',
        }),
        keepalive: true,
      }).catch(() => {
        // Silently ignore report transmission failure
      });
    } catch {
      // Never crash inside error handler
    }
  }
}
