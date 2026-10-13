import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

const config = defineCrud({
  endpoint: 'authentication/sessions',
  uuidField: 'AseUUID',
  pageTitle: 'authentication.sessions',
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  initialPageSize: 50,
  initialValues: {},
  fields: [],
  columns: [
    { id: 'username', field: 'AseUsername', label: 'authentication.username', kind: 'identity' },
    { id: 'session', field: 'AseSessionId', label: 'authentication.sessionId' },
    {
      id: 'state',
      field: 'AseState',
      label: 'authentication.observation',
      options: [
        { value: 'open', label: 'authentication.open' },
        { value: 'stale', label: 'authentication.stale' },
        { value: 'closed', label: 'authentication.closed' },
      ],
    },
    { id: 'seconds', field: 'AseSessionSeconds', label: 'authentication.seconds' },
    { id: 'input', field: 'AseInputOctets', label: 'authentication.inputOctets' },
    { id: 'output', field: 'AseOutputOctets', label: 'authentication.outputOctets' },
    { id: 'lastSeen', field: 'AseLastSeenAt', label: 'authentication.lastSeen', kind: 'datetime' },
  ],
});

@Component({
  selector: 'app-sessions',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class AuthenticationSessionPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
