import { Component, inject } from '@angular/core';

import { CONFIGURABLE_CRUD_EMBEDDED } from './configurable-crud-embedded';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudField,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudSaveContext,
} from './configurable-crud-page-base';

/**
 * Related collection inside a parent form tab, rendered by the global table: search, status
 * filter, density, columns, pagination, mobile cards, loading, report problem and the standard
 * create/edit dialog. Lookups and hooks stay in the parent page through the embedded host.
 */
@Component({
  selector: 'mns-crud-embedded-collection',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: './configurable-crud-page.html',
  styleUrls: ['./configurable-crud-page.scss'],
})
export class ConfigurableCrudEmbeddedCollection extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly embeddedHost = inject(CONFIGURABLE_CRUD_EMBEDDED);

  constructor() {
    super({ ...inject(CONFIGURABLE_CRUD_EMBEDDED).config, embedded: true });
    const detach = this.embeddedHost.attach(() => this.refreshList());
    this.destroyRef.onDestroy(detach);
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    const field = this.config.fields.find((item) => item.key === key);
    return field ? this.embeddedHost.options(field, this.formValues()) : [];
  }

  protected override lookupLabel(key: string, value: unknown): string {
    return super.lookupLabel(key, value) || this.embeddedHost.label(key, value);
  }

  override fieldLoading(field: ConfigurableCrudField): boolean {
    return super.fieldLoading(field) || this.embeddedHost.loading(field);
  }

  protected override deleteUrlFor(row: ConfigurableCrudRecord): string {
    return this.embeddedHost.deleteUrl(row);
  }

  protected override afterDelete(): void {
    this.embeddedHost.changed();
  }

  protected override afterRowActionRequest(): void {
    this.embeddedHost.changed();
  }

  protected override async afterSave(
    context: ConfigurableCrudSaveContext<ConfigurableCrudRecord>,
  ): Promise<void> {
    if (context.mode === 'update') {
      this.embeddedHost.changed();
      return;
    }
    const response = context.response as {
      data?: { item?: ConfigurableCrudRecord; items?: ConfigurableCrudRecord[] };
    } | null;
    // Child endpoints answer with the created record or with the refreshed list.
    const created = response?.data?.item ?? response?.data?.items?.[0] ?? null;
    await this.embeddedHost.rowAdded(created);
  }
}
