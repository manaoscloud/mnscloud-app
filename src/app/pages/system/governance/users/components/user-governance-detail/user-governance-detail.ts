import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslocoPipe } from '@jsverse/transloco';
import { GovernanceAction, GovernanceUser, LegalHold } from '../../user-governance.models';

@Component({
  selector: 'app-user-governance-detail',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatTabsModule, TranslocoPipe],
  templateUrl: './user-governance-detail.html',
  styleUrls: ['./user-governance-detail.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserGovernanceDetailComponent {
  readonly user = input<GovernanceUser | null>(null);
  readonly actions = input<GovernanceAction[]>([]);
  readonly legalHolds = input<LegalHold[]>([]);

  readonly releaseHold = output<LegalHold>();

  fullName(row: GovernanceUser) {
    return [row.FirstName, row.LastName].filter(Boolean).join(' ') || '-';
  }

  holdStatusLabel(hold: LegalHold) {
    return Number(hold.UlhStatus ?? 0) === 1 ? 'Active' : 'Released';
  }
}
