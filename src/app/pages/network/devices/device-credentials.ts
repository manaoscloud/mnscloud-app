import { Component, inject, signal } from '@angular/core';

import { CONFIGURABLE_CRUD_EMBEDDED } from '../../../shared/crud/configurable-crud/configurable-crud-embedded';
import { ConfigurableCrudEmbeddedCollection } from '../../../shared/crud/configurable-crud/configurable-crud-embedded-collection';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudField,
  ConfigurableCrudOption,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
  ConfigurableCrudSaveContext,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import {
  CREDENTIAL_VALUE_KEYS,
  blankCredentialValues,
  credentialErrorKey,
} from '../network-credentials';
import { formText } from '../network-options';

type Receipt = { data?: { operationState?: string; credentialState?: string; deleted?: boolean } };

/**
 * Device credentials (ST-C). Values go to the vault through a queued operation and are never shown
 * again: every dialog starts with blank value fields, they are cleared on close, and the dialog
 * keeps one idempotency key while its values stay unchanged (a retry after a lost response is the
 * same operation). The list shows the operation state; Refresh and "Check state" read it again.
 */
@Component({
  selector: 'mns-network-device-credentials',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class NetworkDeviceCredentialsCollection extends ConfigurableCrudEmbeddedCollection {
  private readonly parent = inject(CONFIGURABLE_CRUD_EMBEDDED);
  private readonly accessOptions = signal<ConfigurableCrudOption[]>([]);
  private readonly accessLoading = signal(false);
  private readonly deleteIntents = new Map<string, string>();
  private idempotencyKey = crypto.randomUUID();

  constructor() {
    super();
    this.destroyRef.onDestroy(() => this.clearValues());
  }

  private get endpoint(): string {
    return this.config.endpoint;
  }

  override startCreate(): void {
    this.idempotencyKey = crypto.randomUUID();
    void this.loadAccess();
    super.startCreate();
  }

  override startEdit(row: ConfigurableCrudRecord): void {
    this.openEdit(row, 'keep');
  }

  private openEdit(row: ConfigurableCrudRecord, valueMode: 'keep' | 'replace'): void {
    this.idempotencyKey = crypto.randomUUID();
    void this.loadAccess();
    super.startEdit(row);
    this.formValues.update((values) => ({ ...values, ...blankCredentialValues(), valueMode }));
  }

  override closeDialog(): void {
    this.clearValues();
    super.closeDialog();
  }

  protected override onFieldValueChanged(key: string, _value: unknown): void {
    // Another value is another operation: a resubmit of changed values never reuses the key.
    this.idempotencyKey = crypto.randomUUID();
    if (key === 'kind' || key === 'valueMode' || key === 'mode')
      this.formValues.update((values) => ({
        ...values,
        ...blankCredentialValues(),
        ...(key === 'mode' ? { mode: values['mode'] } : {}),
      }));
  }

  protected override saveRequestOptions(): { idempotencyKey?: string } {
    return { idempotencyKey: this.idempotencyKey };
  }

  // Acceptance is not storage: never reflect the submitted form into the list cache.
  protected override reflectSavedRecord(): void {}

  protected override async afterSave(
    context: ConfigurableCrudSaveContext<ConfigurableCrudRecord>,
  ): Promise<void> {
    this.clearValues();
    const queued = Boolean(
      (context.response as { data?: { operationUUID?: string } } | null)?.data?.operationUUID,
    );
    if (queued) this.snack.info(this.t('network.credentialQueued'));
    await super.afterSave(context);
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    return key === 'accessUUID' ? this.accessOptions() : super.lookupOptions(key);
  }

  override fieldLoading(field: ConfigurableCrudField): boolean {
    return field.key === 'accessUUID' ? this.accessLoading() : super.fieldLoading(field);
  }

  protected override errorMessage(error: unknown): string {
    return credentialErrorKey(error) ?? super.errorMessage(error);
  }

  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: ConfigurableCrudRecord,
  ): Promise<void> {
    if (!this.rowActions(row).some((item) => item.key === action.key)) return;
    if (action.key === 'replace') {
      this.openEdit(row, 'replace');
      return;
    }
    if (action.key === 'publicKey') {
      await this.copyText(String(row['NwcPublicKey']));
      return;
    }
    const operation = `${this.endpoint}/${this.recordUUID(row)}/operations/${String(row['OperationUUID'])}`;
    try {
      if (action.key === 'retry') {
        if (
          !(await this.askConfirmation(
            'network.retryCredentialOperation',
            'network.retryCredentialOperationMessage',
            'network.retryCredentialOperation',
          ))
        )
          return;
        await this.api.post(`${operation}/retry`, {});
        this.snack.info(this.t('network.credentialQueued'));
      } else {
        const receipt = await this.api.get<Receipt>(operation);
        const state = String(receipt?.data?.operationState ?? '');
        this.snack.info(this.t(`network.credentialOperationState.${state || 'unknown'}`));
      }
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    }
    this.changed();
  }

  override async deleteItem(row: ConfigurableCrudRecord): Promise<void> {
    if (
      !this.canDeleteRow(row) ||
      !(await this.askConfirmation(
        this.config.deleteTitle,
        this.config.deleteMessage,
        'network.deleteCredential',
      ))
    )
      return;
    const uuid = this.recordUUID(row);
    const revision = String(row['NwcRevision'] ?? '');
    // One operation per confirmed revision: a retry after a lost response reuses its key.
    const intent = `${uuid}:${revision}`;
    const idempotencyKey = this.deleteIntents.get(intent) ?? crypto.randomUUID();
    this.deleteIntents.set(intent, idempotencyKey);
    this.mutating.set(true);
    try {
      const response = await this.api.delete<Receipt>(
        `${this.endpoint}/${uuid}?revision=${encodeURIComponent(revision)}`,
        undefined,
        { idempotencyKey },
      );
      this.deleteIntents.delete(intent);
      const done = response?.data?.operationState === 'success';
      this.snack.success(
        this.t(done ? this.config.deletedMessage : 'network.credentialDeleteQueued'),
      );
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error) || this.config.deleteFailedMessage));
    } finally {
      this.mutating.set(false);
    }
    this.changed();
  }

  private changed(): void {
    this.refreshList();
    this.parent.changed();
  }

  private clearValues(): void {
    const blank = Object.fromEntries(CREDENTIAL_VALUE_KEYS.map((key) => [key, '']));
    this.formValues.update((values) => ({ ...values, ...blank }));
  }

  /** Access methods of the device, for the optional binding of the credential. */
  private async loadAccess(): Promise<void> {
    const endpoint = this.endpoint.replace(/\/credentials$/, '/access');
    this.accessLoading.set(true);
    try {
      const response = await this.api.get<{ data?: { items?: ConfigurableCrudRecord[] } }>(
        `${endpoint}?limit=500`,
      );
      this.accessOptions.set([
        { value: '', label: this.t('network.credentialAnyAccess') },
        ...(response?.data?.items ?? []).map((item) => {
          const method = this.t(`network.method.${String(item['NweMethod'] ?? '')}`);
          const port = formText(item['NwePort']);
          const host = formText(item['EffectiveHost']);
          return {
            value: String(item['NweUUID']),
            label: port ? `${method} :${port}` : method,
            ...(host ? { description: host } : {}),
          };
        }),
      ]);
    } catch {
      this.accessOptions.set([]);
    } finally {
      this.accessLoading.set(false);
    }
  }
}
