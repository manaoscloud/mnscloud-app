import { Component, OnInit, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSelectModule } from '@angular/material/select';

import { ApiService } from '../../../services/api.service';
import { fadeIn } from '../../../shared/animations/fade.animation';

type SystemParametersItem = {
  sprUUID: string | null;
  googleMapsEmbedApiKey: string;
  googleMapsEmbedApiKeyIsActive: boolean;
  mapboxToken: string;
  mapboxTokenIsActive: boolean;
  signalWireRepoToken: string;
  signalWireRepoTokenIsActive: boolean;
  defaultCurrency: string;
  defaultCurrencyIsActive: boolean;
  defaultLanguage: string;
  defaultLanguageIsActive: boolean;
  defaultTimezone: string;
  defaultTimezoneIsActive: boolean;
  voipPabxRecordingStorageMode: 'filesystem' | 'storage' | '';
  voipPabxRecordingStorageAccountUUID: string;
  voipPabxRecordingStorageIsActive: boolean;
  voipPabxMediaStorageMode: 'filesystem' | 'storage' | '';
  voipPabxMediaStorageAccountUUID: string;
  voipPabxMediaStorageIsActive: boolean;
  voipPabxMediaDeliveryMode: 'online' | 'offline' | '';
  voipPabxMediaDeliveryModeIsActive: boolean;
  voipPabxRemoteCommandExecutor: 'agent' | 'esl_ami' | '';
  voipPabxRemoteCommandExecutorIsActive: boolean;
};

type StorageAccountItem = {
  HsaUUID: string;
  HsaName: string;
  HspName?: string | null;
  HspProvider?: string | null;
};

const DEFAULT_ITEM: SystemParametersItem = {
  sprUUID: null,
  googleMapsEmbedApiKey: '',
  googleMapsEmbedApiKeyIsActive: true,
  mapboxToken: '',
  mapboxTokenIsActive: true,
  signalWireRepoToken: '',
  signalWireRepoTokenIsActive: true,
  defaultCurrency: 'BRL',
  defaultCurrencyIsActive: true,
  defaultLanguage: 'pt-BR',
  defaultLanguageIsActive: true,
  defaultTimezone: '',
  defaultTimezoneIsActive: true,
  voipPabxRecordingStorageMode: '',
  voipPabxRecordingStorageAccountUUID: '',
  voipPabxRecordingStorageIsActive: true,
  voipPabxMediaStorageMode: '',
  voipPabxMediaStorageAccountUUID: '',
  voipPabxMediaStorageIsActive: true,
  voipPabxMediaDeliveryMode: '',
  voipPabxMediaDeliveryModeIsActive: true,
  voipPabxRemoteCommandExecutor: '',
  voipPabxRemoteCommandExecutorIsActive: true,
};

@Component({
  selector: 'app-settings-parameters',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatTabsModule,
    MatSelectModule,
  ],
  templateUrl: './parameters.html',
  styleUrls: ['./parameters.scss'],
  animations: [fadeIn],
  encapsulation: ViewEncapsulation.None,
  host: { '[@fadeIn]': '' },
})
export class SettingsParametersPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);

  readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  readonly isMaster = computed(() => this.scope() === 'master');
  readonly pageTitle = computed(() => (this.isMaster() ? 'System Parameters' : 'Parameters'));
  readonly pageSubtitle = computed(() =>
    this.isMaster()
      ? 'Single master record with global default values.'
      : 'Single tenant record. Empty tenant values fallback to master defaults.',
  );
  readonly defaultTimezonePlaceholder = computed(() =>
    this.isMaster() ? 'UTC' : 'Master timezone',
  );
  readonly voipPabxRecordingStoragePlaceholder = computed(() =>
    this.isMaster() ? 'Filesystem' : 'Master recording storage',
  );
  readonly voipPabxMediaStoragePlaceholder = computed(() =>
    this.isMaster() ? 'Filesystem' : 'Master media file storage',
  );
  readonly voipPabxMediaDeliveryPlaceholder = computed(() =>
    this.isMaster() ? 'Offline' : 'Master media file delivery',
  );
  readonly voipPabxRemoteCommandExecutorPlaceholder = computed(() =>
    this.isMaster() ? 'Agent' : 'Master remote command executor',
  );
  readonly baseEndpoint = computed(() =>
    this.isMaster() ? 'system/parameters' : 'settings/parameters',
  );

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly feedback = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly showGoogleMapsEmbedApiKey = signal(false);
  readonly showMapboxToken = signal(false);
  readonly showSignalWireRepoToken = signal(false);
  readonly item = signal<SystemParametersItem>({ ...DEFAULT_ITEM });
  readonly baselineItem = signal<SystemParametersItem>({ ...DEFAULT_ITEM });
  readonly storageAccounts = signal<StorageAccountItem[]>([]);
  readonly baselineSignature = signal('');
  readonly hasChanges = computed(
    () => this.buildSignature(this.item()) !== this.baselineSignature(),
  );

  ngOnInit() {
    void this.loadItems();
  }

  async loadItems() {
    this.loading.set(true);
    this.feedback.set(null);
    this.success.set(null);

    try {
      const result = await this.api.get<any>(this.baseEndpoint());
      await this.loadStorageAccounts();
      const loaded = this.readItem(result);
      this.item.set(loaded);
      this.baselineItem.set({ ...loaded });
      this.baselineSignature.set(this.buildSignature(loaded));
    } catch (error) {
      this.feedback.set(this.friendlyError(error, 'Failed to load parameters.'));
      this.item.set({ ...DEFAULT_ITEM });
      this.baselineItem.set({ ...DEFAULT_ITEM });
      this.baselineSignature.set(this.buildSignature(DEFAULT_ITEM));
    } finally {
      this.loading.set(false);
    }
  }

  updateItem(patch: Partial<SystemParametersItem>) {
    this.item.set({ ...this.item(), ...patch });
  }

  cancelChanges() {
    this.item.set({ ...this.baselineItem() });
    this.feedback.set(null);
    this.success.set(null);
  }

  async saveAll() {
    if (!this.hasChanges()) return;

    this.saving.set(true);
    this.feedback.set(null);
    this.success.set(null);

    try {
      const payload = this.normalizeForSave(this.item());
      const result = await this.api.put<any>(this.baseEndpoint(), { item: payload });
      const savedItem = this.readItem(result);
      this.item.set(savedItem);
      this.baselineItem.set({ ...savedItem });
      this.baselineSignature.set(this.buildSignature(savedItem));
      this.success.set('Parameters saved successfully.');
    } catch (error) {
      this.feedback.set(this.friendlyError(error, 'Failed to save parameters.'));
    } finally {
      this.saving.set(false);
    }
  }

  private readItem(result: any): SystemParametersItem {
    const direct = result?.data?.item;
    if (direct && typeof direct === 'object') {
      return this.normalizeIncoming(direct);
    }

    const items = Array.isArray(result?.data?.items)
      ? result.data.items
      : Array.isArray(result)
        ? result
        : [];

    return this.fromLegacyItems(items);
  }

  private fromLegacyItems(items: any[]): SystemParametersItem {
    const item: SystemParametersItem = { ...DEFAULT_ITEM };

    for (const row of items) {
      const key = String(row?.SprKey ?? '').toUpperCase();
      const value =
        row?.SprValue === null || row?.SprValue === undefined ? '' : String(row.SprValue);
      const isActive = Number(row?.SprIsActive ?? 1) === 1;

      if (key === 'GOOGLE_MAPS_EMBED_API_KEY') {
        item.sprUUID = item.sprUUID || String(row?.SprUUID ?? '');
        item.googleMapsEmbedApiKey = value;
        item.googleMapsEmbedApiKeyIsActive = isActive;
      } else if (key === 'MAPBOX_TOKEN') {
        item.sprUUID = item.sprUUID || String(row?.SprUUID ?? '');
        item.mapboxToken = value;
        item.mapboxTokenIsActive = isActive;
      } else if (key === 'SIGNALWIRE_REPO_TOKEN') {
        item.sprUUID = item.sprUUID || String(row?.SprUUID ?? '');
        item.signalWireRepoToken = value;
        item.signalWireRepoTokenIsActive = isActive;
      } else if (key === 'DEFAULT_CURRENCY') {
        item.sprUUID = item.sprUUID || String(row?.SprUUID ?? '');
        item.defaultCurrency = value || 'BRL';
        item.defaultCurrencyIsActive = isActive;
      } else if (key === 'DEFAULT_LANGUAGE') {
        item.sprUUID = item.sprUUID || String(row?.SprUUID ?? '');
        item.defaultLanguage = value || 'pt-BR';
        item.defaultLanguageIsActive = isActive;
      } else if (key === 'DEFAULT_TIMEZONE') {
        item.sprUUID = item.sprUUID || String(row?.SprUUID ?? '');
        item.defaultTimezone = value;
        item.defaultTimezoneIsActive = isActive;
      } else if (key === 'VOIP_PABX_RECORDING_STORAGE_MODE') {
        item.sprUUID = item.sprUUID || String(row?.SprUUID ?? '');
        item.voipPabxRecordingStorageMode = this.normalizeStorageMode(value);
        item.voipPabxRecordingStorageIsActive = isActive;
      } else if (key === 'VOIP_PABX_RECORDING_STORAGE_ACCOUNT') {
        item.sprUUID = item.sprUUID || String(row?.SprUUID ?? '');
        item.voipPabxRecordingStorageAccountUUID = value;
      } else if (key === 'VOIP_PABX_MEDIA_STORAGE_MODE') {
        item.sprUUID = item.sprUUID || String(row?.SprUUID ?? '');
        item.voipPabxMediaStorageMode = this.normalizeStorageMode(value);
        item.voipPabxMediaStorageIsActive = isActive;
      } else if (key === 'VOIP_PABX_MEDIA_STORAGE_ACCOUNT') {
        item.sprUUID = item.sprUUID || String(row?.SprUUID ?? '');
        item.voipPabxMediaStorageAccountUUID = value;
      } else if (key === 'VOIP_PABX_MEDIA_DELIVERY_MODE') {
        item.sprUUID = item.sprUUID || String(row?.SprUUID ?? '');
        item.voipPabxMediaDeliveryMode = this.normalizeDeliveryMode(value);
        item.voipPabxMediaDeliveryModeIsActive = isActive;
      } else if (key === 'VOIP_PABX_REMOTE_COMMAND_EXECUTOR') {
        item.sprUUID = item.sprUUID || String(row?.SprUUID ?? '');
        item.voipPabxRemoteCommandExecutor = this.normalizeRemoteCommandExecutor(value);
        item.voipPabxRemoteCommandExecutorIsActive = isActive;
      }
    }

    return item;
  }

  private normalizeIncoming(raw: any): SystemParametersItem {
    return {
      sprUUID: typeof raw?.sprUUID === 'string' && raw.sprUUID.trim() ? raw.sprUUID : null,
      googleMapsEmbedApiKey: String(raw?.googleMapsEmbedApiKey ?? ''),
      googleMapsEmbedApiKeyIsActive: raw?.googleMapsEmbedApiKeyIsActive !== false,
      mapboxToken: String(raw?.mapboxToken ?? ''),
      mapboxTokenIsActive: raw?.mapboxTokenIsActive !== false,
      signalWireRepoToken: String(raw?.signalWireRepoToken ?? ''),
      signalWireRepoTokenIsActive: raw?.signalWireRepoTokenIsActive !== false,
      defaultCurrency: String(raw?.defaultCurrency ?? 'BRL') || 'BRL',
      defaultCurrencyIsActive: raw?.defaultCurrencyIsActive !== false,
      defaultLanguage: String(raw?.defaultLanguage ?? 'pt-BR') || 'pt-BR',
      defaultLanguageIsActive: raw?.defaultLanguageIsActive !== false,
      defaultTimezone: String(raw?.defaultTimezone ?? ''),
      defaultTimezoneIsActive: raw?.defaultTimezoneIsActive !== false,
      voipPabxRecordingStorageMode: this.normalizeStorageMode(raw?.voipPabxRecordingStorageMode),
      voipPabxRecordingStorageAccountUUID: String(raw?.voipPabxRecordingStorageAccountUUID ?? ''),
      voipPabxRecordingStorageIsActive: raw?.voipPabxRecordingStorageIsActive !== false,
      voipPabxMediaStorageMode: this.normalizeStorageMode(raw?.voipPabxMediaStorageMode),
      voipPabxMediaStorageAccountUUID: String(raw?.voipPabxMediaStorageAccountUUID ?? ''),
      voipPabxMediaStorageIsActive: raw?.voipPabxMediaStorageIsActive !== false,
      voipPabxMediaDeliveryMode: this.normalizeDeliveryMode(raw?.voipPabxMediaDeliveryMode),
      voipPabxMediaDeliveryModeIsActive: raw?.voipPabxMediaDeliveryModeIsActive !== false,
      voipPabxRemoteCommandExecutor: this.normalizeRemoteCommandExecutor(
        raw?.voipPabxRemoteCommandExecutor,
      ),
      voipPabxRemoteCommandExecutorIsActive:
        raw?.voipPabxRemoteCommandExecutorIsActive !== false,
    };
  }

  private normalizeForSave(value: SystemParametersItem): SystemParametersItem {
    return {
      ...value,
      googleMapsEmbedApiKey: value.googleMapsEmbedApiKey.trim(),
      mapboxToken: value.mapboxToken.trim(),
      signalWireRepoToken: this.isMaster() ? value.signalWireRepoToken.trim() : '',
      defaultCurrency: (value.defaultCurrency.trim() || 'BRL').toUpperCase(),
      defaultLanguage: value.defaultLanguage.trim() || 'pt-BR',
      defaultTimezone: value.defaultTimezone.trim(),
      voipPabxRecordingStorageMode: value.voipPabxRecordingStorageMode,
      voipPabxRecordingStorageAccountUUID:
        value.voipPabxRecordingStorageMode === 'storage'
          ? value.voipPabxRecordingStorageAccountUUID
          : '',
      voipPabxMediaStorageMode: value.voipPabxMediaStorageMode,
      voipPabxMediaStorageAccountUUID:
        value.voipPabxMediaStorageMode === 'storage' ? value.voipPabxMediaStorageAccountUUID : '',
      voipPabxMediaDeliveryMode: value.voipPabxMediaDeliveryMode,
      voipPabxRemoteCommandExecutor: value.voipPabxRemoteCommandExecutor,
    };
  }

  private buildSignature(value: SystemParametersItem): string {
    return JSON.stringify({
      googleMapsEmbedApiKey: value.googleMapsEmbedApiKey,
      googleMapsEmbedApiKeyIsActive: value.googleMapsEmbedApiKeyIsActive,
      mapboxToken: value.mapboxToken,
      mapboxTokenIsActive: value.mapboxTokenIsActive,
      signalWireRepoToken: value.signalWireRepoToken,
      signalWireRepoTokenIsActive: value.signalWireRepoTokenIsActive,
      defaultCurrency: value.defaultCurrency,
      defaultCurrencyIsActive: value.defaultCurrencyIsActive,
      defaultLanguage: value.defaultLanguage,
      defaultLanguageIsActive: value.defaultLanguageIsActive,
      defaultTimezone: value.defaultTimezone,
      defaultTimezoneIsActive: value.defaultTimezoneIsActive,
      voipPabxRecordingStorageMode: value.voipPabxRecordingStorageMode,
      voipPabxRecordingStorageAccountUUID: value.voipPabxRecordingStorageAccountUUID,
      voipPabxRecordingStorageIsActive: value.voipPabxRecordingStorageIsActive,
      voipPabxMediaStorageMode: value.voipPabxMediaStorageMode,
      voipPabxMediaStorageAccountUUID: value.voipPabxMediaStorageAccountUUID,
      voipPabxMediaStorageIsActive: value.voipPabxMediaStorageIsActive,
      voipPabxMediaDeliveryMode: value.voipPabxMediaDeliveryMode,
      voipPabxMediaDeliveryModeIsActive: value.voipPabxMediaDeliveryModeIsActive,
      voipPabxRemoteCommandExecutor: value.voipPabxRemoteCommandExecutor,
      voipPabxRemoteCommandExecutorIsActive: value.voipPabxRemoteCommandExecutorIsActive,
    });
  }

  private async loadStorageAccounts() {
    try {
      const endpoint = this.isMaster()
        ? 'system/hosting/storage/accounts'
        : 'hosting/storage/accounts';
      const response = await this.api.get<any>(endpoint);
      const rows = Array.isArray(response?.data) ? response.data : (response?.data?.items ?? []);
      this.storageAccounts.set(rows as StorageAccountItem[]);
    } catch {
      this.storageAccounts.set([]);
    }
  }

  private normalizeStorageMode(value: unknown): 'filesystem' | 'storage' | '' {
    const normalized = String(value ?? '')
      .trim()
      .toLowerCase();
    return normalized === 'filesystem' || normalized === 'storage' ? normalized : '';
  }

  private normalizeDeliveryMode(value: unknown): 'online' | 'offline' | '' {
    const normalized = String(value ?? '')
      .trim()
      .toLowerCase();
    return normalized === 'online' || normalized === 'offline' ? normalized : '';
  }

  private normalizeRemoteCommandExecutor(value: unknown): 'agent' | 'esl_ami' | '' {
    const normalized = String(value ?? '')
      .trim()
      .toLowerCase();
    return normalized === 'agent' || normalized === 'esl_ami' ? normalized : '';
  }

  private friendlyError(error: unknown, fallback: string) {
    const message = (error as any)?.error?.error;
    if (typeof message === 'string' && message.trim()) return message;
    const raw = (error as any)?.message;
    if (typeof raw === 'string' && raw.trim()) return raw;
    return fallback;
  }
}
