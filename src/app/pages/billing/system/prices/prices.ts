import { Component } from '@angular/core';
import { BillingSystemPage } from '../system';

@Component({
  selector: 'app-billing-system-prices',
  standalone: true,
  imports: [BillingSystemPage],
  template: '<app-billing-system section="prices"></app-billing-system>',
})
export class BillingSystemPricesPage {}
