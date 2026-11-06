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
  MNSCLOUD_PAY,
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
    if (String(row['FgaProvider'] ?? '') === MNSCLOUD_PAY) {
      void this.api
        .get<{ data?: { item?: Record<string, unknown>; configured?: boolean } }>(
          'financial/gateway-accounts/mnscloud-pay/subaccount',
        )
        .then((res) => {
          const sub = res?.data?.item;
          if (sub) {
            if (sub['PtsCompanyType']) this.setFieldValue('companyType', sub['PtsCompanyType']);
            if (sub['PtsIncomeValue'] !== undefined) {
              this.setFieldValue('incomeValue', sub['PtsIncomeValue']);
            }
            if (sub['PtsMobilePhone']) this.setFieldValue('mobilePhone', sub['PtsMobilePhone']);
            if (sub['PtsPayoutMode']) this.setFieldValue('payoutMode', sub['PtsPayoutMode']);
            if (sub['PtsPayoutMinAmount'] !== undefined) {
              this.setFieldValue('payoutMinAmount', sub['PtsPayoutMinAmount']);
            }
            if (sub['PtsPayoutPixKeyType']) {
              this.setFieldValue('payoutPixKeyType', sub['PtsPayoutPixKeyType']);
            }
            if (sub['PtsPayoutPixKey']) this.setFieldValue('payoutPixKey', sub['PtsPayoutPixKey']);
          }
        })
        .catch(() => {});
    }
  }

  override async saveItem(saveAndNew = false): Promise<void> {
    const isMnsPay = String(this.formValues()['provider'] ?? '') === MNSCLOUD_PAY;
    if (isMnsPay) {
      const subData = {
        companyType: this.formValues()['companyType'],
        incomeValue: this.formValues()['incomeValue'],
        mobilePhone: this.formValues()['mobilePhone'],
        payoutMode: this.formValues()['payoutMode'],
        payoutMinAmount: this.formValues()['payoutMinAmount'],
        payoutPixKeyType: this.formValues()['payoutPixKeyType'],
        payoutPixKey: this.formValues()['payoutPixKey'],
      };
      await this.api
        .put('financial/gateway-accounts/mnscloud-pay/subaccount/payout-config', subData)
        .catch(() =>
          this.api.post('financial/gateway-accounts/mnscloud-pay/subaccount/setup', subData)
        )
        .catch(() => {});
    }
    await super.saveItem(saveAndNew);
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
      if (String(row['FgaProvider'] ?? '') === MNSCLOUD_PAY) {
        const sub = await this.api.get<{ data?: { item?: any; configured?: boolean } }>(
          'financial/gateway-accounts/mnscloud-pay/subaccount',
        );
        if (!sub?.data?.configured) {
          await this.api.post('financial/gateway-accounts/mnscloud-pay/subaccount/setup', {});
        }
      }
      await this.api.post(`${this.config.endpoint}/${this.recordUUID(row)}/validate`, {});
      this.snack.success(this.t('Connection validated.'));
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    }
  }
}
