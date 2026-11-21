import { Component } from '@angular/core';
import { ConfigurableCrudCollectionDialog } from '../../shared/crud/configurable-crud/configurable-crud-collection-dialog';
import { CONFIGURABLE_CRUD_IMPORTS } from '../../shared/crud/configurable-crud/configurable-crud-page-base';

/**
 * One-field edit dialog of the patch pages (maintenance group, patch settings): the API takes a
 * PUT on a known record, so the dialog opens in edit mode over `initialValues` (which carry the
 * key the `updateEndpoint` needs) instead of the create mode of a one-shot form.
 */
@Component({
  selector: 'app-cyber-patch-edit-dialog',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class CyberPatchEditDialog extends ConfigurableCrudCollectionDialog {
  override startCreate(): void {
    this.startEdit({ ...this.config.initialValues });
  }
}
