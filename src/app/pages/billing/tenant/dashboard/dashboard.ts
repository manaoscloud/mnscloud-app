import { Component } from '@angular/core';
import { BillingWalletPage } from '../../wallet/wallet';

@Component({
  selector: 'app-billing-tenant-dashboard',
  standalone: true,
  imports: [BillingWalletPage],
  template: '<app-billing-wallet section="dashboard"></app-billing-wallet>',
})
export class BillingTenantDashboardPage {}
