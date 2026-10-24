import { Component, ViewEncapsulation, computed, inject, resource, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { hasEffectivePermission } from '../../../core/guards/permission.guard';
import { DetailPageComponent } from '../../../shared/pages/detail-page';
import { FieldHelpComponent } from '../../../shared/forms/field-help';
import { MnsSearchSelectFieldComponent } from '../../../shared/forms/mns-search-select-field/mns-search-select-field';
import {
  GlobalTableComponent,
  defineGlobalTable,
} from '../../../shared/crud/configurable-crud/global-table';
import {
  IMPORT_ACCEPT,
  type ImportMapping,
  type ImportRow,
  type ParsedFile,
  type PropertiesSchema,
  batches,
  buildRows,
  geometrySummary,
  guessMapping,
  parseImportFile,
} from './import-parsers';

type Option = { value: string; label: string };
type Row = Record<string, unknown>;
type ListResponse = { data?: { items?: Row[] } };
type RowError = { row: number; externalId: string | null; message: string };
type Progress = { sent: number; total: number; created: number; updated: number; failed: number };

const NONE = '';
export const EXPORT_FORMATS: Option[] = [
  { value: 'geojson', label: 'GeoJSON' },
  { value: 'kmz', label: 'KMZ (Google Earth)' },
  { value: 'kml', label: 'KML' },
  { value: 'csv', label: 'CSV' },
  { value: 'shapefile', label: 'Shapefile (zip)' },
];
const EXTENSIONS: Record<string, string> = {
  geojson: 'geojson',
  kmz: 'kmz',
  kml: 'kml',
  csv: 'csv',
  shapefile: 'zip',
};
const MODES: Option[] = [
  { value: 'upsert', label: 'Update by external ID' },
  { value: 'create', label: 'Always create' },
];
const MAPPING_KEYS = ['name', 'externalId', 'layerCode', 'typeCode', 'statusCode'] as const;
type MappingKey = (typeof MAPPING_KEYS)[number];
const MAPPING_LABELS: Record<MappingKey, string> = {
  name: 'Name column',
  externalId: 'External ID column',
  layerCode: 'Layer code column',
  typeCode: 'Asset type code column',
  statusCode: 'Status code column',
};

const options = (rows: Row[], value: string, label: string): Option[] =>
  rows.map((row) => ({ value: String(row[value] ?? ''), label: String(row[label] ?? '') }));

function parseSchema(value: unknown): PropertiesSchema | null {
  if (!value) return null;
  try {
    return typeof value === 'string' ? JSON.parse(value) : (value as PropertiesSchema);
  } catch {
    return null;
  }
}

/**
 * InfraGIS › Import and export: reads GeoJSON, KML/KMZ, CSV or zipped Shapefile in the browser,
 * maps its columns to the asset (name, external ID, layer, type, status, properties) and sends
 * the rows in batches; the API validates every row and reports the refused ones. Exports every
 * asset of a project or layer as GeoJSON, KMZ, KML, CSV or Shapefile.
 */
@Component({
  selector: 'app-infragis-transfer',
  standalone: true,
  imports: [
    DecimalPipe,
    DetailPageComponent,
    FieldHelpComponent,
    GlobalTableComponent,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MnsSearchSelectFieldComponent,
    TranslocoPipe,
  ],
  templateUrl: './transfer.html',
  styleUrl: './transfer.scss',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'app-fade-in-host' },
})
export class InfraGisTransferPage {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly snack = inject(SnackbarService);
  private readonly transloco = inject(TranslocoService);

  readonly accept = IMPORT_ACCEPT;
  readonly exportFormats = EXPORT_FORMATS;
  readonly modes = MODES;
  readonly mappingKeys = MAPPING_KEYS;
  readonly mappingLabels = MAPPING_LABELS;

  private readonly can = (code: string) =>
    hasEffectivePermission(this.auth.user()?.permissions ?? [], code);
  readonly canImport = computed(
    () => this.can('tenant.infragis.assets.import') && this.can('tenant.infragis.assets.write'),
  );
  readonly canExport = computed(() => this.can('tenant.infragis.assets.export'));

  private readonly catalog = resource({
    loader: async () => {
      const read = (endpoint: string) =>
        this.api
          .get<ListResponse>(`${endpoint}?limit=5000`)
          .then((response) => response?.data?.items ?? []);
      const [projects, types, statuses] = await Promise.all([
        read('infragis/projects'),
        read('infragis/asset-types'),
        read('infragis/statuses'),
      ]);
      return { projects, types, statuses };
    },
  });
  readonly projects = computed(() =>
    options(this.catalog.value()?.projects ?? [], 'IprUUID', 'IprName'),
  );
  readonly types = computed(() => options(this.catalog.value()?.types ?? [], 'IgtCode', 'IgtName'));
  readonly statuses = computed(() =>
    options(this.catalog.value()?.statuses ?? [], 'IgsCode', 'IgsName'),
  );
  private readonly schemas = computed(
    () =>
      new Map(
        (this.catalog.value()?.types ?? []).map((row) => [
          String(row['IgtCode'] ?? ''),
          parseSchema(row['IgtPropertiesSchemaJson']),
        ]),
      ),
  );

  // ---------------- import ----------------
  readonly projectUUID = signal(NONE);
  readonly layerUUID = signal(NONE);
  readonly mode = signal('upsert');
  readonly source = signal('');
  readonly fileName = signal('');
  readonly parsing = signal(false);
  readonly parseError = signal<string | null>(null);
  readonly parsed = signal<ParsedFile | null>(null);
  readonly mapping = signal<ImportMapping>(guessMapping([]));
  readonly running = signal(false);
  readonly cancelRequested = signal(false);
  readonly progress = signal<Progress | null>(null);
  readonly errors = signal<RowError[]>([]);
  readonly importFailed = signal<string | null>(null);

  private readonly projectLayers = resource({
    params: () => this.projectUUID() || undefined,
    loader: async ({ params }) =>
      (
        await this.api.get<ListResponse>(
          `infragis/layers?limit=5000&projectUUID=${encodeURIComponent(params)}`,
        )
      )?.data?.items ?? [],
  });
  readonly layers = computed(() => options(this.projectLayers.value() ?? [], 'IglUUID', 'IglName'));

  readonly columns = computed<Option[]>(() =>
    (this.parsed()?.columns ?? []).map((column) => ({ value: column, label: column })),
  );
  readonly summary = computed(() =>
    Object.entries(geometrySummary(this.parsed()?.features ?? [])).map(([type, count]) => ({
      type,
      count,
    })),
  );
  readonly rows = computed<ImportRow[]>(() => {
    const parsed = this.parsed();
    if (!parsed) return [];
    const prefix = this.transloco.translate('Asset');
    return buildRows(parsed.features, this.mapping(), this.schemas(), (row) => `${prefix} ${row}`);
  });
  readonly preview = computed(() =>
    this.rows()
      .slice(0, 5)
      .map((row) => ({
        row: row.row,
        name: row.name,
        externalId: row.externalId ?? '',
        type: row.typeCode ?? '',
        geometry: row.geometry?.type ?? '',
      })),
  );
  readonly ready = computed(
    () => !!this.parsed()?.features.length && !!this.projectUUID() && !this.running(),
  );
  readonly percent = computed(() => {
    const value = this.progress();
    return value && value.total ? Math.round((value.sent / value.total) * 100) : 0;
  });

  readonly previewTable = defineGlobalTable({
    key: 'infragis/transfer/preview',
    uuidField: 'row',
    emptyLabel: 'No rows found.',
    pagination: false,
    columns: [
      { id: 'row', label: 'Row', field: 'row', kind: 'number' },
      { id: 'name', label: 'Name', field: 'name', translateValue: false },
      { id: 'externalId', label: 'External ID', field: 'externalId', translateValue: false },
      { id: 'type', label: 'Asset type code', field: 'type', translateValue: false },
      { id: 'geometry', label: 'Geometry', field: 'geometry', translateValue: false },
    ],
  });
  readonly errorTable = defineGlobalTable({
    key: 'infragis/transfer/errors',
    uuidField: 'row',
    emptyLabel: 'No refused rows.',
    columns: [
      { id: 'row', label: 'Row', field: 'row', kind: 'number' },
      { id: 'externalId', label: 'External ID', field: 'externalId', translateValue: false },
      { id: 'message', label: 'Reason', field: 'message' },
    ],
  });

  // ---------------- export ----------------
  readonly exportFormat = signal('geojson');
  readonly exportProjectUUID = signal(NONE);
  readonly exportLayerUUID = signal(NONE);
  readonly exporting = signal(false);
  private readonly exportProjectLayers = resource({
    params: () => this.exportProjectUUID() || undefined,
    loader: async ({ params }) =>
      (
        await this.api.get<ListResponse>(
          `infragis/layers?limit=5000&projectUUID=${encodeURIComponent(params)}`,
        )
      )?.data?.items ?? [],
  });
  readonly exportLayers = computed(() =>
    options(this.exportProjectLayers.value() ?? [], 'IglUUID', 'IglName'),
  );

  // ---------------- history ----------------
  private readonly history = resource({
    params: () => (this.canImport() ? true : undefined),
    loader: async () =>
      (await this.api.get<ListResponse>('infragis/imports?limit=50'))?.data?.items ?? [],
  });
  readonly historyRows = computed(() =>
    (this.history.value() ?? []).map((row) => ({
      ...row,
      Counts: `${row['IgiCreatedCount'] ?? 0} / ${row['IgiUpdatedCount'] ?? 0} / ${row['IgiFailedCount'] ?? 0}`,
    })),
  );
  readonly historyTable = defineGlobalTable({
    key: 'infragis/transfer/history',
    uuidField: 'IgiUUID',
    emptyLabel: 'No imports yet.',
    columns: [
      { id: 'date', label: 'Date', field: 'IgiDateCreated', kind: 'datetime' },
      { id: 'file', label: 'File', field: 'IgiFileName', translateValue: false },
      { id: 'project', label: 'Project', field: 'ProjectName', translateValue: false },
      { id: 'format', label: 'Format', field: 'IgiFormat', translateValue: false },
      { id: 'state', label: 'State', field: 'IgiState' },
      {
        id: 'counts',
        label: 'Created / updated / refused',
        field: 'Counts',
        translateValue: false,
      },
      { id: 'user', label: 'User', field: 'CreatedByName', translateValue: false },
    ],
  });

  readonly loading = computed(() => this.catalog.isLoading());

  refresh() {
    this.catalog.reload();
    this.history.reload();
  }

  setProject(value: unknown) {
    this.projectUUID.set(String(value ?? ''));
    this.layerUUID.set(NONE);
  }

  setExportProject(value: unknown) {
    this.exportProjectUUID.set(String(value ?? ''));
    this.exportLayerUUID.set(NONE);
  }

  setMapping(key: keyof ImportMapping, value: unknown) {
    this.mapping.update((current) => ({
      ...current,
      [key]: key === 'keepProperties' ? !!value : String(value ?? '') || null,
    }));
  }

  mappingValue(key: MappingKey | 'fixedTypeCode' | 'fixedStatusCode'): string {
    return this.mapping()[key] ?? NONE;
  }

  text(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  async chooseFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.fileName.set(file.name);
    this.parsed.set(null);
    this.parseError.set(null);
    this.progress.set(null);
    this.errors.set([]);
    this.importFailed.set(null);
    this.parsing.set(true);
    try {
      const parsed = await parseImportFile(file);
      this.parsed.set(parsed);
      this.mapping.set(guessMapping(parsed.columns));
      if (!parsed.features.length) this.parseError.set('The file has no features.');
    } catch (error) {
      this.parseError.set(error instanceof Error ? error.message : 'The file could not be read.');
    } finally {
      this.parsing.set(false);
    }
  }

  cancel() {
    this.cancelRequested.set(true);
  }

  async runImport() {
    const parsed = this.parsed();
    if (!parsed || !this.ready()) return;
    const rows = this.rows();
    this.running.set(true);
    this.cancelRequested.set(false);
    this.errors.set([]);
    this.importFailed.set(null);
    this.progress.set({ sent: 0, total: rows.length, created: 0, updated: 0, failed: 0 });
    let importUUID: string | null = null;
    try {
      const started = await this.api.post<{ data?: { item?: Row } }>('infragis/imports', {
        projectUUID: this.projectUUID(),
        layerUUID: this.layerUUID() || null,
        format: parsed.format,
        fileName: this.fileName(),
        source: this.source().trim() || null,
        mode: this.mode(),
        totalCount: rows.length,
      });
      importUUID = String(started?.data?.item?.['IgiUUID'] ?? '');
      if (!importUUID) throw new Error('The import could not be started.');
      for (const batch of batches(rows)) {
        if (this.cancelRequested()) break;
        const response = await this.api.post<{
          data?: {
            result?: {
              CreatedCount?: number;
              UpdatedCount?: number;
              FailedCount?: number;
              errors?: RowError[];
            };
          };
        }>(`infragis/imports/${importUUID}/rows`, { rows: batch });
        const result = response?.data?.result ?? {};
        this.progress.update((current) => ({
          sent: (current?.sent ?? 0) + batch.length,
          total: rows.length,
          created: (current?.created ?? 0) + Number(result.CreatedCount ?? 0),
          updated: (current?.updated ?? 0) + Number(result.UpdatedCount ?? 0),
          failed: (current?.failed ?? 0) + Number(result.FailedCount ?? 0),
        }));
        if (result.errors?.length) this.errors.update((list) => [...list, ...result.errors!]);
      }
      await this.api.post(`infragis/imports/${importUUID}/finish`, {
        cancel: this.cancelRequested(),
      });
      const done = this.progress();
      this.snack.success(
        this.transloco.translate(
          'Import finished: {{created}} created, {{updated}} updated, {{failed}} refused.',
          {
            created: done?.created ?? 0,
            updated: done?.updated ?? 0,
            failed: done?.failed ?? 0,
          },
        ),
      );
    } catch (error) {
      this.importFailed.set(this.message(error, 'The import was interrupted.'));
      if (importUUID) {
        await this.api
          .post(`infragis/imports/${importUUID}/finish`, { cancel: true }, { silent: true })
          .catch(() => undefined);
      }
    } finally {
      this.running.set(false);
      this.history.reload();
    }
  }

  /** Refused rows as CSV (row, external ID, reason) for correction in the source system. */
  downloadErrors() {
    const quote = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const lines = [
      ['row', 'externalId', 'message'].join(','),
      ...this.errors().map((error) =>
        [error.row, quote(error.externalId), quote(this.transloco.translate(error.message))].join(
          ',',
        ),
      ),
    ];
    this.save(
      new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv' }),
      'infragis-import-errors.csv',
    );
  }

  async runExport() {
    if (this.exporting()) return;
    this.exporting.set(true);
    try {
      const query = new URLSearchParams({ format: this.exportFormat() });
      if (this.exportProjectUUID()) query.set('projectUUID', this.exportProjectUUID());
      if (this.exportLayerUUID()) query.set('layerUUID', this.exportLayerUUID());
      const blob = await this.api.getBlob(`infragis/export?${query}`);
      const stamp = new Date().toISOString().slice(0, 10);
      this.save(blob, `infragis-${stamp}.${EXTENSIONS[this.exportFormat()] ?? 'dat'}`);
    } catch (error) {
      this.snack.error(this.transloco.translate(this.message(error, 'The export failed.')));
    } finally {
      this.exporting.set(false);
    }
  }

  private save(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private message(error: unknown, fallback: string): string {
    const body = (error as { error?: { error?: string; message?: string } })?.error;
    return (
      body?.error || body?.message || (error instanceof Error ? error.message : '') || fallback
    );
  }
}
