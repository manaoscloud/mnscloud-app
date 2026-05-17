import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';

import { fadeIn } from '../../../../shared/animations/fade.animation';
import { ApiService } from '../../../../services/api.service';

@Component({
  selector: 'app-isp-geomap-viability',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
  ],
  templateUrl: './viability.html',
  styleUrls: ['./viability.scss'],
  animations: [fadeIn],
})
export class IspGeoMapViabilityPage {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly result = signal<any | null>(null);

  readonly form = this.fb.nonNullable.group({
    lat: [0, [Validators.required]],
    lng: [0, [Validators.required]],
    radiusM: [300],
    requireFreePort: [true],
  });

  async check() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await this.api.post<any>('isp/geomap/viability/check', this.form.getRawValue());
      this.result.set(response?.data?.viability ?? response);
    } catch (err) {
      console.error('Failed to run viability check.', err);
      this.error.set('Failed to run viability check.');
    } finally {
      this.loading.set(false);
    }
  }
}
