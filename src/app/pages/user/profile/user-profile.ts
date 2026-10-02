import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { FormField, form, maxLength, minLength, pattern, required } from '@angular/forms/signals';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';

import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { isSignedStorageUrl } from '../../../shared/storage/signed-url';
import { TranslocoPipe } from '@jsverse/transloco';
import { DateMaskDirective } from '../../../shared/date-mask/date-mask.directive';
import { MnsDateAdapterModule } from '../../../shared/date-mask/mns-date-adapter.module';
import { SettingsPageComponent } from '../../../shared/pages/settings-page';
import { FieldHelpComponent } from '../../../shared/forms/field-help';
import { MnsSearchSelectFieldComponent } from '../../../shared/forms/mns-search-select-field/mns-search-select-field';
import { UserProfile } from '../../../models/user-profile.model';

type ProfileFormModel = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateBirth: Date | null;
  newPassword: string;
  document: string;
  addressZip: string;
  addressStreet: string;
  addressNumber: string;
  addressComplement: string;
  addressDistrict: string;
  addressCity: string;
  addressState: string;
};

const BILLING_KEYS = [
  'document',
  'addressZip',
  'addressStreet',
  'addressNumber',
  'addressComplement',
  'addressDistrict',
  'addressCity',
  'addressState',
] as const;

/** Brazilian states (UF codes are not translated). */
const STATE_OPTIONS = [
  'AC',
  'AL',
  'AM',
  'AP',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MG',
  'MS',
  'MT',
  'PA',
  'PB',
  'PE',
  'PI',
  'PR',
  'RJ',
  'RN',
  'RO',
  'RR',
  'RS',
  'SC',
  'SE',
  'SP',
  'TO',
].map((value) => ({ value, label: value }));

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [
    FormField,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatDatepickerModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatTabsModule,
    TranslocoPipe,
    DateMaskDirective,
    MnsDateAdapterModule,
    SettingsPageComponent,
    FieldHelpComponent,
    MnsSearchSelectFieldComponent,
  ],
  templateUrl: './user-profile.html',
  styleUrls: ['./user-profile.scss'],
})
export class UserProfileComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly snack = inject(SnackbarService);

  private readonly profileResource = resource({
    loader: () => this.fetchProfile(),
  });

  readonly loading = this.profileResource.isLoading;
  readonly saving = signal(false);
  readonly apiError = signal<string | null>(null);

  readonly currentAvatarUrl = signal<string | null>(null);
  readonly avatarPreviewUrl = signal<string | null>(null);
  readonly savingAvatar = signal(false);
  readonly avatarVersion = signal<number>(Date.now());

  private avatarFile: File | null = null;

  readonly effectiveAvatarUrl = computed(() => this.avatarPreviewUrl() ?? this.currentAvatarUrl());

  readonly effectiveAvatarDisplayUrl = computed(() => {
    const url = this.effectiveAvatarUrl();
    if (!url) return null;
    if (url.startsWith('data:')) return url;
    if (isSignedStorageUrl(url)) return url;

    const v = this.avatarVersion();
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${v}`;
  });

  readonly profile = signal<UserProfile | null>(null);
  readonly stateOptions = STATE_OPTIONS;
  readonly searchingZip = signal(false);

  readonly formModel = signal<ProfileFormModel>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateBirth: null,
    newPassword: '',
    document: '',
    addressZip: '',
    addressStreet: '',
    addressNumber: '',
    addressComplement: '',
    addressDistrict: '',
    addressCity: '',
    addressState: '',
  });

  private readonly baselineModel = signal<ProfileFormModel | null>(null);

  readonly profileForm = form(this.formModel, (schema) => {
    required(schema.firstName);
    minLength(schema.firstName, 2);
    required(schema.lastName);
    minLength(schema.lastName, 2);
    // Inter Cobrança payer limits (CPF/CEP digits, UF).
    pattern(schema.document, /^(\d{3}\.?\d{3}\.?\d{3}-?\d{2})?$/);
    pattern(schema.addressZip, /^(\d{5}-?\d{3})?$/);
    maxLength(schema.addressStreet, 100);
    maxLength(schema.addressNumber, 10);
    maxLength(schema.addressComplement, 30);
    maxLength(schema.addressDistrict, 60);
    maxLength(schema.addressCity, 60);
  });

  readonly hasChanges = computed(() => {
    if (this.avatarFile || this.avatarPreviewUrl()) return true;
    const baseline = this.baselineModel();
    if (!baseline) return false;
    const current = this.formModel();
    return (
      current.firstName !== baseline.firstName ||
      current.lastName !== baseline.lastName ||
      current.phone !== baseline.phone ||
      this.dateKey(current.dateBirth) !== this.dateKey(baseline.dateBirth) ||
      BILLING_KEYS.some((key) => current[key] !== baseline[key]) ||
      (current.newPassword ?? '').trim().length > 0
    );
  });

  readonly avatarInput = viewChild<ElementRef<HTMLInputElement>>('avatarInput');

  private readonly profileEffect = effect(() => {
    const profile = this.profileResource.value();
    if (!profile) return;
    this.applyProfile(profile);
  });

  private readonly profileErrorEffect = effect(() => {
    const error = this.profileResource.error();
    if (!error) return;
    const message = this.errorMessage(error, 'Failed to load your profile.');
    this.apiError.set(message);
    this.snack.error(message);
  });

  refreshProfile() {
    this.profileResource.reload();
  }

  get avatarLetter(): string {
    const { firstName, email } = this.formModel();
    if (firstName) return firstName.charAt(0).toUpperCase();
    if (email) return email.charAt(0).toUpperCase();
    return 'U';
  }

  openAvatarFilePicker() {
    this.avatarInput()?.nativeElement.click();
  }

  clearAvatarInput() {
    const avatarInput = this.avatarInput();
    if (avatarInput?.nativeElement) {
      avatarInput.nativeElement.value = '';
    }
  }

  onAvatarFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];

    if (!file.type.startsWith('image/')) {
      this.snack.warning('Only image files are allowed.');
      input.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.snack.warning('Image is too large. Maximum is 5MB.');
      input.value = '';
      return;
    }

    this.avatarFile = file;

    const reader = new FileReader();
    reader.onload = () => {
      this.avatarPreviewUrl.set(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  onCancelAvatarChange() {
    this.avatarPreviewUrl.set(null);
    this.avatarFile = null;
    this.clearAvatarInput();
  }

  savingAvatarDisabled(): boolean {
    return !this.avatarFile || this.savingAvatar() || this.loading();
  }

  async onSaveAvatar() {
    if (!this.avatarFile || this.savingAvatar() || this.loading()) return;

    this.savingAvatar.set(true);
    this.apiError.set(null);

    try {
      const formData = new FormData();
      formData.append('avatar', this.avatarFile, this.avatarFile.name);

      const resp = await this.api.put<any>('user/avatar', formData);
      const newUrl = resp?.avatarUrl ?? resp?.data?.avatarUrl ?? null;
      if (!newUrl) {
        throw new Error('Avatar URL not returned by API.');
      }

      const newVersion = Date.now();
      this.currentAvatarUrl.set(newUrl);
      this.avatarPreviewUrl.set(null);
      this.avatarFile = null;
      this.clearAvatarInput();
      this.avatarVersion.set(newVersion);
      this.auth.updateUser({
        avatarUrl: newUrl,
        avatarVersion: newVersion,
      });
      this.snack.success('Avatar updated successfully.');
    } catch (err) {
      console.error('save avatar error:', err);
      this.snack.error('Failed to update avatar.');
    } finally {
      this.savingAvatar.set(false);
    }
  }

  async onSave() {
    if (this.saving() || this.loading() || !this.profileForm().valid()) return;

    this.saving.set(true);
    this.apiError.set(null);

    const value = this.formModel();
    const dateBirthStr =
      value.dateBirth instanceof Date ? value.dateBirth.toISOString().substring(0, 10) : null;
    const newPassword = (value.newPassword ?? '').trim();

    const body: Record<string, unknown> = {
      firstName: (value.firstName ?? '').trim(),
      lastName: (value.lastName ?? '').trim(),
      phone: (value.phone ?? '').trim() || null,
      dateBirth: dateBirthStr,
      billing: Object.fromEntries(
        BILLING_KEYS.map((key) => {
          const text = (value[key] ?? '').trim();
          const normalized =
            key === 'document' || key === 'addressZip' ? text.replace(/\D/g, '') : text;
          return [key, normalized || null];
        }),
      ),
    };

    if (newPassword.length > 0) {
      body['newPassword'] = newPassword;
    }

    try {
      await this.api.put('user/profile', body);
      this.auth.updateUser({
        firstName: String(body['firstName'] ?? ''),
        lastName: String(body['lastName'] ?? ''),
      });
      this.snack.success('Profile updated successfully.');
      this.formModel.update((current) => ({ ...current, newPassword: '' }));
      this.refreshProfile();
    } catch (err) {
      console.error('save profile error:', err);
      this.snack.error(this.errorMessage(err, 'Failed to save your profile.'));
    }

    this.saving.set(false);
  }

  onReset() {
    const baseline = this.baselineModel();
    if (!baseline) return;

    this.formModel.set({ ...baseline, newPassword: '' });
    this.currentAvatarUrl.set(this.profile()?.avatarUrl ?? null);
    this.avatarPreviewUrl.set(null);
    this.avatarFile = null;
    this.clearAvatarInput();
    this.avatarVersion.set(Date.now());
    this.apiError.set(null);
  }

  private async fetchProfile(): Promise<UserProfile> {
    this.apiError.set(null);
    const response = await this.api.get<any>('user/profile');
    const raw = response.data;

    return {
      userUUID: raw.UserUUID,
      firstName: raw.FirstName ?? '',
      lastName: raw.LastName ?? '',
      email: raw.Email ?? '',
      phone: raw.Phone ?? '',
      dateBirth: raw.DateBirth ? raw.DateBirth.substring(0, 10) : null,
      status: raw.Status,
      dateCreated: raw.DateCreated,
      avatarUrl: raw.AvatarUrl ?? raw.Avatar ?? null,
      document: raw.Document ?? '',
      addressZip: raw.AddressZip ?? '',
      addressStreet: raw.AddressStreet ?? '',
      addressNumber: raw.AddressNumber ?? '',
      addressComplement: raw.AddressComplement ?? '',
      addressDistrict: raw.AddressDistrict ?? '',
      addressCity: raw.AddressCity ?? '',
      addressState: raw.AddressState ?? '',
    };
  }

  private applyProfile(profile: UserProfile) {
    this.profile.set(profile);

    const date = profile.dateBirth ? new Date(profile.dateBirth + 'T00:00:00') : null;
    const next: ProfileFormModel = {
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      phone: profile.phone ?? '',
      dateBirth: date,
      newPassword: '',
      document: profile.document,
      addressZip: profile.addressZip,
      addressStreet: profile.addressStreet,
      addressNumber: profile.addressNumber,
      addressComplement: profile.addressComplement,
      addressDistrict: profile.addressDistrict,
      addressCity: profile.addressCity,
      addressState: profile.addressState,
    };

    this.formModel.set(next);
    this.baselineModel.set({ ...next });
    this.currentAvatarUrl.set(profile.avatarUrl ?? null);
    this.avatarPreviewUrl.set(null);
    this.avatarFile = null;
    this.clearAvatarInput();
    this.avatarVersion.set(Date.now());
  }

  /** Fills street, district, city and state from the CEP (platform postal-code lookup). */
  async searchZip() {
    const zip = (this.formModel().addressZip ?? '').replace(/\D/g, '');
    if (zip.length !== 8) {
      this.snack.warning('Invalid postal code. Provide 8 digits.');
      return;
    }
    this.searchingZip.set(true);
    try {
      const response = await this.api.get<{ data?: { item?: Record<string, string | null> } }>(
        `postal-codes/${zip}`,
      );
      const item = response?.data?.item ?? {};
      this.formModel.update((current) => ({
        ...current,
        addressZip: zip,
        addressStreet: item['street'] || current.addressStreet,
        addressDistrict: item['district'] || current.addressDistrict,
        addressCity: item['city'] || current.addressCity,
        addressState: item['state'] || current.addressState,
      }));
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to search postal code.'));
    } finally {
      this.searchingZip.set(false);
    }
  }

  private dateKey(value: Date | null): string {
    return value instanceof Date ? value.toISOString().substring(0, 10) : '';
  }

  private errorMessage(error: unknown, fallback: string): string {
    const serverMessage = (error as any)?.error?.error || (error as any)?.error?.message;
    if (typeof serverMessage === 'string' && serverMessage.trim()) return serverMessage;
    if (error instanceof Error && error.message) return error.message;
    return fallback;
  }
}
