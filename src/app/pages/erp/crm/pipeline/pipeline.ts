import { Component, ChangeDetectionStrategy } from '@angular/core';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-crm-pipeline',
  standalone: true,
  imports: [MatCardModule, MatIconModule],
  templateUrl: './pipeline.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./pipeline.scss'],
})
export class CrmPipelinePage {
  stages = [
    {
      name: 'New',
      count: 5,
      value: '$25,000',
    },
    {
      name: 'Qualified',
      count: 3,
      value: '$48,000',
    },
    {
      name: 'Proposal',
      count: 2,
      value: '$40,000',
    },
    {
      name: 'Negotiation',
      count: 1,
      value: '$18,000',
    },
  ];
}
