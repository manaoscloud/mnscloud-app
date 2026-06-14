import { afterNextRender, Component, effect, resource, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

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
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';

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
    TranslocoPipe,
    RefreshButtonComponent,
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
  styleUrls: ['./leads.scss'],
})
export class CrmLeadsPage {
  leads: Lead[] = [
    { name: 'Acme Corp', owner: 'John Doe', stage: 'New', value: '$5,000' },
    { name: 'Globex Ltd', owner: 'Jane Smith', stage: 'Contacted', value: '$12,500' },
    { name: 'Innotech', owner: 'Carlos Silva', stage: 'Qualified', value: '$32,000' },
  ];
  dataSource = new MatTableDataSource<Lead>([]);
  private readonly leadsResource = resource({
    defaultValue: [] as Lead[],
    loader: () => this.fetchLeads(),
  });
  private readonly syncLeads = effect(() => {
    this.error = '';
    this.dataSource.data = this.leadsResource.value();
    this.applyFilter();
  });
  private readonly reportLeadsError = effect(() => {
    const error = this.leadsResource.error();
    if (error) {
      this.error = 'Failed to load leads.';
      this.dataSource.data = [];
    }
  });
  displayedColumns: string[] = ['name', 'owner', 'stage', 'value', 'actions'];
  readonly loading = this.leadsResource.isLoading;
  error = '';
  search = '';
  searchInput = '';

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);

  private readonly setupTable = afterNextRender(() => {
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
  });

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
    this.leadsResource.reload();
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

  private async fetchLeads(): Promise<Lead[]> {
    return [...this.leads];
  }
}
