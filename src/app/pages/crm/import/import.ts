import { importFeedbackKey, duplicateReasonKey } from './import-feedback';
import { injectCrmMemoryScope } from '../crm-context';
import { Component, effect, signal } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudFilterAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { crmWorkspaceField } from '../crm-workspace-fields';
import { parseLeadCsv, mapLeadCsv, LEAD_IMPORT_FIELDS, importRequestSize } from './csv';
import { openDataViewerDialog } from '../../../shared/data-viewer-dialog/data-viewer-dialog';

type ImportRow = ConfigurableCrudRecord & {
  rowKey: string;
  data: Record<string, unknown>;
  valid: boolean;
  errors: unknown[];
  duplicates: { uuid: string | null; name: string; reason: string }[];
  selected: boolean;
  allowDuplicate: boolean;
  status: string;
  uuid: string | null;
  code: string | null;
};

@Component({
  selector: 'app-crm-import',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class CrmImportPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly memoryScope = injectCrmMemoryScope();
  private readonly outcomes;
  private readonly headers;
  private csv: string[][] = [];
  private batchUUID = '';
  private workspaceUUID = '';
  private readonly submitting = signal(false);
  constructor() {
    const rows = signal<ImportRow[]>([]);
    const headers = signal<string[]>([]);
    super(
      defineCrud({
        endpoint: 'crm/leads/import',
        uuidField: 'rowKey',
        pageTitle: 'crm.prospect.import',
        pageDescription: 'crm.prospect.importHelp',
        createTitle: 'crm.prospect.import',
        dialogDescription: 'crm.prospect.mappingHelp',
        rows: () => rows(),
        canEdit: false,
        canDelete: false,
        statusFilter: false,
        initialPageSize: 25,
        initialValues: { CrmWorkspaceCwsUUID: '', csv: null },
        fields: [
          crmWorkspaceField,
          {
            key: 'csv',
            label: 'crm.prospect.csv',
            type: 'file',
            accept: '.csv,text/csv',
            required: true,
          },
          ...LEAD_IMPORT_FIELDS.map((key, i) => ({
            key,
            label: [
              'crm.field.Name',
              'Email',
              'crm.field.Phone',
              'crm.field.Document',
              'crm.field.Need',
            ][i],
            type: 'select' as const,
            required: key === 'CleName',
            visibleWhen: () => headers().length > 0,
            optionsWhen: () => headers().map((label, value) => ({ value: String(value), label })),
          })),
        ],
        columns: [
          { id: 'row', field: 'rowKey', label: 'crm.prospect.row', kind: 'identity' },
          {
            id: 'name',
            label: 'Name',
            value: (r) => String((r['data'] as Record<string, unknown>)?.['CleName'] ?? ''),
          },
          { id: 'selected', field: 'selected', label: 'crm.prospect.selected', kind: 'boolean' },
          { id: 'valid', field: 'valid', label: 'crm.prospect.valid', kind: 'boolean' },
          {
            id: 'duplicates',
            label: 'crm.prospect.duplicates',
            value: (r) => String((r['duplicates'] as unknown[]).length),
          },
          {
            id: 'allowed',
            field: 'allowDuplicate',
            label: 'crm.prospect.allowDuplicate',
            kind: 'boolean',
          },
          {
            id: 'status',
            field: 'status',
            label: 'Status',
            options: ['pending', 'created', 'replayed', 'failed'].map((value) => ({
              value,
              label: `crm.prospect.${value}`,
            })),
          },
          {
            id: 'code',
            field: 'code',
            label: 'crm.prospect.error',
            value: (row, translate) =>
              row['code'] ? translate(importFeedbackKey(row['code'])) : '',
          },
          { id: 'uuid', field: 'uuid', label: 'UUID' },
        ],
        filterActions: [{ key: 'import', label: 'crm.prospect.importSelected', icon: 'upload' }],
        rowActions: [
          {
            key: 'select',
            label: 'crm.prospect.toggleSelection',
            icon: 'check_box',
            visible: (r) =>
              Boolean(r['valid']) && ['pending', 'failed'].includes(String(r['status'])),
            run: (r) => {
              rows.update((items) =>
                items.map((item) =>
                  item.rowKey === r['rowKey'] ? { ...item, selected: !item.selected } : item,
                ),
              );
            },
          },
          {
            key: 'duplicates',
            label: 'crm.prospect.allowDuplicate',
            icon: 'content_copy',
            visible: (r) => r['status'] === 'pending' && (r['duplicates'] as unknown[]).length > 0,
            run: (r) => {
              rows.update((items) =>
                items.map((item) =>
                  item.rowKey === r['rowKey']
                    ? { ...item, allowDuplicate: !item.allowDuplicate }
                    : item,
                ),
              );
            },
          },
          { key: 'details', label: 'crm.prospect.preview', icon: 'visibility' },
        ],
      }),
    );
    this.outcomes = rows;
    this.headers = headers;
    let scope = this.memoryScope();
    effect(() => {
      const next = this.memoryScope();
      if (next === scope) return;
      scope = next;
      this.closeDialog();
      this.outcomes.set([]);
      this.headers.set([]);
      this.csv = [];
      this.batchUUID = '';
      this.workspaceUUID = '';
    });
  }
  override startCreate() {
    if (this.submitting()) return;
    this.csv = [];
    this.headers.set([]);
    super.startCreate();
  }
  override async saveItem(_saveAndNew = false) {
    if (this.saving() || this.submitting()) return;
    const values = this.formValues();
    if (!this.validatePayload(values)) return;
    const file = values['csv'];
    if (!(file instanceof File) || file.size > 512 * 1024) {
      this.rejectField('csv', 'crm.prospect.csvError');
      return;
    }
    const scope = this.memoryScope();
    this.saving.set(true);
    try {
      const csv = parseLeadCsv(await file.text());
      if (scope !== this.memoryScope() || this.destroyRef.destroyed) return;
      if (JSON.stringify(csv[0]) !== JSON.stringify(this.headers())) {
        this.csv = csv;
        for (const key of LEAD_IMPORT_FIELDS) this.setFieldValue(key, '');
        this.headers.set(csv[0]);
        this.snack.info(this.transloco.translate('crm.prospect.mapColumns'));
        return;
      }
      this.csv = csv;
      if (scope !== this.memoryScope() || this.destroyRef.destroyed) return;
      const mapped = mapLeadCsv(this.csv, values);
      const workspaceUUID = String(values['CrmWorkspaceCwsUUID']);
      const body = { workspaceUUID, rows: mapped };
      if (importRequestSize(body) > 512 * 1024) throw new Error('size');
      const response = await this.api.post<{ data: { items: ImportRow[] } }>(
        'crm/leads/import/preview',
        body,
      );
      if (
        !Array.isArray(response.data.items) ||
        response.data.items.length !== mapped.length ||
        response.data.items.some(
          (row, i) =>
            row.rowKey !== mapped[i].rowKey ||
            !Array.isArray(row.duplicates) ||
            !Array.isArray(row.errors),
        )
      )
        throw new Error('response');
      if (scope !== this.memoryScope() || this.destroyRef.destroyed) return;
      this.batchUUID = crypto.randomUUID();
      this.workspaceUUID = workspaceUUID;
      this.outcomes.set(
        response.data.items.map((row, i) => ({
          ...row,
          data: mapped[i].data,
          selected: false,
          allowDuplicate: false,
          status: 'pending',
          uuid: null,
          code: null,
        })),
      );
      this.closeDialog();
    } catch {
      this.rejectField('csv', 'crm.prospect.csvError');
    } finally {
      this.saving.set(false);
    }
  }
  override isFilterActionDisabled() {
    return this.submitting();
  }
  override async handleFilterAction(_action: ConfigurableCrudFilterAction) {
    if (this.submitting()) return;
    const selected = this.outcomes().filter(
      (r) =>
        r.selected &&
        r.valid &&
        ['pending', 'failed'].includes(r.status) &&
        (!r.duplicates.length || r.allowDuplicate),
    );
    if (!selected.length) {
      this.snack.error(this.transloco.translate('crm.prospect.selectRows'));
      return;
    }
    const body = {
      batchUUID: this.batchUUID,
      workspaceUUID: this.workspaceUUID,
      rows: selected.map(({ rowKey, data, allowDuplicate }) => ({ rowKey, data, allowDuplicate })),
    };
    if (importRequestSize(body) > 512 * 1024) {
      this.snack.error(this.transloco.translate('crm.prospect.csvError'));
      return;
    }
    const scope = this.memoryScope();
    this.submitting.set(true);
    // Freeze duplicate consent once sent: uncertain responses retry exactly the same intent.
    const keys = new Set(selected.map((r) => r.rowKey));
    this.outcomes.update((rows) =>
      rows.map((r) => (keys.has(r.rowKey) ? { ...r, status: 'failed' } : r)),
    );
    try {
      const response = await this.api.post<{
        data: {
          items: { rowKey: string; status: string; uuid: string | null; code: string | null }[];
        };
      }>('crm/leads/import', body);
      if (scope !== this.memoryScope() || this.destroyRef.destroyed) return;
      const result = response.data.items;
      if (
        !Array.isArray(result) ||
        result.length !== selected.length ||
        result.some(
          (r) => !keys.has(r.rowKey) || !['created', 'replayed', 'failed'].includes(r.status),
        ) ||
        new Set(result.map((r) => r.rowKey)).size !== result.length
      )
        throw new Error('response');
      this.outcomes.update((rows) =>
        rows.map((r) => {
          const outcome = result.find((v) => v.rowKey === r.rowKey);
          return outcome ? { ...r, ...outcome, selected: outcome.status === 'failed' } : r;
        }),
      );
    } catch {
      this.snack.error(this.transloco.translate('crm.prospect.retry'));
    } finally {
      this.submitting.set(false);
    }
  }
  override handleRowAction(_action: unknown, row: ConfigurableCrudRecord) {
    openDataViewerDialog(this.dialog, {
      title: 'crm.prospect.preview',
      description: 'crm.prospect.duplicateHelp',
      sections: [
        {
          title: 'crm.prospect.error',
          message: [
            ...(Array.isArray(row['errors']) ? row['errors'] : []),
            ...(row['code'] ? [row['code']] : []),
          ]
            .map((value) => this.transloco.translate(importFeedbackKey(value)))
            .join('\n'),
        },
        {
          title: 'crm.prospect.duplicates',
          message: (row['duplicates'] as ImportRow['duplicates'])
            .map(
              (r) =>
                `${r.name} · ${this.transloco.translate(duplicateReasonKey(r.reason))}${r.uuid ? ` · ${r.uuid}` : ''}`,
            )
            .join('\n'),
        },
      ],
    });
  }
}
