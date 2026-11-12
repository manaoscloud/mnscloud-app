import { Component } from '@angular/core';
import { revisionDeletePayloads } from '../../../shared/crud/configurable-crud/revision-delete';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

/** Secret names are upper case with digits and underscores (`{{secret.NAME}}` in HTTP nodes). */
export const SECRET_NAME_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/;

/** Body for create/update: the value is write-only and sent only when typed. */
export function secretPayload(
  values: Record<string, unknown>,
  editing: boolean,
): Record<string, unknown> {
  const value = String(values['value'] ?? '');
  const description = String(values['description'] ?? '').trim();
  return {
    ...(editing ? { revision: Number(values['revision']) } : {}),
    name: String(values['name'] ?? '')
      .trim()
      .toUpperCase(),
    description,
    ...(value ? { value } : {}),
  };
}

/** Secrets that HTTP nodes read through `{{secret.NAME}}`; the value is never shown again. */
export const AUTOMATION_SECRETS_CONFIG = defineCrud({
  endpoint: 'automation/secrets',
  uuidField: 'AscUUID',
  pageTitle: 'automation.secrets.title',
  pageDescription: 'automation.secrets.description',
  createTitle: 'automation.secrets.create',
  editTitle: 'automation.secrets.edit',
  searchPlaceholder: 'automation.secrets.search',
  emptyLabel: 'automation.secrets.empty',
  serverSidePagination: true,
  statusFilter: false,
  ...revisionDeletePayloads('AscUUID', 'AscRevision'),
  initialValues: { name: '', description: '', value: '', revision: null },
  columns: [
    { id: 'name', label: 'Name', field: 'AscName', uuidField: 'AscUUID', kind: 'identity' },
    { id: 'description', label: 'Description', field: 'AscDescription' },
    { id: 'hasSecret', label: 'automation.secrets.hasValue', field: 'HasSecret', kind: 'boolean' },
    { id: 'updated', label: 'Updated at', field: 'AscDateUpdated', kind: 'datetime' },
  ],
  fields: [
    {
      key: 'name',
      source: 'AscName',
      label: 'Name',
      required: true,
      span: 1,
      help: 'automation.secrets.nameHelp',
    },
    // business-description: what the secret is for, shown in the list.
    {
      key: 'description',
      source: 'AscDescription',
      label: 'Description',
      type: 'textarea',
      span: 4,
      rows: 4,
    },
    {
      key: 'value',
      label: 'automation.secrets.value',
      type: 'password',
      autocomplete: 'new-password',
      span: 1,
      requiredWhen: ({ editing }) => !editing,
      help: 'automation.secrets.valueHelp',
    },
    { key: 'revision', source: 'AscRevision', label: 'documents.revision', hidden: true },
  ],
  payload: (values, editing) => secretPayload(values, editing),
});

@Component({
  selector: 'app-automation-secrets',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class AutomationSecretsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(AUTOMATION_SECRETS_CONFIG);
  }

  protected override validatePayload(payload: ConfigurableCrudRecord): boolean {
    const valid = super.validatePayload(payload);
    const name = String(payload['name'] ?? '');
    if (name && !SECRET_NAME_PATTERN.test(name))
      return this.rejectField('name', 'automation.secrets.nameInvalid');
    return valid;
  }
}
