import { Injectable, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

export type DiagnosticConsoleEntry = { type: string; message: string; timestamp: string };

export type DiagnosticFailedRequest = {
  method: string;
  url: string;
  status: number;
  requestId: string | null;
  message: string | null;
  timestamp: string;
};

export type ClientDiagnosticsSnapshot = {
  consoleLogs: DiagnosticConsoleEntry[];
  failedRequests: DiagnosticFailedRequest[];
  navigation: string[];
};

const MAX_CONSOLE = 30;
const MAX_REQUESTS = 20;
const MAX_NAVIGATION = 10;

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [redacted]'],
  [/\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/g, '[redacted-jwt]'],
  [
    /((?:password|passwd|pwd|secret|token|api[_-]?key|authorization|access[_-]?key|client[_-]?secret|signature|x-amz-[a-z-]+)["']?\s*[:=]\s*["']?)[^"'&\s,;}]+/gi,
    '$1[redacted]',
  ],
];

/** Removes credentials before anything leaves the browser in a problem report. */
export function redactDiagnosticText(value: string): string {
  return SECRET_PATTERNS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value,
  );
}

function describe(item: unknown): string {
  if (item instanceof Error) return `${item.name}: ${item.message}\n${item.stack ?? ''}`.trim();
  if (typeof item === 'object' && item !== null) {
    try {
      return JSON.stringify(item);
    } catch {
      return String(item);
    }
  }
  return String(item);
}

function push<T>(list: T[], item: T, max: number) {
  list.push(item);
  if (list.length > max) list.splice(0, list.length - max);
}

/**
 * Keeps a small, redacted, in-memory trail of what went wrong in this tab so a problem report
 * can explain itself: console errors, uncaught errors, failed API calls with their correlation
 * id and the last visited routes. Nothing is persisted or sent until the user submits a report.
 */
@Injectable({ providedIn: 'root' })
export class ClientDiagnosticsService {
  private readonly navigationEnd = toSignal(
    inject(Router).events.pipe(filter((event) => event instanceof NavigationEnd)),
    { initialValue: null },
  );
  private readonly consoleLogs: DiagnosticConsoleEntry[] = [];
  private readonly failedRequests: DiagnosticFailedRequest[] = [];
  private readonly navigation: string[] = [];
  private installed = false;

  constructor() {
    this.install();
  }

  private install() {
    if (this.installed || typeof window === 'undefined') return;
    this.installed = true;

    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      try {
        this.recordConsole('ERROR', args.map(describe).join(' '));
      } catch {
        // Diagnostics must never break logging.
      }
      originalError.apply(console, args);
    };

    window.addEventListener('error', (event) => {
      this.recordConsole(
        'UNCAUGHT',
        event.error
          ? describe(event.error)
          : `${event.message} (${event.filename}:${event.lineno})`,
      );
    });
    window.addEventListener('unhandledrejection', (event) => {
      this.recordConsole('UNHANDLED_REJECTION', describe(event.reason));
    });

    effect(() => {
      const event = this.navigationEnd();
      if (event) {
        push(
          this.navigation,
          redactDiagnosticText(event.urlAfterRedirects).slice(0, 300),
          MAX_NAVIGATION,
        );
      }
    });
  }

  recordConsole(type: string, message: string) {
    push(
      this.consoleLogs,
      {
        type,
        message: redactDiagnosticText(message).slice(0, 1000),
        timestamp: new Date().toISOString(),
      },
      MAX_CONSOLE,
    );
  }

  recordFailedRequest(entry: Omit<DiagnosticFailedRequest, 'timestamp'>) {
    push(
      this.failedRequests,
      {
        ...entry,
        method: entry.method.toUpperCase().slice(0, 10),
        url: redactDiagnosticText(entry.url).slice(0, 500),
        message: entry.message ? redactDiagnosticText(entry.message).slice(0, 300) : null,
        timestamp: new Date().toISOString(),
      },
      MAX_REQUESTS,
    );
  }

  snapshot(): ClientDiagnosticsSnapshot {
    return {
      consoleLogs: this.consoleLogs.map((entry) => ({ ...entry })),
      failedRequests: this.failedRequests.map((entry) => ({ ...entry })),
      navigation: [...this.navigation],
    };
  }

  lastFailedRequest(): DiagnosticFailedRequest | null {
    return this.failedRequests.at(-1) ?? null;
  }
}
