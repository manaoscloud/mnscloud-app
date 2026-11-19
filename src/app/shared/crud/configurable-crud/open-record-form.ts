import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import type { ConfigurableCrudConfig } from './configurable-crud-page-base';

/** Reuse a canonical configuration for one create/edit operation, without a second renderer. */
export async function openRecordForm(
  dialog: MatDialog,
  config: ConfigurableCrudConfig,
): Promise<void> {
  const { ConfigurableCrudCollectionDialog } =
    await import('./configurable-crud-collection-dialog');
  const ref = dialog.open(ConfigurableCrudCollectionDialog, {
    data: { ...config, formOnly: true, collectionDialog: true },
    width: '0',
    maxWidth: '0',
    height: '0',
    maxHeight: '0',
    autoFocus: false,
    restoreFocus: true,
    panelClass: 'quick-create-host-dialog',
    disableClose: true,
  });
  await firstValueFrom(ref.afterClosed());
}
