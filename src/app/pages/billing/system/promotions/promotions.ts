import { Component } from '@angular/core';
import { BILLING_SYSTEM_IMPORTS, BillingSystemPage, BillingSystemSection } from '../system';

@Component({
  selector: 'app-billing-system-promotions',
  standalone: true,
  imports: BILLING_SYSTEM_IMPORTS,
  templateUrl: '../system.html',
  styleUrls: ['../system.scss'],
})
export class BillingSystemPromotionsPage extends BillingSystemPage {
  override section: BillingSystemSection = 'promotions';
}
