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
  host: { '[class.collection-dialog-host]': '!config.formOnly' },
})
export class ConfigurableCrudCollectionDialog extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly hostDialog = inject(MatDialogRef<ConfigurableCrudCollectionDialog>);
  constructor() {
    super(inject<ConfigurableCrudConfig>(MAT_DIALOG_DATA));
    afterNextRender(async () => {
      if (this.config.formOnly && this.config.editRecordUUID) {
        try {
          const response = await this.api.get<{ data: ConfigurableCrudRecord }>(
            `${this.config.endpoint}/${encodeURIComponent(this.config.editRecordUUID)}`,
          );
          if (this.destroyRef.destroyed) return;
          if (
            String(response.data[this.config.uuidField]) !== this.config.editRecordUUID ||
            !this.canEditRow(response.data)
          ) {
            this.hostDialog.close();
            return;
          }
          this.startEdit(response.data);
        } catch {
          this.hostDialog.close();
        }
      } else if (this.config.formOnly) this.startCreate();
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
