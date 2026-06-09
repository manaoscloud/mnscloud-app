import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  inject,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';

import { FormsModule } from '@angular/forms';

// Material
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

type Lead = {
  name: string;
  owner: string;
  stage: string;
  value: string;
};

@Component({
  selector: 'app-crm-leads',
  standalone: true,
  imports: [
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './leads.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./leads.scss'],
})
export class CrmLeadsPage implements AfterViewInit {
  private cdr = inject(ChangeDetectorRef);

  leads: Lead[] = [
    { name: 'Acme Corp', owner: 'John Doe', stage: 'New', value: '$5,000' },
    { name: 'Globex Ltd', owner: 'Jane Smith', stage: 'Contacted', value: '$12,500' },
    { name: 'Innotech', owner: 'Carlos Silva', stage: 'Qualified', value: '$32,000' },
  ];
  dataSource = new MatTableDataSource<Lead>([]);
  displayedColumns: string[] = ['name', 'owner', 'stage', 'value', 'actions'];
  loading = true;
  error = '';
  search = '';
  searchInput = '';

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'name':
          return data.name;
        case 'owner':
          return data.owner;
        case 'stage':
          return data.stage;
        case 'value':
          return data.value;
        default:
          return '';
      }
    };
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      return [data.name, data.owner, data.stage, data.value].some((field) =>
        String(field).toLowerCase().includes(value),
      );
    };

    setTimeout(() => {
      void this.loadLeads();
    }, 0);
  }

  onSearchChange(value: string) {
    this.searchInput = value;
  }

  applySearchFilters() {
    this.search = this.searchInput.trim();
    this.applyFilter();
  }

  clearSearchFilters() {
    this.searchInput = '';
    this.search = '';
    this.applyFilter();
  }

  refreshList() {
    void this.loadLeads();
  }

  startCreate() {
    this.error = 'Create flow is not available yet.';
  }

  applyFilter() {
    const q = this.search.trim().toLowerCase();
    this.dataSource.filter = q;
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  async loadLeads() {
    this.loading = true;
    this.error = '';
    const start = performance.now();
    try {
      this.dataSource.data = [...this.leads];
      this.applySearchFilters();
    } catch {
      this.error = 'Failed to load leads.';
      this.dataSource.data = [];
    } finally {
      const elapsed = performance.now() - start;
      const minMs = 600;
      const waitMs = Math.max(0, minMs - elapsed);
      if (waitMs) {
        setTimeout(() => {
          this.loading = false;
          this.cdr.detectChanges();
        }, waitMs);
      } else {
        this.loading = false;
        this.cdr.detectChanges();
      }
    }
  }
}
