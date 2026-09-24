import { HttpErrorResponse } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

import {
  isRuntimeTokenReplaceConfirmationRequired,
  requestRuntimeInstallCommand,
  RUNTIME_TOKEN_PENDING_WARNING,
  RUNTIME_TOKEN_REPLACE_CONFIRMATION_REQUIRED,
  runtimeInstallTokenWarning,
  type RuntimeInstallCommandBody,
} from './runtime-install-token';

function confirmationError(hasPendingToken = false) {
  return new HttpErrorResponse({
    status: 409,
    error: {
      error: 'Confirm',
      code: RUNTIME_TOKEN_REPLACE_CONFIRMATION_REQUIRED,
      data: { hasActiveToken: true, hasPendingToken },
    },
  });
}

function dialogAnswering(answer: boolean | undefined) {
  const dialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
  dialog.open.and.returnValue({ afterClosed: () => of(answer) } as never);
  return dialog;
}

describe('runtime install token', () => {
  it('returns the first response without confirmation when the server has no active token', async () => {
    const dialog = dialogAnswering(true);
    const bodies: RuntimeInstallCommandBody[] = [];
    const result = await requestRuntimeInstallCommand(dialog, (body) => {
      bodies.push(body);
      return Promise.resolve({ data: { tokenState: 'active' } });
    });

    expect(result).toEqual({ data: { tokenState: 'active' } });
    expect(bodies).toEqual([{}]);
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('asks before replacing and retries with confirmReplace when confirmed', async () => {
    const dialog = dialogAnswering(true);
    const bodies: RuntimeInstallCommandBody[] = [];
    const result = await requestRuntimeInstallCommand(dialog, (body) => {
      bodies.push(body);
      return body.confirmReplace
        ? Promise.resolve({ data: { tokenState: 'pending' } })
        : Promise.reject(confirmationError());
    });

    expect(dialog.open).toHaveBeenCalledTimes(1);
    expect(bodies).toEqual([{}, { confirmReplace: true }]);
    expect(result).toEqual({ data: { tokenState: 'pending' } });
  });

  it('does not issue a replacement when the operator cancels', async () => {
    const dialog = dialogAnswering(undefined);
    const bodies: RuntimeInstallCommandBody[] = [];
    const result = await requestRuntimeInstallCommand(dialog, (body) => {
      bodies.push(body);
      return Promise.reject(confirmationError(true));
    });

    expect(result).toBeNull();
    expect(bodies).toEqual([{}]);
  });

  it('rethrows unrelated errors without asking', async () => {
    const dialog = dialogAnswering(true);
    const failure = new HttpErrorResponse({ status: 400, error: { error: 'Invalid' } });

    await expectAsync(
      requestRuntimeInstallCommand(dialog, () => Promise.reject(failure)),
    ).toBeRejectedWith(failure);
    expect(dialog.open).not.toHaveBeenCalled();
    expect(isRuntimeTokenReplaceConfirmationRequired(failure)).toBeFalse();
  });

  it('shows the pending notice only for pending replacement tokens', () => {
    expect(runtimeInstallTokenWarning({ tokenState: 'pending' }, 'active')).toBe(
      RUNTIME_TOKEN_PENDING_WARNING,
    );
    expect(runtimeInstallTokenWarning({ tokenState: 'active' }, 'active')).toBe('active');
    expect(runtimeInstallTokenWarning(null, 'active')).toBe('active');
  });
});
