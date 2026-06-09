import {
  AfterViewInit,
  Component,
  effect,
  resource,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./opportunities.scss'],
})
export class CrmOpportunitiesPage implements AfterViewInit {
  dataSource = new MatTableDataSource<Opportunity>([]);
  private readonly opportunitiesResource = resource({
    defaultValue: [] as Opportunity[],
    loader: () => this.fetchOpportunities(),
  });
  private readonly syncOpportunities = effect(() => {
    this.error = '';
    this.dataSource.data = this.opportunitiesResource.value();
    this.applyFilter();
  });
  private readonly reportOpportunitiesError = effect(() => {
    const error = this.opportunitiesResource.error();
    if (error) {
      this.error = 'Failed to load opportunities.';
      this.dataSource.data = [];
    }
  });
  displayedColumns: string[] = ['name', 'account', 'stage', 'value', 'actions'];
  readonly loading = this.opportunitiesResource.isLoading;
  error = '';
  search = '';

  opportunities: Opportunity[] = [
    { name: 'ERP Migration', account: 'Acme Corp', stage: 'Proposal', value: '$40,000' },
    { name: 'Support Contract', account: 'Globex', stage: 'Negotiation', value: '$12,000' },
    { name: 'Cloud Migration', account: 'Innotech', stage: 'Discovery', value: '$60,000' },
  ];
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
    this.opportunitiesResource.reload();
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

  private async fetchOpportunities(): Promise<Opportunity[]> {
    return [...this.opportunities];
  }
}
