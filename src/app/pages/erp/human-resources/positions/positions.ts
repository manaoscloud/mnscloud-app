import { Component, ChangeDetectionStrategy } from '@angular/core';

import {
  HUMAN_RESOURCES_CRUD_IMPORTS,
  SimpleResourcePageBase,
} from '../shared/simple-resource-page-base';

@Component({
  selector: 'app-erp-hr-positions',
  standalone: true,
  imports: HUMAN_RESOURCES_CRUD_IMPORTS,
  templateUrl: '../shared/simple-resource-page.html',
  styleUrls: ['../shared/human-resources-crud.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpHumanResourcesPositionsPage extends SimpleResourcePageBase {
  constructor() {
    super({
      endpoint: 'erp/human-resources/positions',
      uuidField: 'PositionUUID',
      pageTitle: 'Positions',
      pageDescription: 'Manage human resources job positions.',
      dialogCreateTitle: 'New Position',
      dialogEditTitle: 'Edit Position',
      dialogDescription: 'Define the position name, status and notes.',
      deleteLabel: 'Position',
    });
  }
}
