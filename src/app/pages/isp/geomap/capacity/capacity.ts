import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

import { fadeIn } from '../../../../shared/animations/fade.animation';
import { ApiService } from '../../../../services/api.service';

@Component({
  selector: 'app-isp-geomap-capacity',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  templateUrl: './capacity.html',
  styleUrls: ['./capacity.scss'],
  animations: [fadeIn],
})
export class IspGeoMapCapacityPage {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly ctoCapacity = signal<any | null>(null);
  readonly ponCapacity = signal<any | null>(null);

  readonly ctoForm = this.fb.nonNullable.group({
    ctoUUID: ['', [Validators.required]],
  });

  readonly ponForm = this.fb.nonNullable.group({
    ponUUID: ['', [Validators.required]],
  });

  async loadCto() {
    if (this.ctoForm.invalid) return;
    this.loading.set(true);
    this.error.set(null);

    try {
      const uuid = this.ctoForm.getRawValue().ctoUUID;
      const response = await this.api.get<any>(`isp/geomap/capacity/cto/${uuid}`);
      this.ctoCapacity.set(response?.data?.capacity ?? response);
    } catch (err) {
      console.error('Failed to load CTO capacity.', err);
      this.error.set('Failed to load CTO capacity.');
    } finally {
      this.loading.set(false);
    }
  }

  async loadPon() {
    if (this.ponForm.invalid) return;
    this.loading.set(true);
    this.error.set(null);

    try {
      const uuid = this.ponForm.getRawValue().ponUUID;
      const response = await this.api.get<any>(`isp/geomap/capacity/pon/${uuid}`);
      this.ponCapacity.set(response?.data?.capacity ?? response);
    } catch (err) {
      console.error('Failed to load PON capacity.', err);
      this.error.set('Failed to load PON capacity.');
    } finally {
      this.loading.set(false);
    }
  }
}
