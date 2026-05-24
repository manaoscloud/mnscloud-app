import { Component } from '@angular/core';
import { BillingSystemPage } from '../system';

@Component({
  selector: 'app-billing-system-subscriptions',
  standalone: true,
  imports: [BillingSystemPage],
  template: '<app-billing-system section="subscriptions"></app-billing-system>',
})
export class BillingSystemSubscriptionsPage {}
