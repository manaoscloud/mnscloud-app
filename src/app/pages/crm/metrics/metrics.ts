import { TranslocoService } from '@jsverse/transloco';
import { Component, inject } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { crmWorkspaceFilter } from '../crm-workspace-fields';

@Component({
  selector: 'app-crm-metrics',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class CrmMetricsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    const i18n = inject(TranslocoService);
    super(
      defineCrud({
        endpoint: 'crm/metrics',
        uuidField: 'key',
        pageTitle: 'crm.prospect.metrics',
        pageDescription: 'crm.prospect.metricsHelp',
        fields: [],
        canCreate: false,
        canEdit: false,
        canDelete: false,
        statusFilter: false,
        serverSidePagination: true,
        serverSideFiltering: true,
        searchEnabled: false,
        initialPageSize: 200,
        pageSizeOptions: [25, 50, 100, 200],
        listFilters: [
          { ...crmWorkspaceFilter, key: 'workspaceUUID', paramKey: 'workspaceUUID' },
          {
            key: 'ownerUUID',
            label: 'crm.field.AssignedUserUsrUUID',
            type: 'search-select',
            span: 1,
            remoteLookup: { endpoint: 'crm/members', uuidField: 'UsrUUID', labelField: 'UsrName' },
          },
          {
            key: 'days',
            emptyValueLabel: 'crm.prospect.defaultPeriod',
            label: 'crm.prospect.days',
            type: 'select',
            span: 1,
            options: [30, 90, 180, 365].map((value) => ({ value, label: String(value) })),
          },
        ],
        columns: [
          {
            id: 'label',
            field: 'label',
            label: 'Name',
            kind: 'identity',
            value: (r, t) =>
              r['dimension'] === 'overview'
                ? t(`crm.prospect.metric.${r['key']}`)
                : String(r['label']),
          },
          {
            id: 'dimension',
            field: 'dimension',
            label: 'crm.prospect.dimension',
            options: ['overview', 'source', 'stage', 'loss-reason'].map((value) => ({
              value,
              label: `crm.prospect.${value}`,
            })),
          },
          ...['total', 'converted', 'won', 'lost', 'averageHours'].map((field) => ({
            id: field,
            field,
            label: `crm.prospect.${field}`,
            kind: 'number' as const,
          })),
          {
            id: 'rate',
            label: 'crm.prospect.rate',
            value: (r) =>
              r['key'] === 'conversion' && Number(r['total']) > 0
                ? new Intl.NumberFormat(i18n.getActiveLang(), {
                    style: 'percent',
                    maximumFractionDigits: 1,
                  }).format(Number(r['converted']) / Number(r['total']))
                : '—',
          },
        ],
      }),
    );
  }
}
