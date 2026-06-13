import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

// Angular Material
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatTabsModule } from '@angular/material/tabs';

// Services
import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { isSignedStorageUrl } from '../../../shared/storage/signed-url';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../shared/refresh-button/refresh-button';

// Models
import { UserProfile } from '../../../models/user-profile.model';

// Animations

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatDividerModule,
    MatTabsModule,
    TranslocoPipe,
  ],
  templateUrl: './user-profile.html',
  styleUrls: ['./user-profile.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserProfileComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly snack = inject(SnackbarService);

  private readonly profileResource = resource({
    loader: () => this.fetchProfile(),
  });

  readonly loading = this.profileResource.isLoading;
  readonly saving = signal(false);
  readonly apiError = signal<string | null>(null);

  // Avatar state
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

  readonly profileForm: FormGroup = this.fb.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    email: [{ value: '', disabled: true }],
    phone: [''],
    dateBirth: [null as Date | null],
    newPassword: [''],
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
    const firstName: string = this.profileForm.get('firstName')?.value ?? '';
    const email: string = this.profileForm.get('email')?.value ?? '';

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

      // Atualiza UI local
      this.currentAvatarUrl.set(newUrl);
      this.avatarPreviewUrl.set(null);
      this.avatarFile = null;
      this.clearAvatarInput();
      this.avatarVersion.set(newVersion);

      // 🔥 Atualiza AuthService → reflete no main-layout
      this.auth.updateUser({
        avatarUrl: newUrl,
        avatarVersion: newVersion,
      });

      this.snack.success('Avatar updated successfully.');
    } catch (err) {
      console.error('❌ save avatar error:', err);
      this.snack.error('Failed to update avatar.');
    } finally {
      this.savingAvatar.set(false);
    }
  }

  async onSave() {
    if (this.saving() || this.loading() || this.profileForm.invalid) return;

    this.saving.set(true);
    this.apiError.set(null);

    const value = this.profileForm.getRawValue();

    const dateBirthStr =
      value.dateBirth instanceof Date ? value.dateBirth.toISOString().substring(0, 10) : null;

    const newPassword = (value.newPassword ?? '').trim();

    const body: any = {
      firstName: (value.firstName ?? '').trim(),
      lastName: (value.lastName ?? '').trim(),
      phone: (value.phone ?? '').trim() || null,
      dateBirth: dateBirthStr,
    };

    if (newPassword.length > 0) {
      body.newPassword = newPassword;
    }

    try {
      await this.api.put('user/profile', body);

      // 🔥 Atualiza AuthService → nome no topo / avatar letra
      this.auth.updateUser({
        firstName: body.firstName,
        lastName: body.lastName,
      });

      this.snack.success('Profile updated successfully.');

      this.profileForm.patchValue({ newPassword: '' });
      this.refreshProfile();
    } catch (err) {
      console.error('❌ save profile error:', err);
      this.snack.error('Failed to save your profile.');
    }

    this.saving.set(false);
  }

  onReset() {
    const p = this.profile();
    if (!p) return;

    const date = p.dateBirth ? new Date(p.dateBirth + 'T00:00:00') : null;

    this.profileForm.reset({
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email,
      phone: p.phone ?? '',
      dateBirth: date,
      newPassword: '',
    });

    this.currentAvatarUrl.set(p.avatarUrl ?? null);
    this.avatarPreviewUrl.set(null);
    this.avatarFile = null;
    this.clearAvatarInput();
    this.avatarVersion.set(Date.now());
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
    };
  }

  private applyProfile(profile: UserProfile) {
    this.profile.set(profile);

    const date = profile.dateBirth ? new Date(profile.dateBirth + 'T00:00:00') : null;

    this.profileForm.reset({
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      phone: profile.phone ?? '',
      dateBirth: date,
      newPassword: '',
    });

    this.currentAvatarUrl.set(profile.avatarUrl ?? null);
    this.avatarPreviewUrl.set(null);
    this.avatarFile = null;
    this.clearAvatarInput();
    this.avatarVersion.set(Date.now());
  }

  private errorMessage(error: unknown, fallback: string): string {
    const serverMessage = (error as any)?.error?.error || (error as any)?.error?.message;
    if (typeof serverMessage === 'string' && serverMessage.trim()) return serverMessage;
    if (error instanceof Error && error.message) return error.message;
    return fallback;
  }
}
