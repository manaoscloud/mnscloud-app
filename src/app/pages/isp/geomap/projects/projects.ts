import { AfterViewInit, Component, OnDestroy, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { firstValueFrom } from 'rxjs';

import { fadeIn } from '../../../../shared/animations/fade.animation';
import { ApiService } from '../../../../services/api.service';
import { IspGeoMapProject } from '../../../../models/isp-geomap-project.model';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';

@Component({
  selector: 'app-isp-geomap-projects',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatTooltipModule,
    MatPaginatorModule,
    MatSortModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatTabsModule,
  ],
  templateUrl: './projects.html',
  styleUrls: ['./projects.scss'],
  animations: [fadeIn],
})
export class IspGeoMapProjectsPage implements AfterViewInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly editing = signal<IspGeoMapProject | null>(null);

  readonly dataSource = new MatTableDataSource<IspGeoMapProject>([]);
  readonly displayedColumns = ['name', 'status', 'description', 'actions'];
  search = '';
  searchInput = '';

  readonly projectForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    status: ['ACTIVE'],
  });

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild('projectFormDialog') projectFormDialog?: TemplateRef<unknown>;
  private projectFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sort = this.sort ?? null;
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      return [data.IgpName, data.IgpDescription, data.IgpID]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    };

    setTimeout(() => {
      this.loadProjects();
    }, 0);
  }

  ngOnDestroy() {
    this.stopDialogViewportObserver();
    this.closeProjectDialog();
  }

  onSearchChange(value: string) {
    this.searchInput = value;
  }

  applySearchFilters(value?: string) {
    if (value !== undefined) this.searchInput = value;
    this.search = this.searchInput.trim();
    this.dataSource.filter = this.search.toLowerCase();
    if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
  }

  clearSearchFilters() {
    this.searchInput = '';
    this.search = '';
    this.dataSource.filter = '';
    if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
  }

  refreshList() {
    void this.loadProjects();
  }

  async loadProjects() {
    this.loading.set(true);
    this.error.set(null);
    const start = performance.now();

    try {
      const response = await this.api.get<any>('isp/geomap/projects?limit=200');
      const items = response?.data?.items ?? [];
      this.dataSource.data = items;
      this.applySearchFilters();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to load projects.'));
    } finally {
      const elapsed = performance.now() - start;
      const waitMs = Math.max(0, 600 - elapsed);
      if (waitMs) {
        setTimeout(() => this.loading.set(false), waitMs);
      } else {
        this.loading.set(false);
      }
    }
  }

  startCreate() {
    this.editing.set(null);
    this.projectForm.reset({
      name: '',
      description: '',
      status: 'ACTIVE',
    });
  }

  startEdit(item: IspGeoMapProject) {
    this.editing.set(item);
    this.projectForm.reset({
      name: item.IgpName,
      description: item.IgpDescription ?? '',
      status: item.IgpStatus ?? 'ACTIVE',
    });
    this.openProjectDialog();
  }

  async saveProject() {
    if (this.projectForm.invalid) return;

    const value = this.projectForm.getRawValue();
    const payload = {
      name: value.name.trim(),
      description: value.description?.trim() || null,
      status: value.status,
    };

    this.saving.set(true);
    this.error.set(null);

    try {
      const editing = this.editing();
      if (editing) {
        const response = await this.api.put<any>(`isp/geomap/projects/${editing.IgpUUID}`, payload);
        const item = response?.data?.item ?? null;
        if (item) {
          this.dataSource.data = this.dataSource.data.map((row) =>
            row.IgpUUID === item.IgpUUID ? item : row,
          );
        }
      } else {
        const response = await this.api.post<any>('isp/geomap/projects', payload);
        const item = response?.data?.item ?? null;
        if (item) {
          this.dataSource.data = [item, ...this.dataSource.data];
        }
      }

      this.closeProjectDialog();
      this.startCreate();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to save project.'));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteProject(item: IspGeoMapProject) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete project',
        message: `Are you sure you want to delete "${item.IgpName}"?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.delete(`isp/geomap/projects/${item.IgpUUID}`);
      this.dataSource.data = this.dataSource.data.filter(
        (row) => row.IgpUUID !== item.IgpUUID,
      );
    } catch (err) {
      console.error('Failed to delete project.', err);
      alert('Failed to delete project.');
    }
  }

  statusLabel(item: IspGeoMapProject) {
    return item.IgpStatus === 'ACTIVE' ? 'Active' : 'Inactive';
  }

  openCreateDialog() {
    this.startCreate();
    this.openProjectDialog();
  }

  cancelProjectForm() {
    this.closeProjectDialog();
    this.startCreate();
  }

  private openProjectDialog() {
    if (!this.projectFormDialog || this.projectFormDialogRef) return;
    this.error.set(null);
    this.projectFormDialogRef = this.dialog.open(this.projectFormDialog, {
      ...this.getProjectDialogViewportConfig(),
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'isp-geomap-project-form-dialog',
    });
    this.projectFormDialogRef.keydownEvents().subscribe((event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.closeProjectDialog();
      }
    });
    this.startDialogViewportObserver();
    this.projectFormDialogRef.afterClosed().subscribe(() => {
      this.stopDialogViewportObserver();
      this.projectFormDialogRef = null;
    });
  }

  private closeProjectDialog() {
    if (!this.projectFormDialogRef) return;
    this.stopDialogViewportObserver();
    this.projectFormDialogRef.close();
    this.projectFormDialogRef = null;
  }

  private getProjectDialogViewportConfig() {
    if (window.innerWidth <= 900) {
      return {
        width: '100vw',
        maxWidth: '100vw',
        maxHeight: '100dvh',
      };
    }

    const pageContent = document.querySelector('.page-content') as HTMLElement | null;
    if (!pageContent) {
      return {
        width: 'min(1280px, calc(100vw - 1.5rem))',
        maxWidth: '99vw',
        maxHeight: '95vh',
      };
    }

    const rect = pageContent.getBoundingClientRect();
    const spacing = 8;
    const widthPx = Math.max(320, Math.floor(rect.width - spacing * 2));
    const maxHeightPx = Math.max(420, Math.floor(rect.height - spacing * 2));
    const leftPx = Math.max(0, Math.floor(rect.left + spacing));
    const topPx = Math.max(0, Math.floor(rect.top + spacing));

    return {
      width: `${widthPx}px`,
      maxWidth: `${widthPx}px`,
      maxHeight: `${maxHeightPx}px`,
      position: {
        left: `${leftPx}px`,
        top: `${topPx}px`,
      },
    };
  }

  private startDialogViewportObserver() {
    this.stopDialogViewportObserver();
    if (!this.projectFormDialogRef) return;

    const pageContent = document.querySelector('.page-content') as HTMLElement | null;
    if (!pageContent) return;

    this.dialogViewportObserver = new ResizeObserver(() => {
      this.updateProjectDialogViewport();
    });
    this.dialogViewportObserver.observe(pageContent);
    this.updateProjectDialogViewport();
  }

  private stopDialogViewportObserver() {
    if (!this.dialogViewportObserver) return;
    this.dialogViewportObserver.disconnect();
    this.dialogViewportObserver = null;
  }

  private updateProjectDialogViewport() {
    if (!this.projectFormDialogRef) return;
    const config = this.getProjectDialogViewportConfig();
    const width = typeof config.width === 'string' ? config.width : '';
    const maxHeight = typeof config.maxHeight === 'string' ? config.maxHeight : '';
    this.projectFormDialogRef.updateSize(width, maxHeight);
    if (config.position) {
      this.projectFormDialogRef.updatePosition(config.position);
    } else {
      this.projectFormDialogRef.updatePosition();
    }
  }

  private extractErrorMessage(err: any, fallback: string) {
    return err?.error?.error || err?.error?.message || err?.message || fallback;
  }
}
