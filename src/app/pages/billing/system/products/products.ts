import { Component, ChangeDetectionStrategy } from '@angular/core';
import { BILLING_SYSTEM_IMPORTS, BillingSystemPage, BillingSystemSection } from '../system';

@Component({
  selector: 'app-billing-system-products',
  standalone: true,
  imports: BILLING_SYSTEM_IMPORTS,
  templateUrl: '../system.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['../system.scss'],
})
export class BillingSystemProductsPage extends BillingSystemPage {
  override section: BillingSystemSection = 'products';
}
