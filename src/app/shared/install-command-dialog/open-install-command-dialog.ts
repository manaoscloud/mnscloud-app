import { DestroyRef } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import { openCrudComponentDialog } from '../dialog/crud-dialog.util';
import { InstallCommandDialogComponent, InstallCommandDialogData } from './install-command-dialog';

/** One command dialog at a time: opening a new command closes the previous one. */
let current: MatDialogRef<unknown> | null = null;

/**
 * The only supported way to show a generated install/enrollment command (app.md "Install Command
 * Dialog Baseline"): CRUD dialog geometry (`crud-form-dialog`), Escape to close, responsive binding
 * released on close, and the dialog closed when the owning page is destroyed. `onClosed` lets the
 * caller clear the generated token.
 */
export function openInstallCommandDialog(
  dialog: MatDialog,
  data: InstallCommandDialogData,
  destroyRef: DestroyRef,
  onClosed?: () => void,
): MatDialogRef<unknown> {
  current?.close();
  const binding = openCrudComponentDialog(
    dialog,
    InstallCommandDialogComponent,
    'crud-form-dialog',
    {
      data,
    },
  );
  current = binding.ref;
  const unregisterDestroy = destroyRef.onDestroy(() => binding.ref.close());
  const cleanup = () => {
    binding.stop();
    unregisterDestroy();
    if (current === binding.ref) current = null;
    onClosed?.();
  };
  void firstValueFrom(binding.ref.afterClosed()).then(cleanup, cleanup);
  return binding.ref;
}
