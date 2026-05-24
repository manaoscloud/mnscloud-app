import { Component } from '@angular/core';
import { BillingWalletPage } from '../../wallet/wallet';

@Component({
  selector: 'app-billing-tenant-subscriptions',
  standalone: true,
  imports: [BillingWalletPage],
  template: '<app-billing-wallet section="subscriptions"></app-billing-wallet>',
})
export class BillingTenantSubscriptionsPage {}
