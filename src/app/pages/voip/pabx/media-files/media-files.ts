import { Component, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import {
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudListFilter,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
  ConfigurableCrudSaveContext,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { VoipPabxCdrRecordingDialogComponent } from '../cdr/recording-dialog/recording-dialog';
import { VoipPabxMediaFilesService } from './media-files.service';

const statuses: ConfigurableCrudOption[] = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

const storageModes: ConfigurableCrudOption[] = [
  { value: 'default', label: 'Default' },
  { value: 'filesystem', label: 'Filesystem' },
  { value: 'storage', label: 'Storage' },
];

const deliveryModes: ConfigurableCrudOption[] = [
  { value: 'default', label: 'Default' },
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' },
];

const listenAction: ConfigurableCrudRowAction = {
  key: 'listen',
  label: 'Listen',
  icon: 'play_circle',
  tooltip: 'Listen audio',
};

function config(listFilters: readonly ConfigurableCrudListFilter[]): ConfigurableCrudConfig {
  return {
    endpoint: 'voip/pabx/media-files',
    uuidField: 'uuid',
    pageTitle: 'Media Files',
    pageDescription: 'Manage reusable PABX audio prompts and storage delivery metadata.',
    createTitle: 'New media file',
    editTitle: 'Edit media file',
    dialogDescription: 'Maintain the media file metadata and optionally upload audio content.',
    searchPlaceholder: 'Search',
    emptyLabel: 'No media files found.',
    deleteTitle: 'Delete media file',
    deleteMessage: 'Delete this media file?',
    deleteSelectedTitle: 'Delete selected media files',
    deleteSelectedMessage: 'Delete {count} selected media files?',
    savedMessage: 'Media file saved successfully.',
    deletedMessage: 'Media file deleted successfully.',
    deleteFailedMessage: 'Failed to delete media file.',
    statusMode: 'number',
    activeValue: 1,
    inactiveValue: 0,
    statusOptions: statuses,
    bulkDelete: true,
    listFilters,
    rowActions: [listenAction],
    initialValues: {
      enabled: 1,
      pabxUUID: '',
      name: '',
      deliveryMode: 'default',
      storageMode: 'default',
      storageAccountUUID: '',
      uploadFile: null,
      description: '',
    },
    columns: [
      { id: 'name', label: 'Name', kind: 'identity', field: 'name', uuidField: 'uuid' },
      { id: 'pabx', label: 'PABX', kind: 'related', field: 'pabxUUID', lookupKey: 'pabxUUID' },
      { id: 'delivery', label: 'Delivery mode', field: 'deliveryMode', translateValue: true },
      { id: 'storage', label: 'Storage mode', field: 'storageMode', translateValue: true },
      { id: 'file', label: 'File', field: 'originalFilename' },
      { id: 'status', label: 'Status', kind: 'status', field: 'enabled' },
    ],
    fields: [
      { key: 'enabled', source: 'enabled', label: 'Status', type: 'status', span: 1 },
      {
        key: 'pabxUUID',
        source: 'pabxUUID',
        label: 'PABX',
        type: 'search-select',
        required: true,
        span: 1,
      },
      { key: 'name', source: 'name', label: 'Name', required: true, span: 1 },
      {
        key: 'deliveryMode',
        source: 'deliveryMode',
        label: 'Delivery mode',
        type: 'select',
        options: deliveryModes,
        required: true,
        span: 1,
      },
      {
        key: 'uploadFile',
        label: 'Audio file',
        type: 'file',
        accept: 'audio/*,.wav,.mp3,.ogg,.ulaw,.alaw',
        span: 2,
      },
      {
        key: 'storageMode',
        source: 'storageMode',
        label: 'Storage mode',
        type: 'select',
        options: storageModes,
        required: true,
        tab: 'storage',
        span: 1,
      },
      {
        key: 'storageAccountUUID',
        source: 'storageAccountUUID',
        label: 'Storage account',
        type: 'search-select',
        tab: 'storage',
        span: 1,
        hiddenWhen: ({ values }) => values['storageMode'] !== 'storage',
        requiredWhen: ({ values }) => values['storageMode'] === 'storage',
      },
      {
        key: 'description',
        source: 'description',
        label: 'Description',
        type: 'textarea',
        tab: 'notes',
        span: 4,
        rows: 4,
      },
    ],
  };
}

@Component({
  selector: 'app-voip-pabx-media-files',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipPabxMediaFilesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly genericApi = inject(ApiService);
  private readonly mediaApi = inject(VoipPabxMediaFilesService);
  private readonly playbackDialog = inject(MatDialog);
  private readonly notifications = inject(SnackbarService);
  private readonly pabxOptions = signal<ConfigurableCrudOption[]>([]);
  private readonly storageAccountOptions = signal<ConfigurableCrudOption[]>([]);
  private pendingUploadFile: File | null = null;

  constructor() {
    super(
      config([
        {
          key: 'pabxUUID',
          label: 'PABX',
          type: 'search-select',
          span: 1,
          loading: () => this.pabxOptions().length === 0,
        },
      ]),
    );
    void this.loadLookups();
  }

  override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'pabxUUID') return this.pabxOptions();
    if (key === 'storageAccountUUID') return this.storageAccountOptions();
    return super.lookupOptions(key);
  }

  override rowActions(row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    return this.canPlay(row) ? [listenAction] : [];
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key !== 'listen') return;
    await this.openAudio(row);
  }

  protected override onFieldValueChanged(key: string, value: unknown): void {
    if (key !== 'storageMode' || value === 'storage') return;
    this.setFieldValue('storageAccountUUID', '');
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    this.pendingUploadFile = payload['uploadFile'] instanceof File ? payload['uploadFile'] : null;
    const storageMode = text(payload['storageMode']) ?? 'default';
    return {
      pabxUUID: text(payload['pabxUUID']) ?? '',
      name: text(payload['name']) ?? '',
      storageMode,
      storageAccountUUID:
        storageMode === 'storage' ? text(payload['storageAccountUUID']) ?? '' : '',
      deliveryMode: text(payload['deliveryMode']) ?? 'default',
      description: text(payload['description']),
      enabled: Number(payload['enabled']) === 1,
    };
  }

  protected override async afterSave(
    context: ConfigurableCrudSaveContext<ConfigurableCrudRecord>,
  ): Promise<void> {
    const file = this.pendingUploadFile;
    this.pendingUploadFile = null;
    if (!file) return;

    const uuid =
      text((extractRecord(context.response) ?? {})['uuid']) ??
      text(context.record?.['uuid']) ??
      text((extractRecord(context.response) ?? {})['VmfUUID']);
    if (!uuid) {
      this.notifications.warning('Media file metadata was saved, but upload target was not returned.');
      return;
    }

    try {
      await this.mediaApi.upload(uuid, file);
      this.notifications.success('Media file audio uploaded successfully.');
      this.itemsResource.reload();
    } catch (error) {
      this.notifications.error(
        `Media file metadata was saved, but the audio upload failed: ${this.errorMessage(error)}`,
      );
    }
  }

  private async openAudio(row: ConfigurableCrudRecord): Promise<void> {
    try {
      const uuid = text(row['uuid']);
      if (!uuid) throw new Error('Media file UUID was not returned.');
      const response = await this.mediaApi.playbackUrl(uuid);
      const url = response?.data?.url;
      if (!url) throw new Error('Media file playback URL was not returned.');
      this.playbackDialog.open(VoipPabxCdrRecordingDialogComponent, {
        width: 'min(640px, calc(100vw - 32px))',
        maxWidth: '640px',
        maxHeight: '92vh',
        disableClose: false,
        panelClass: 'voip-pabx-recording-dialog-panel',
        data: {
          url,
          filename:
            response?.data?.filename ||
            text(row['originalFilename']) ||
            text(row['storedFilename']) ||
            'media-file',
          title: 'Media File',
          subtitle: text(row['name']) ?? '',
          showCallSummary: false,
        },
      });
    } catch (error) {
      this.notifications.error(this.errorMessage(error) || 'Failed to open media file audio.');
    }
  }

  private canPlay(row: ConfigurableCrudRecord): boolean {
    const status = text(row['storageStatus'])?.toLowerCase() ?? '';
    return Boolean(row['storageObjectKey']) && !['', 'empty', 'failed'].includes(status);
  }

  private async loadLookups(): Promise<void> {
    const [pabxResponse, storageResponse] = await Promise.all([
      this.genericApi.get<any>('voip/pabx/accounts?limit=500'),
      this.genericApi.get<any>('hosting/storage/accounts?limit=500'),
    ]);
    this.pabxOptions.set(
      ((pabxResponse?.data?.items ?? []) as ConfigurableCrudRecord[]).map((row) => {
        const uuid = text(row['VpaUUID']) ?? '';
        const label = text(row['VpaName']) ?? uuid;
        return { value: uuid, label, searchText: `${label} ${uuid}` };
      }),
    );
    const storageRows = storageResponse?.data?.items ?? [];
    this.storageAccountOptions.set([
      { value: '', label: 'Default storage account' },
      ...((storageRows as ConfigurableCrudRecord[]).map((row) => {
        const uuid = text(row['HsaUUID']) ?? '';
        const provider = text(row['HspProvider']) ?? text(row['HspName']) ?? 'storage';
        const label = `${text(row['HsaName']) ?? uuid} · ${provider}`;
        return { value: uuid, label, searchText: `${label} ${uuid}` };
      }) as ConfigurableCrudOption[]),
    ]);
  }
}

function extractRecord(response: unknown): ConfigurableCrudRecord | null {
  const value = response as { data?: unknown; item?: unknown; record?: unknown } | null | undefined;
  const candidates = [
    value?.data && (value.data as { item?: unknown; record?: unknown; data?: unknown }).item,
    value?.data && (value.data as { item?: unknown; record?: unknown; data?: unknown }).record,
    value?.data && (value.data as { item?: unknown; record?: unknown; data?: unknown }).data,
    value?.data,
    value?.item,
    value?.record,
  ];
  return candidates.find(isRecord) ?? null;
}

function isRecord(value: unknown): value is ConfigurableCrudRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function text(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}
