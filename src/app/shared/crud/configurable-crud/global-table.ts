import { NgComponentOutlet } from '@angular/common';
import { Component, Injector, computed, inject, input } from '@angular/core';

import {
  CONFIGURABLE_CRUD_EMBEDDED,
  ConfigurableCrudEmbeddedHost,
} from './configurable-crud-embedded';
import { ConfigurableCrudEmbeddedCollection } from './configurable-crud-embedded-collection';
import { ConfigurableCrudConfig, ConfigurableCrudRecord } from './configurable-crud-page-base';
import { defineCrud } from './define-crud';
import { CONFIGURABLE_CRUD_QUICK_CREATE } from './quick-create';

/**
 * Read-only global table for rows a page already holds (dashboard inventories, operation results,
 * measurements): the same `ConfigurableCrudPageBase` table with sorting, density, column menu,
 * pagination, mobile cards, loading and row actions, without filters or write actions
 * (app.md "Global Table Component Baseline"). Never render a `<table>` for these lists.
 *
 * Usage: `<mns-global-table [config]="workloadTable" [rows]="workloads()" [loading]="loading()" />`
 * where `config` is a constant `defineCrud({...})` (columns, `uuidField`, `emptyLabel`, row actions).
 */
@Component({
  selector: 'mns-global-table',
  standalone: true,
  imports: [NgComponentOutlet],
  template: `<ng-container *ngComponentOutlet="table; injector: tableInjector()" />`,
})
export class GlobalTableComponent {
  readonly config = input.required<ConfigurableCrudConfig>();
  readonly rows = input<readonly ConfigurableCrudRecord[] | null | undefined>([]);
  readonly loading = input(false);

  protected readonly table = ConfigurableCrudEmbeddedCollection;
  private readonly injector = inject(Injector);

  protected readonly tableInjector = computed(() => {
    const host: ConfigurableCrudEmbeddedHost = {
      config: {
        ...this.config(),
        readOnly: true,
        rows: () => this.rows() ?? [],
        rowsLoading: () => this.loading(),
      },
      options: () => [],
      label: () => '',
      loading: () => false,
      deleteUrl: () => '',
      rowAdded: async () => undefined,
      changed: () => undefined,
      attach: () => () => undefined,
    };
    return Injector.create({
      parent: this.injector,
      providers: [
        { provide: CONFIGURABLE_CRUD_EMBEDDED, useValue: host },
        { provide: CONFIGURABLE_CRUD_QUICK_CREATE, useValue: null },
      ],
    });
  });
}

/** Definition of a read-only global table; `key` names it for the per-user column preferences. */
export type GlobalTableDefinition = Pick<
  ConfigurableCrudConfig,
  'uuidField' | 'columns' | 'emptyLabel'
> &
  Partial<
    Pick<
      ConfigurableCrudConfig,
      | 'rowActions'
      | 'initialPageSize'
      | 'pageSizeOptions'
      | 'pagination'
      | 'statusOptions'
      | 'activeValue'
      | 'inactiveValue'
      | 'activeStatusValues'
    >
  > & { key: string };

export function defineGlobalTable({
  key,
  ...table
}: GlobalTableDefinition): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: `table/${key}`,
    pageTitle: key,
    pageDescription: key,
    fields: [],
    readOnly: true,
    bulkDelete: false,
    statusFilter: false,
    ...table,
  });
}
