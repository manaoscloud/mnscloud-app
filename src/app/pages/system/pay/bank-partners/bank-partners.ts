import { Component, signal } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { bankPartnersConfig, defaultBankOptions, PEM_FIELDS } from './bank-partners-crud';

@Component({
  selector: 'app-pay-bank-partners',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class SystemPayBankPartnersPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly bankOptions = signal<readonly ConfigurableCrudOption[]>(defaultBankOptions);
  private readonly pemFileNames = new Map<string, string>();

  constructor() {
    super(bankPartnersConfig);
    void this.loadCatalog();
  }

  private async loadCatalog(): Promise<void> {
    try {
      const response = await this.api.get<{ data?: { items?: { code: string; name: string }[] } }>(
        'system/pay/bank-partners',
      );
      const items = response?.data?.items ?? [];
      if (items.length) {
        this.bankOptions.set(items.map((item) => ({ value: item.code, label: item.name })));
      }
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    }
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    return key === 'provider' ? this.bankOptions() : [];
  }

  override startCreate(): void {
    this.pemFileNames.clear();
    super.startCreate();
  }

  override startEdit(row: ConfigurableCrudRecord): void {
    this.pemFileNames.clear();
    super.startEdit(row);
  }

  /** Certificate and key uploads are read as PEM text; the API validates and seals them. */
  override onFileInput(key: string, event: Event): void {
    if (!(PEM_FIELDS as readonly string[]).includes(key)) {
      super.onFileInput(key, event);
      return;
    }
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      this.pemFileNames.delete(key);
      this.setFieldValue(key, '');
      return;
    }
    void file.text().then((content) => {
      this.pemFileNames.set(key, file.name);
      this.setFieldValue(key, content);
    });
  }

  override fieldFileName(key: string): string {
    return this.pemFileNames.get(key) ?? super.fieldFileName(key);
  }

  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: ConfigurableCrudRecord,
  ): Promise<void> {
    const uuid = this.recordUUID(row);
    try {
      if (action.key === 'validate') {
        await this.api.post(`${this.config.endpoint}/${uuid}/validate`, {});
        this.snack.success(this.t('Connection validated.'));
      } else if (action.key === 'webhook') {
        await this.api.post(`${this.config.endpoint}/${uuid}/webhook`, {
          baseUrl: window.location.origin,
        });
        this.snack.success(this.t('Settlement webhook registered with the bank.'));
        this.itemsResource.reload();
      }
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
      if (action.key === 'webhook') this.itemsResource.reload();
    }
  }
}
