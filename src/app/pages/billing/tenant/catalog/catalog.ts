import { Component } from '@angular/core';
import { BillingWalletPage } from '../../wallet/wallet';

@Component({
  selector: 'app-billing-tenant-catalog',
  standalone: true,
  imports: [BillingWalletPage],
  template: '<app-billing-wallet section="catalog"></app-billing-wallet>',
})
export class BillingTenantCatalogPage {}
