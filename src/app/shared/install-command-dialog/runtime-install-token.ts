import { HttpErrorResponse } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import { SlowConfirmDialogComponent } from '../slow-confirm-dialog/slow-confirm-dialog';

/**
 * Install commands for runtime servers (PABX, SBC, Softswitch, Realtime Media/TURN/WebRTC).
 *
 * The API answers 409 with this code when the server already has an active runtime token. The
 * replacement is only issued after an explicit confirmation, and even then it is staged as a
 * pending token: the running server keeps working until it is reinstalled with the new command.
 */
export const RUNTIME_TOKEN_REPLACE_CONFIRMATION_REQUIRED =
  'RUNTIME_TOKEN_REPLACE_CONFIRMATION_REQUIRED';

export type RuntimeInstallCommandBody = { confirmReplace?: boolean };

export const RUNTIME_TOKEN_PENDING_WARNING =
  'This server is already installed and keeps its current runtime token until it is reinstalled with this command. The new token is shown only once and expires in 7 days if it is not used.';

export function isRuntimeTokenReplaceConfirmationRequired(error: unknown): boolean {
  const response = error as HttpErrorResponse | null;
  return (
    response?.status === 409 &&
    (response.error as { code?: unknown } | null)?.code ===
      RUNTIME_TOKEN_REPLACE_CONFIRMATION_REQUIRED
  );
}

export async function confirmRuntimeTokenReplacement(
  dialog: MatDialog,
  pendingExists: boolean,
): Promise<boolean> {
  const ref = dialog.open(SlowConfirmDialogComponent, {
    data: {
      translate: true,
      title: 'Generate a replacement install command?',
      message: pendingExists
        ? 'This server is already installed and a replacement command was generated before and not used yet. Generating another one invalidates that unused command. The running server keeps its current token until it is reinstalled.'
        : 'This server is already installed. Only continue if you are going to reinstall it. The running server keeps its current token until it is reinstalled with the new command.',
      confirmLabel: 'Generate replacement command',
    },
  });
  return Boolean(await firstValueFrom(ref.afterClosed()));
}

/**
 * Requests an install command; on the replacement-confirmation 409 it asks the operator and
 * retries with `confirmReplace`. Returns null when the operator cancels.
 */
export async function requestRuntimeInstallCommand<T>(
  dialog: MatDialog,
  request: (body: RuntimeInstallCommandBody) => Promise<T>,
): Promise<T | null> {
  try {
    return await request({});
  } catch (error) {
    if (!isRuntimeTokenReplaceConfirmationRequired(error)) throw error;
    const data = ((error as HttpErrorResponse).error as { data?: { hasPendingToken?: boolean } })
      ?.data;
    if (!(await confirmRuntimeTokenReplacement(dialog, Boolean(data?.hasPendingToken)))) {
      return null;
    }
    return await request({ confirmReplace: true });
  }
}

/** Security text for the install dialog: pending replacements get the explicit pending notice. */
export function runtimeInstallTokenWarning(
  data: Record<string, unknown> | null | undefined,
  activeWarning: string,
): string {
  return data?.['tokenState'] === 'pending' ? RUNTIME_TOKEN_PENDING_WARNING : activeWarning;
}
