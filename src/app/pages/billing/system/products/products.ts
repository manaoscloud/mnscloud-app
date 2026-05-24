import { Component } from '@angular/core';
import { BillingSystemPage } from '../system';

@Component({
  selector: 'app-billing-system-products',
  standalone: true,
  imports: [BillingSystemPage],
  template: '<app-billing-system section="products"></app-billing-system>',
})
export class BillingSystemProductsPage {}
