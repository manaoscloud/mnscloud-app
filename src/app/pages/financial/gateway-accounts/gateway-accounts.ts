import { Component, signal } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import {
  defaultGatewayOptions,
  GATEWAY_PEM_FIELDS,
  paymentGatewayConfig,
} from './gateway-accounts-crud';
import { readPemFileInput } from '../../../shared/crud/configurable-crud/pem-file-input';

@Component({
  selector: 'app-payment-gateway',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class FinancialPaymentGatewayPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly gatewayOptions =
    signal<readonly ConfigurableCrudOption[]>(defaultGatewayOptions);
  private readonly pemFileNames = new Map<string, string>();

  constructor() {
    super(paymentGatewayConfig);
    void this.loadCatalog();
  }

  private async loadCatalog(): Promise<void> {
    try {
      const response = await this.api.get<{ data?: { items?: { code: string; name: string }[] } }>(
        'financial/gateway-providers',
      );
      const items = response?.data?.items ?? [];
      if (items.length) {
        this.gatewayOptions.set(items.map((item) => ({ value: item.code, label: item.name })));
      }
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    }
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    return key === 'provider' ? this.gatewayOptions() : [];
  }

  override startCreate(): void {
    this.pemFileNames.clear();
    super.startCreate();
  }

  override startEdit(row: ConfigurableCrudRecord): void {
    this.pemFileNames.clear();
    super.startEdit(row);
  }

  override onFileInput(key: string, event: Event): void {
    if (!(GATEWAY_PEM_FIELDS as readonly string[]).includes(key)) {
      super.onFileInput(key, event);
      return;
    }
    readPemFileInput(event, key, this.pemFileNames, (field, value) =>
      this.setFieldValue(field, value),
    );
  }

  override fieldFileName(key: string): string {
    return this.pemFileNames.get(key) ?? super.fieldFileName(key);
  }

  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: ConfigurableCrudRecord,
  ): Promise<void> {
    if (action.key !== 'validate') return;
    try {
      await this.api.post(`${this.config.endpoint}/${this.recordUUID(row)}/validate`, {});
      this.snack.success(this.t('Connection validated.'));
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    }
  }
}
