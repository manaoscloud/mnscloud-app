import { InjectionToken } from '@angular/core';

import type {
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudOption,
  ConfigurableCrudRecord,
} from './configurable-crud-page-base';

/**
 * Parent side of a related collection rendered by the global table inside a form tab
 * (app.md "Global Table Component Baseline"). The parent page keeps owning lookups, labels and
 * hooks; the embedded table only asks for them.
 */
export type ConfigurableCrudEmbeddedHost = {
  config: ConfigurableCrudConfig;
  /** Options of a child form field; `values` is the child form being edited. */
  options: (
    field: ConfigurableCrudField,
    values: ConfigurableCrudRecord,
  ) => readonly ConfigurableCrudOption[];
  label: (key: string, value: unknown) => string;
  loading: (field: ConfigurableCrudField) => boolean;
  /** Full child delete URL (related collections declare it with the record UUID). */
  deleteUrl: (row: ConfigurableCrudRecord) => string;
  /** A child row was created; the parent refreshes its list and runs its hook. */
  rowAdded: (created: ConfigurableCrudRecord | null) => Promise<void>;
  /** A child row was updated, deleted or changed by a row action. */
  changed: () => void;
  /** Registers the child table reload; returns the matching detach. */
  attach: (reload: () => void) => () => void;
};

export const CONFIGURABLE_CRUD_EMBEDDED = new InjectionToken<ConfigurableCrudEmbeddedHost>(
  'CONFIGURABLE_CRUD_EMBEDDED',
);
