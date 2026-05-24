import { Component } from '@angular/core';
import {
  BILLING_WALLET_IMPORTS,
  BillingWalletPage,
  BillingTenantSection,
} from '../../wallet/wallet';

@Component({
  selector: 'app-billing-tenant-subscriptions',
  standalone: true,
  imports: BILLING_WALLET_IMPORTS,
  templateUrl: '../../wallet/wallet.html',
  styleUrls: ['../../wallet/wallet.scss'],
})
export class BillingTenantSubscriptionsPage extends BillingWalletPage {
  override section: BillingTenantSection = 'subscriptions';
}
