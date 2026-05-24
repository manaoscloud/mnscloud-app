import { Component } from '@angular/core';
import { BillingSystemPage } from '../system';

@Component({
  selector: 'app-billing-system-wallets',
  standalone: true,
  imports: [BillingSystemPage],
  template: '<app-billing-system section="wallets"></app-billing-system>',
})
export class BillingSystemWalletsPage {}
