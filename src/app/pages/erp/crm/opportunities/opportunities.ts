import { AfterViewInit, ChangeDetectorRef, Component, ViewChild, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

import { FormsModule } from '@angular/forms';

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

type Opportunity = {
  name: string;
  account: string;
  stage: string;
  value: string;
};

@Component({
  selector: 'app-crm-opportunities',
  standalone: true,
  imports: [
    CommonModule,
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
  templateUrl: './opportunities.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./opportunities.scss'],
})
export class CrmOpportunitiesPage implements AfterViewInit {
  private cdr = inject(ChangeDetectorRef);

  dataSource = new MatTableDataSource<Opportunity>([]);
  displayedColumns: string[] = ['name', 'account', 'stage', 'value', 'actions'];
  loading = true;
  error = '';
  search = '';

  opportunities: Opportunity[] = [
    { name: 'ERP Migration', account: 'Acme Corp', stage: 'Proposal', value: '$40,000' },
    { name: 'Support Contract', account: 'Globex', stage: 'Negotiation', value: '$12,000' },
    { name: 'Cloud Migration', account: 'Innotech', stage: 'Discovery', value: '$60,000' },
  ];
  searchInput = '';

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sort = this.sort ?? null;
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'name':
          return data.name;
        case 'account':
          return data.account;
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
      return [data.name, data.account, data.stage, data.value].some((field) =>
        String(field).toLowerCase().includes(value),
      );
    };

    setTimeout(() => {
      void this.loadOpportunities();
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
    void this.loadOpportunities();
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

  async loadOpportunities() {
    this.loading = true;
    this.error = '';
    const start = performance.now();
    try {
      this.dataSource.data = [...this.opportunities];
      this.applySearchFilters();
    } catch {
      this.error = 'Failed to load opportunities.';
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
