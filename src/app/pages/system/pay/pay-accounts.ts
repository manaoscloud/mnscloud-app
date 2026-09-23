import { Component, inject, resource } from '@angular/core';
import { ApiService } from '../../../services/api.service';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudOption,
  ConfigurableCrudConfig,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { paymentAccountConfig } from '../../../shared/payment/payment-account-crud';

const config = paymentAccountConfig(true);
@Component({
  selector: 'app-pay-accounts',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class SystemPayAccountsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
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
