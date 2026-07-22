import { MatDialog } from '@angular/material/dialog';

import { ApiService } from '../../services/api.service';
import { SnackbarService } from '../../services/snackbar.service';
import { DataViewerDetail, openDataViewerDialog } from '../data-viewer-dialog/data-viewer-dialog';

export type RuntimeDiagnosticRequest = {
  title: string;
  description: string;
  startEndpoint: string;
  statusEndpoint: (jobUUID: string) => string;
};

type RuntimeDiagnosticResult = {
  jobUUID: string;
  status: string;
  summary?: Record<string, unknown> | null;
  result?: Record<string, unknown> | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt?: string | null;
  finishedAt?: string | null;
};

const terminalStatuses = new Set(['success', 'failed']);

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function statusTone(status: string): 'success' | 'danger' | 'warning' {
  if (status === 'success') return 'success';
  if (status === 'failed') return 'danger';
  return 'warning';
}

function statusLabel(status: string): string {
  return status === 'success' ? 'Completed' : status === 'failed' ? 'Failed' : 'Checking';
}

function detailRows(result: RuntimeDiagnosticResult): DataViewerDetail[] {
  const entries: DataViewerDetail[] = Object.entries(result.summary ?? {})
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([label, value]) => ({ label, value, monospace: label === 'Runtime name' }));
  if (result.errorCode)
    entries.push({ label: 'Error code', value: result.errorCode, monospace: true });
  if (result.errorMessage) entries.push({ label: 'Error', value: result.errorMessage, wide: true });
  return entries;
}

function output(result: RuntimeDiagnosticResult): string {
  const payload = result.result ?? {};
  return String(
    payload['stdout'] ?? payload['output'] ?? payload['stderr'] ?? 'No command output returned.',
  );
}

async function waitForDiagnostic(
  api: ApiService,
  request: RuntimeDiagnosticRequest,
): Promise<RuntimeDiagnosticResult> {
  const started = await api.post<{ data?: RuntimeDiagnosticResult }>(request.startEndpoint, {});
  let current = started.data;
  if (!current?.jobUUID) throw new Error('Diagnostic job was not created.');

  for (let attempt = 0; attempt < 60 && !terminalStatuses.has(current.status); attempt += 1) {
    await delay(1000);
    const response: { data?: RuntimeDiagnosticResult } = await api.get<{
      data?: RuntimeDiagnosticResult;
    }>(request.statusEndpoint(current.jobUUID));
    current = response.data;
    if (!current?.jobUUID) throw new Error('Diagnostic status was not returned.');
  }

  if (!terminalStatuses.has(current.status)) {
    throw new Error('The runtime diagnostic timed out. Try again in a moment.');
  }
  return current;
}

export async function runRuntimeDiagnostic(
  dialog: MatDialog,
  api: ApiService,
  snack: SnackbarService,
  request: RuntimeDiagnosticRequest,
): Promise<void> {
  snack.info('Checking runtime status…', 3500);
  try {
    const result = await waitForDiagnostic(api, request);
    openDataViewerDialog(dialog, {
      title: request.title,
      description: request.description,
      status: { value: statusLabel(result.status), tone: statusTone(result.status) },
      details: detailRows(result),
      sections: [
        {
          title: 'Command output',
          code: {
            title: 'Command output',
            value: output(result),
            format: 'shell',
            copy: true,
            download: { filename: 'runtime-diagnostic.txt', label: 'Download' },
          },
        },
      ],
    });
  } catch (error) {
    snack.error(error instanceof Error ? error.message : 'Failed to retrieve runtime diagnostic.');
  }
}
