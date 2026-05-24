import { Component } from '@angular/core';
import { BillingSystemPage } from '../system';

@Component({
  selector: 'app-billing-system-dashboard',
  standalone: true,
  imports: [BillingSystemPage],
  template: '<app-billing-system section="dashboard"></app-billing-system>',
})
export class BillingSystemDashboardPage {}
