import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { AccountAction, GovernanceUser } from '../../user-governance.models';

@Component({
  selector: 'app-user-governance-table',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSortModule,
    MatTableModule,
    MatTooltipModule,
    TranslocoPipe,
  ],
  templateUrl: './user-governance-table.html',
  styleUrls: ['./user-governance-table.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserGovernanceTableComponent implements AfterViewInit {
  readonly users = input<GovernanceUser[]>([]);
  readonly loading = input(false);
  readonly selectedUserUUID = input<string | null>(null);

  readonly inspect = output<GovernanceUser>();
  readonly governanceAction = output<{ user: GovernanceUser; action: AccountAction }>();

  readonly source = new MatTableDataSource<GovernanceUser>([]);
  readonly columns = [
    'status',
    'name',
    'email',
    'access',
    'emailVerified',
    'legalHolds',
    'lastAction',
    'created',
    'actions',
  ];

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);

  private readonly syncUsers = effect(() => {
    this.source.data = this.users();
  });

  ngAfterViewInit() {
    this.source.paginator = this.paginator() ?? null;
    this.source.sort = this.sort() ?? null;
    this.source.sortingDataAccessor = (row, column) => this.sortValue(row, column);
  }

  openAction(user: GovernanceUser, action: AccountAction) {
    this.governanceAction.emit({ user, action });
  }

  fullName(row: GovernanceUser) {
    return [row.FirstName, row.LastName].filter(Boolean).join(' ') || '-';
  }

  statusLabel(row: GovernanceUser) {
    if (row.DateDeleted) return 'Closed';
    return Number(row.Status ?? 0) === 1 ? 'Active' : 'Inactive';
  }

  yesNo(value: unknown) {
    return value ? 'Yes' : 'No';
  }

  private sortValue(row: GovernanceUser, column: string): string | number {
    if (column === 'name') return this.fullName(row);
    if (column === 'email') return row.Email ?? '';
    if (column === 'status') return this.statusLabel(row);
    if (column === 'access') return Number(row.AccessCount ?? 0);
    if (column === 'legalHolds') return Number(row.ActiveLegalHoldCount ?? 0);
    if (column === 'created') return row.DateCreated ?? '';
    return String((row as any)[column] ?? '');
  }
}
