import { CommonModule } from '@angular/common';
import { Component, OnInit, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';

import { fadeIn } from '../../../shared/animations/fade.animation';
import { TranslatePipe } from '../../../shared/i18n/translate.pipe';
import { ApiService } from '../../../services/api.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';

type InfraGisResourceKey = 'projects' | 'layers' | 'categories' | 'asset-types' | 'statuses' | 'assets';
type InfraGisRecord = Record<string, any>;

type InfraGisResource = {
  key: InfraGisResourceKey;
  label: string;
  endpoint: string;
  uuidField: string;
  columns: Array<{ key: string; label: string }>;
  fields: Array<{
    key: string;
    label: string;
    type?: 'text' | 'number' | 'textarea' | 'select' | 'color';
    span?: 'full';
    options?: () => Array<{ value: string | number | null; label: string }>;
  }>;
};

@Component({
  selector: 'app-infragis-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTableModule,
    MatTabsModule,
    MatTooltipModule,
    TranslatePipe,
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss'],
  animations: [fadeIn],
})
export class InfraGisDashboardPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);

  @ViewChild('recordDialog') recordDialog?: TemplateRef<unknown>;

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly search = signal('');
  readonly statusFilter = signal<number | null>(null);
  readonly summary = signal<InfraGisRecord>({});
  readonly rows = signal<Record<InfraGisResourceKey, InfraGisRecord[]>>({
    projects: [],
    layers: [],
    categories: [],
    'asset-types': [],
    statuses: [],
    assets: [],
  });
  readonly mapAssets = signal<InfraGisRecord[]>([]);
  readonly editingResource = signal<InfraGisResource | null>(null);
  readonly editingRecord = signal<InfraGisRecord | null>(null);
  readonly formModel = signal<InfraGisRecord>({});

  private dialogRef?: MatDialogRef<unknown>;

  readonly resources: InfraGisResource[] = [
    {
      key: 'projects',
      label: 'Projects',
      endpoint: 'infragis/projects',
      uuidField: 'IprUUID',
      columns: [
        { key: 'IprName', label: 'Name' },
        { key: 'VerticalProfileName', label: 'Vertical' },
        { key: 'LayerCount', label: 'Layers' },
        { key: 'AssetCount', label: 'Assets' },
        { key: 'IprStatus', label: 'Status' },
      ],
      fields: [
        { key: 'name', label: 'Name' },
        { key: 'sortOrder', label: 'Sort Order', type: 'number' },
        { key: 'status', label: 'Status', type: 'select', options: () => this.statusOptions() },
        { key: 'description', label: 'Description', type: 'textarea', span: 'full' },
      ],
    },
    {
      key: 'layers',
      label: 'Layers',
      endpoint: 'infragis/layers',
      uuidField: 'IglUUID',
      columns: [
        { key: 'IglName', label: 'Name' },
        { key: 'ProjectName', label: 'Project' },
        { key: 'IglGeometryType', label: 'Geometry' },
        { key: 'AssetCount', label: 'Assets' },
        { key: 'IglStatus', label: 'Status' },
      ],
      fields: [
        { key: 'projectUUID', label: 'Project', type: 'select', options: () => this.projectOptions() },
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Name' },
        { key: 'geometryType', label: 'Geometry', type: 'select', options: () => this.geometryOptions() },
        { key: 'sortOrder', label: 'Sort Order', type: 'number' },
        { key: 'status', label: 'Status', type: 'select', options: () => this.statusOptions() },
        { key: 'styleJson', label: 'Style JSON', type: 'textarea', span: 'full' },
      ],
    },
    {
      key: 'categories',
      label: 'Categories',
      endpoint: 'infragis/categories',
      uuidField: 'IacUUID',
      columns: [
        { key: 'IacCode', label: 'Code' },
        { key: 'IacName', label: 'Name' },
        { key: 'IacColor', label: 'Color' },
        { key: 'IacStatus', label: 'Status' },
      ],
      fields: this.taxonomyFields('Category'),
    },
    {
      key: 'asset-types',
      label: 'Asset Types',
      endpoint: 'infragis/asset-types',
      uuidField: 'IgtUUID',
      columns: [
        { key: 'IgtCode', label: 'Code' },
        { key: 'IgtName', label: 'Name' },
        { key: 'CategoryName', label: 'Category' },
        { key: 'IgtDefaultColor', label: 'Color' },
        { key: 'IgtStatus', label: 'Status' },
      ],
      fields: [
        { key: 'categoryUUID', label: 'Category', type: 'select', options: () => this.categoryOptions() },
        ...this.taxonomyFields('Asset Type'),
      ],
    },
    {
      key: 'statuses',
      label: 'Statuses',
      endpoint: 'infragis/statuses',
      uuidField: 'IgsUUID',
      columns: [
        { key: 'IgsCode', label: 'Code' },
        { key: 'IgsName', label: 'Name' },
        { key: 'IgsColor', label: 'Color' },
        { key: 'IgsStatus', label: 'Status' },
      ],
      fields: this.statusFields(),
    },
    {
      key: 'assets',
      label: 'Assets',
      endpoint: 'infragis/assets',
      uuidField: 'IgaUUID',
      columns: [
        { key: 'IgaName', label: 'Name' },
        { key: 'ProjectName', label: 'Project' },
        { key: 'LayerName', label: 'Layer' },
        { key: 'AssetTypeName', label: 'Type' },
        { key: 'AssetStatusName', label: 'Asset Status' },
        { key: 'IgaStatus', label: 'Status' },
      ],
      fields: [
        { key: 'projectUUID', label: 'Project', type: 'select', options: () => this.projectOptions() },
        { key: 'layerUUID', label: 'Layer', type: 'select', options: () => this.layerOptions() },
        { key: 'assetTypeUUID', label: 'Asset Type', type: 'select', options: () => this.assetTypeOptions() },
        { key: 'assetStatusUUID', label: 'Asset Status', type: 'select', options: () => this.assetStatusOptions() },
        { key: 'name', label: 'Name' },
        { key: 'externalID', label: 'External ID' },
        { key: 'latitude', label: 'Latitude', type: 'number' },
        { key: 'longitude', label: 'Longitude', type: 'number' },
        { key: 'status', label: 'Status', type: 'select', options: () => this.statusOptions() },
        { key: 'propertiesJson', label: 'Properties JSON', type: 'textarea', span: 'full' },
        { key: 'geoJson', label: 'GeoJSON', type: 'textarea', span: 'full' },
      ],
    },
  ];

  async ngOnInit() {
    await this.refresh();
  }

  async refresh() {
    this.loading.set(true);
    try {
      const [dashboard, ...responses] = await Promise.all([
        this.api.get<any>('infragis/'),
        ...this.resources.map((resource) => this.api.get<any>(this.listUrl(resource))),
        this.api.get<any>('infragis/map/assets?limit=1000'),
      ]);
      const nextRows = { ...this.rows() };
      this.resources.forEach((resource, index) => {
        nextRows[resource.key] = responses[index]?.data?.items ?? [];
      });
      this.rows.set(nextRows);
      this.summary.set(dashboard?.data?.summary ?? {});
      this.mapAssets.set(responses[responses.length - 1]?.data?.items ?? []);
    } catch (error) {
      this.snack.error(error instanceof Error ? error.message : 'Unable to load InfraGIS.');
    } finally {
      this.loading.set(false);
    }
  }

  applyFilters() {
    void this.refresh();
  }

  clearFilters() {
    this.search.set('');
    this.statusFilter.set(null);
    void this.refresh();
  }

  openCreate(resource: InfraGisResource) {
    this.openDialog(resource, null);
  }

  openEdit(resource: InfraGisResource, row: InfraGisRecord) {
    this.openDialog(resource, row);
  }

  async save() {
    const resource = this.editingResource();
    if (!resource) return;
    const record = this.editingRecord();
    const uuid = record?.[resource.uuidField];
    this.saving.set(true);
    try {
      const endpoint = uuid ? `${resource.endpoint}/${uuid}` : resource.endpoint;
      const request = uuid ? this.api.put<any>(endpoint, this.formModel()) : this.api.post<any>(endpoint, this.formModel());
      await request;
      this.snack.success('InfraGIS record saved.');
      this.dialogRef?.close();
      await this.refresh();
    } catch (error) {
      this.snack.error(error instanceof Error ? error.message : 'Unable to save InfraGIS record.');
    } finally {
      this.saving.set(false);
    }
  }

  async remove(resource: InfraGisResource, row: InfraGisRecord) {
    const uuid = row?.[resource.uuidField];
    if (!uuid) return;
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      panelClass: 'slow-confirm-dialog',
      data: {
        title: 'Delete record',
        message: `Delete ${this.displayValue(row, resource.columns[0].key)}?`,
        confirmLabel: 'Delete',
      },
    });
    const confirmed = await ref.afterClosed().toPromise();
    if (!confirmed) return;
    this.loading.set(true);
    try {
      await this.api.delete<any>(`${resource.endpoint}/${uuid}`);
      this.snack.success('InfraGIS record deleted.');
      await this.refresh();
    } catch (error) {
      this.snack.error(error instanceof Error ? error.message : 'Unable to delete InfraGIS record.');
    } finally {
      this.loading.set(false);
    }
  }

  displayedColumns(resource: InfraGisResource) {
    return [...resource.columns.map((column) => column.key), 'actions'];
  }

  displayValue(row: InfraGisRecord, key: string) {
    const value = row?.[key];
    if (key.endsWith('Status')) return Number(value) === 1 ? 'Active' : 'Inactive';
    return value ?? '-';
  }

  metric(key: string) {
    return Number(this.summary()[key] ?? 0);
  }

  updateField(key: string, value: unknown) {
    this.formModel.set({ ...this.formModel(), [key]: value });
  }

  mapPointStyle(asset: InfraGisRecord) {
    const lat = Number(asset['IgmLatitude']);
    const lng = Number(asset['IgmLongitude']);
    const left = Number.isFinite(lng) ? ((lng + 180) / 360) * 100 : 50;
    const top = Number.isFinite(lat) ? ((90 - lat) / 180) * 100 : 50;
    return {
      left: `${Math.min(96, Math.max(4, left))}%`,
      top: `${Math.min(92, Math.max(8, top))}%`,
      '--asset-color': asset['Color'] || '#22C55E',
    };
  }

  private openDialog(resource: InfraGisResource, row: InfraGisRecord | null) {
    if (!this.recordDialog) return;
    this.editingResource.set(resource);
    this.editingRecord.set(row);
    this.formModel.set(this.toFormModel(resource, row));
    this.dialogRef = this.dialog.open(this.recordDialog, {
      width: 'min(920px, 96vw)',
      maxHeight: '92vh',
      disableClose: true,
      panelClass: 'crud-dialog-panel',
    });
  }

  private toFormModel(resource: InfraGisResource, row: InfraGisRecord | null): InfraGisRecord {
    if (!row) {
      return { status: 1, sortOrder: 1000, geometryType: 'POINT', color: '#22C55E' };
    }
    const mappings: Record<string, string> = {
      name: `${this.prefix(resource)}Name`,
      code: `${this.prefix(resource)}Code`,
      color: resource.key === 'asset-types' ? 'IgtDefaultColor' : `${this.prefix(resource)}Color`,
      icon: resource.key === 'asset-types' ? 'IgtDefaultIcon' : `${this.prefix(resource)}Icon`,
      status: `${this.prefix(resource)}Status`,
      sortOrder: `${this.prefix(resource)}SortOrder`,
      description: 'IprDescription',
      projectUUID: 'InfraGisProjectIprUUID',
      layerUUID: 'InfraGisLayerIglUUID',
      categoryUUID: 'InfraGisAssetCategoryIacUUID',
      assetTypeUUID: 'InfraGisAssetTypeIgtUUID',
      assetStatusUUID: 'InfraGisAssetStatusIgsUUID',
      geometryType: 'IgmGeometryType',
      latitude: 'IgmLatitude',
      longitude: 'IgmLongitude',
      propertiesJson: 'IgaPropertiesJson',
      geoJson: 'IgmGeoJson',
      externalID: 'IgaExternalID',
      styleJson: 'IglStyleJson',
    };
    const model: InfraGisRecord = {};
    for (const field of resource.fields) model[field.key] = row[mappings[field.key]] ?? null;
    return model;
  }

  private prefix(resource: InfraGisResource) {
    return {
      projects: 'Ipr',
      layers: 'Igl',
      categories: 'Iac',
      'asset-types': 'Igt',
      statuses: 'Igs',
      assets: 'Iga',
    }[resource.key];
  }

  private listUrl(resource: InfraGisResource) {
    const params = new URLSearchParams();
    if (this.search()) params.set('search', this.search());
    if (this.statusFilter() !== null) params.set('status', String(this.statusFilter()));
    params.set('limit', '5000');
    return `${resource.endpoint}?${params.toString()}`;
  }

  private statusOptions() {
    return [{ value: 1, label: 'Active' }, { value: 0, label: 'Inactive' }];
  }

  private geometryOptions() {
    return ['POINT', 'LINE', 'POLYGON', 'MIXED'].map((value) => ({ value, label: value }));
  }

  private projectOptions() {
    return this.rows().projects.map((row) => ({ value: row['IprUUID'], label: row['IprName'] }));
  }

  private layerOptions() {
    return this.rows().layers.map((row) => ({
      value: row['IglUUID'],
      label: `${row['ProjectName']} / ${row['IglName']}`,
    }));
  }

  private categoryOptions() {
    return [
      { value: null, label: '-' },
      ...this.rows().categories.map((row) => ({ value: row['IacUUID'], label: row['IacName'] })),
    ];
  }

  private assetTypeOptions() {
    return [
      { value: null, label: '-' },
      ...this.rows()['asset-types'].map((row) => ({
        value: row['IgtUUID'],
        label: row['IgtName'],
      })),
    ];
  }

  private assetStatusOptions() {
    return [
      { value: null, label: '-' },
      ...this.rows().statuses.map((row) => ({ value: row['IgsUUID'], label: row['IgsName'] })),
    ];
  }

  private taxonomyFields(label: string): InfraGisResource['fields'] {
    return [
      { key: 'code', label: `${label} Code` },
      { key: 'name', label: 'Name' },
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'icon', label: 'Icon' },
      { key: 'sortOrder', label: 'Sort Order', type: 'number' },
      { key: 'status', label: 'Status', type: 'select', options: () => this.statusOptions() },
    ];
  }

  private statusFields(): InfraGisResource['fields'] {
    return [
      { key: 'code', label: 'Status Code' },
      { key: 'name', label: 'Name' },
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'sortOrder', label: 'Sort Order', type: 'number' },
      { key: 'status', label: 'Status', type: 'select', options: () => this.statusOptions() },
    ];
  }
}
