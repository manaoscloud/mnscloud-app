import { Component } from '@angular/core';
import { BillingWalletPage } from '../../wallet/wallet';

@Component({
  selector: 'app-billing-tenant-ledger',
  standalone: true,
  imports: [BillingWalletPage],
  template: '<app-billing-wallet section="ledger"></app-billing-wallet>',
})
export class BillingTenantLedgerPage {}
