import { ConfigurableCrudConfig } from '../../shared/crud/configurable-crud/configurable-crud-page-base';

/** Hides create, edit and delete (bulk included) of a CRUD page when the user cannot write. */
export function gateWrite<T extends ConfigurableCrudConfig>(config: T, canWrite: boolean): T {
  return canWrite
    ? config
    : { ...config, canCreate: false, canEdit: false, canDelete: false, bulkDelete: false };
}
