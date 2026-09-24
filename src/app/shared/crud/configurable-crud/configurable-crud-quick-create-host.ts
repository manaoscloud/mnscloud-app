import { NgComponentOutlet } from '@angular/common';
import { Component, Injector, Provider, Type, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';

import type {
  ConfigurableCrudQuickCreateConfig,
  ConfigurableCrudQuickCreateResult,
} from './configurable-crud-page-base';
import { CONFIGURABLE_CRUD_QUICK_CREATE } from './quick-create';

export type ConfigurableCrudQuickCreateHostData = {
  component: Type<unknown>;
  routeData?: Record<string, unknown>;
};

/**
 * Invisible dialog that renders the referenced resource's canonical CRUD page in quick-create
 * mode. The page opens its own create dialog and reports the created option back through the
 * session token; this host only relays that result to the requesting FK field.
 */
@Component({
  selector: 'mns-crud-quick-create-host',
  standalone: true,
  imports: [NgComponentOutlet],
  template: `<ng-container *ngComponentOutlet="data.component; injector: injector" />`,
  styles: [
    `
      :host {
        display: block;
        inline-size: 0;
        block-size: 0;
        overflow: hidden;
      }
    `,
  ],
})
export class ConfigurableCrudQuickCreateHostComponent {
  readonly data = inject<ConfigurableCrudQuickCreateHostData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(
    MatDialogRef<ConfigurableCrudQuickCreateHostComponent, ConfigurableCrudQuickCreateResult>,
  );
  private completed = false;

  readonly injector = Injector.create({
    parent: inject(Injector),
    providers: [
      ...routeDataProviders(inject(ActivatedRoute, { optional: true }), this.data.routeData),
      {
        provide: CONFIGURABLE_CRUD_QUICK_CREATE,
        useValue: {
          complete: (result: ConfigurableCrudQuickCreateResult) => {
            if (this.completed) return;
            this.completed = true;
            this.dialogRef.close(result);
          },
        },
      },
    ],
  });
}

/**
 * Opens a canonical CRUD page in quick-create mode and resolves the created option, or null when
 * the user cancels. Configurable CRUD fields call this through `quickCreateField`; hand-written
 * Signal Forms dialogs bind it to `mns-search-select-field` `(createRecord)`.
 */
export async function openQuickCreate(
  dialog: MatDialog,
  quickCreate: Pick<ConfigurableCrudQuickCreateConfig, 'component' | 'loadComponent' | 'routeData'>,
): Promise<ConfigurableCrudQuickCreateResult | null> {
  const component = quickCreate.component ?? (await quickCreate.loadComponent?.());
  if (!component) return null;
  const ref = dialog.open<
    ConfigurableCrudQuickCreateHostComponent,
    ConfigurableCrudQuickCreateHostData,
    ConfigurableCrudQuickCreateResult
  >(ConfigurableCrudQuickCreateHostComponent, {
    data: { component, routeData: quickCreate.routeData },
    width: '0',
    height: '0',
    maxWidth: '0',
    maxHeight: '0',
    autoFocus: false,
    restoreFocus: true,
    disableClose: true,
    panelClass: ['quick-create-host-dialog'],
  });
  return (await firstValueFrom(ref.afterClosed())) ?? null;
}

/**
 * Pages resolve their variant from route data (`scope`, catalog kind). In place, they inherit the
 * requesting page's route; `routeData` overrides only the keys the referenced page needs.
 */
function routeDataProviders(
  route: ActivatedRoute | null,
  routeData: Record<string, unknown> | undefined,
): Provider[] {
  if (!route || !routeData) return [];
  const data = { ...route.snapshot.data, ...routeData };
  const snapshot = Object.assign(Object.create(route.snapshot), { data });
  const override = Object.assign(Object.create(route), { snapshot, data: of(data) });
  return [{ provide: ActivatedRoute, useValue: override }];
}
