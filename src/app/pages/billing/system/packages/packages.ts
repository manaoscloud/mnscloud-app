import { Component } from '@angular/core';
import { BILLING_SYSTEM_IMPORTS, BillingSystemPage, BillingSystemSection } from '../system';

@Component({
  selector: 'app-billing-system-packages',
  standalone: true,
  imports: BILLING_SYSTEM_IMPORTS,
  templateUrl: '../system.html',
  styleUrls: ['../system.scss'],
})
export class BillingSystemPackagesPage extends BillingSystemPage {
  override section: BillingSystemSection = 'packages';
}
