import { Component } from '@angular/core';

import { fadeIn } from '../../../../shared/animations/fade.animation';
import {
  HUMAN_RESOURCES_CRUD_IMPORTS,
  SimpleResourcePageBase,
} from '../shared/simple-resource-page-base';

@Component({
  selector: 'app-erp-hr-departments',
  standalone: true,
  imports: HUMAN_RESOURCES_CRUD_IMPORTS,
  templateUrl: '../shared/simple-resource-page.html',
  styleUrls: ['../shared/human-resources-crud.scss'],
  animations: [fadeIn],
})
export class ErpHumanResourcesDepartmentsPage extends SimpleResourcePageBase {
  constructor() {
    super({
      endpoint: 'erp/human-resources/departments',
      uuidField: 'DepartmentUUID',
      pageTitle: 'Departments',
      pageDescription: 'Manage human resources departments.',
      dialogCreateTitle: 'New Department',
      dialogEditTitle: 'Edit Department',
      dialogDescription: 'Define the department name, status and notes.',
      deleteLabel: 'Department',
    });
  }
}
