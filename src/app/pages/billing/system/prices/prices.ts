import { Component, ChangeDetectionStrategy } from '@angular/core';
import { BILLING_SYSTEM_IMPORTS, BillingSystemPage, BillingSystemSection } from '../system';

@Component({
  selector: 'app-billing-system-prices',
  standalone: true,
  imports: BILLING_SYSTEM_IMPORTS,
  templateUrl: '../system.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['../system.scss'],
})
export class BillingSystemPricesPage extends BillingSystemPage {
  override section: BillingSystemSection = 'prices';
}
