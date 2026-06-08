import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  BILLING_WALLET_IMPORTS,
  BillingWalletPage,
  BillingTenantSection,
} from '../../wallet/wallet';

@Component({
  selector: 'app-billing-tenant-dashboard',
  standalone: true,
  imports: BILLING_WALLET_IMPORTS,
  templateUrl: '../../wallet/wallet.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['../../wallet/wallet.scss'],
})
export class BillingTenantDashboardPage extends BillingWalletPage {
  override section: BillingTenantSection = 'dashboard';
}
