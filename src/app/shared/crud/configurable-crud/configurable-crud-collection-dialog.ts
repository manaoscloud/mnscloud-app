import { Component, afterNextRender, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from './configurable-crud-page-base';

/** Related lists and one-shot actions share the routed CRUD surface and form renderer. */
@Component({
  selector: 'mns-crud-collection-dialog',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: './configurable-crud-page.html',
  styleUrls: ['./configurable-crud-page.scss'],
})
export class ConfigurableCrudCollectionDialog extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly hostDialog = inject(MatDialogRef<ConfigurableCrudCollectionDialog>);
  constructor() {
    super(inject<ConfigurableCrudConfig>(MAT_DIALOG_DATA));
    afterNextRender(() => {
      if (this.config.formOnly) this.startCreate();
    });
  }
  override closeCollectionDialog(): void {
    this.hostDialog.close();
  }
  override closeDialog(): void {
    super.closeDialog();
    if (this.config.formOnly) this.hostDialog.close();
  }
}
