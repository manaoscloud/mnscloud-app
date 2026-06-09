import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  BILLING_WALLET_IMPORTS,
  BillingWalletPage,
  BillingTenantSection,
} from '../../wallet/wallet';

@Component({
  selector: 'app-billing-tenant-catalog',
  standalone: true,
  imports: BILLING_WALLET_IMPORTS,
  templateUrl: '../../wallet/wallet.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['../../wallet/wallet.scss'],
})
export class BillingTenantCatalogPage extends BillingWalletPage {
  override section: BillingTenantSection = 'catalog';
}
