import { Component } from '@angular/core';
import { CONFIGURABLE_CRUD_IMPORTS, ConfigurableCrudPageBase, ConfigurableCrudRecord } from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { phoneSessionsConfig } from '../phone-options';

@Component({
  selector: 'app-voip-phone-sessions', standalone: true, imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipPhoneSessionsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() { super(phoneSessionsConfig(null)); }
}
