import { DestroyRef } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

import type {
  ConfigurableCrudColumn,
  ConfigurableCrudOption,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { openInstallCommandDialog } from '../../shared/install-command-dialog/open-install-command-dialog';
import type { InstallCommandDialogData } from '../../shared/install-command-dialog/install-command-dialog';

/**
 * Helpers shared by the Network runtime pages (Gateways and Connectors): typed form text, option
 * lists, the common status columns and the show-once install command flow.
 */

/** Text of a value: strings as they are, numbers stringified, anything else empty. */
export function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

/** Trimmed text of a form value, or null when empty. */
export function textOrNull(value: unknown): string | null {
  return asText(value).trim() || null;
}

/** Static options whose labels are the `<prefix>.<value>` translation keys. */
export function prefixedOptions(
  prefix: string,
  values: readonly string[],
): readonly ConfigurableCrudOption[] {
  return values.map((value) => ({ value, label: `${prefix}.${value}` }));
}

/** Online chip column (`Online` 0/1) of a runtime inventory page. */
export function onlineColumn(prefix: string): ConfigurableCrudColumn {
  return {
    id: 'online',
    label: `${prefix}.online`,
    field: 'Online',
    kind: 'status',
    options: [
      { value: 1, label: `${prefix}.onlineYes` },
      { value: 0, label: `${prefix}.onlineNo` },
    ],
    chipClass: (value) => (Number(value) === 1 ? 'chip-success' : 'chip-failed'),
  };
}

/** Heartbeat and last error columns of a runtime inventory page (record column prefix). */
export function heartbeatColumns(prefix: string, recordPrefix: string): ConfigurableCrudColumn[] {
  return [
    {
      id: 'heartbeat',
      label: `${prefix}.heartbeat`,
      field: `${recordPrefix}HeartbeatAt`,
      kind: 'datetime',
      optional: true,
    },
    {
      id: 'error',
      label: `${prefix}.lastError`,
      field: `${recordPrefix}LastErrorCode`,
      optional: true,
    },
  ];
}

export type InstallFlowHost = {
  dialog: MatDialog;
  destroyRef: DestroyRef;
  onError: (error: unknown) => void;
  onShown: () => void;
};

/**
 * Requests an install command and shows it once in the shared dialog; nothing is stored. A null
 * response (operator cancelled) shows nothing.
 */
export async function showInstallCommand(
  host: InstallFlowHost,
  request: () => Promise<{ data: Record<string, unknown> } | null>,
  dialogData: (data: Record<string, unknown>) => InstallCommandDialogData,
): Promise<void> {
  try {
    const response = await request();
    if (!response) return;
    openInstallCommandDialog(host.dialog, dialogData(response.data), host.destroyRef);
    host.onShown();
  } catch (error) {
    host.onError(error);
  }
}
