import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';

import { fadeIn } from '../../../../shared/animations/fade.animation';
import { ApiService } from '../../../../services/api.service';

@Component({
  selector: 'app-isp-geomap-ftth',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatListModule,
  ],
  templateUrl: './ftth.html',
  styleUrls: ['./ftth.scss'],
  animations: [fadeIn],
})
export class IspGeoMapFtthPage {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly lastResponse = signal<any | null>(null);
  readonly searchingCustomers = signal(false);
  readonly customerResults = signal<ErpCustomerItem[]>([]);
  readonly customerQuery = signal('');

  readonly customerForm = this.fb.nonNullable.group({
    query: ['', [Validators.minLength(2)]],
  });

  readonly connectForm = this.fb.nonNullable.group({
    fromType: ['', [Validators.required]],
    fromUUID: ['', [Validators.required]],
    toType: ['', [Validators.required]],
    toUUID: ['', [Validators.required]],
    linkType: ['LOGICAL'],
  });

  readonly disconnectForm = this.fb.nonNullable.group({
    linkUUID: ['', [Validators.required]],
  });

  readonly traceForm = this.fb.nonNullable.group({
    customerUUID: ['', [Validators.required]],
  });

  async searchCustomers() {
    const query = this.customerForm.getRawValue().query.trim();
    this.customerQuery.set(query);

    if (!query) {
      this.customerResults.set([]);
      return;
    }

    this.searchingCustomers.set(true);
    this.error.set(null);

    try {
      const response = await this.api.get<any>(`erp/customers?q=${encodeURIComponent(query)}&limit=10`);
      const items = response?.data?.items ?? [];
      const mapped = items.map((item: any) => ({
        CustomerUUID: item.CustomerUUID,
        Name: item.Name,
        Document: item.Document ?? null,
        Email: item.Email ?? null,
      }));
      this.customerResults.set(mapped);
    } catch (err) {
      console.error('Failed to search customers.', err);
      this.error.set('Failed to search customers.');
    } finally {
      this.searchingCustomers.set(false);
    }
  }

  useCustomerForTrace(customer: ErpCustomerItem) {
    this.traceForm.patchValue({ customerUUID: customer.CustomerUUID });
  }

  useCustomerForConnect(customer: ErpCustomerItem) {
    this.connectForm.patchValue({ toType: 'CUSTOMER', toUUID: customer.CustomerUUID });
  }

  async connect() {
    if (this.connectForm.invalid) return;
    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await this.api.post<any>('isp/geomap/ftth/connect', this.connectForm.getRawValue());
      this.lastResponse.set(response?.data?.item ?? response);
    } catch (err) {
      console.error('Failed to connect FTTH.', err);
      this.error.set('Failed to connect FTTH.');
    } finally {
      this.loading.set(false);
    }
  }

  async disconnect() {
    if (this.disconnectForm.invalid) return;
    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await this.api.post<any>('isp/geomap/ftth/disconnect', this.disconnectForm.getRawValue());
      this.lastResponse.set(response?.data?.item ?? response);
    } catch (err) {
      console.error('Failed to disconnect FTTH.', err);
      this.error.set('Failed to disconnect FTTH.');
    } finally {
      this.loading.set(false);
    }
  }

  async trace() {
    if (this.traceForm.invalid) return;
    this.loading.set(true);
    this.error.set(null);

    try {
      const uuid = this.traceForm.getRawValue().customerUUID;
      const response = await this.api.get<any>(`isp/geomap/ftth/trace/customer/${uuid}`);
      this.lastResponse.set(response?.data?.trace ?? response);
    } catch (err) {
      console.error('Failed to trace FTTH.', err);
      this.error.set('Failed to trace FTTH.');
    } finally {
      this.loading.set(false);
    }
  }
}

type ErpCustomerItem = {
  CustomerUUID: string;
  Name: string;
  Document?: string | null;
  Email?: string | null;
};
