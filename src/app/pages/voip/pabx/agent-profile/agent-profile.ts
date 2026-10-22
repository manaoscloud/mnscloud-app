import { ApiService } from '../../../../services/api.service';
import { Component, inject, signal } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudOption,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';

const config = defineCrud({
  endpoint: 'voip/pabx/agent-profiles',
  uuidField: 'VqfUUID',
  pageTitle: 'Agent profiles',
  createTitle: 'New agent profile',
  editTitle: 'Edit agent profile',
  dialogDescription: 'Set the shared queue selection, penalty and wrap-up time.',
  serverSidePagination: true,
  quickCreateLabelField: 'VqfName',
  // Page Description Contract: say what the resource is for, then add the key in PT/EN/ES.
  pageDescription: 'Group queues and routing priorities for contact-center agents.',
  initialValues: { VqfName: '', VqfStatus: 1 },
  relatedCollections: [
    {
      key: 'agentQueues',
      label: 'Queues',
      emptyLabel: 'No queues assigned.',
      addLabel: 'Add',
      createTitle: 'Assign queue',
      endpoint: (uuid) => `voip/pabx/agent-profiles/${uuid}/queues`,
      deleteEndpoint: (uuid, row) => `voip/pabx/agent-profiles/${uuid}/queues/${row['VqkUUID']}`,
      uuidField: 'VqkUUID',
      initialValues: { VoipPabxQueueVpqUUID: '', VqkPenalty: 0, VqkWrapUpSeconds: 30 },
      fields: [
        {
          key: 'VoipPabxQueueVpqUUID',
          source: 'VoipPabxQueueVpqUUID',
          label: 'Queue',
          type: 'search-select',
          required: true,
          span: 1,
        },
        { key: 'VqkPenalty', label: 'Penalty', type: 'number', span: 1 },
        { key: 'VqkWrapUpSeconds', label: 'Wrap-up seconds', type: 'number', span: 1 },
      ],
      columns: [
        { id: 'queue', field: 'VpqName', label: 'Queue', kind: 'text' },
        { id: 'penalty', field: 'VqkPenalty', label: 'Penalty', kind: 'number' },
        { id: 'wrap', field: 'VqkWrapUpSeconds', label: 'Wrap-up seconds', kind: 'number' },
      ],
    },
  ],
  fields: [
    { key: 'VqfStatus', source: 'VqfStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'VqfName', source: 'VqfName', label: 'Name', required: true, span: 1 },
  ],
  columns: [
    { id: 'name', field: 'VqfName', label: 'Name', kind: 'identity' },
    { id: 'status', field: 'VqfStatus', label: 'Status', kind: 'status' },
  ],
});

@Component({
  selector: 'app-agent-profile',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipPabxAgentProfilePage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly rawApi = inject(ApiService);
  readonly queueOptions = signal<ConfigurableCrudOption[]>([]);
  constructor() {
    super(config);
    void this.loadQueues();
  }
  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    return key === 'VoipPabxQueueVpqUUID' ? this.queueOptions() : [];
  }
  private async loadQueues() {
    try {
      const options: ConfigurableCrudOption[] = [];
      for (let offset = 0; ; offset += 500) {
        const response = await this.rawApi.get<{ data: { items: Record<string, unknown>[] } }>(
          `voip/pabx/queues?status=1&limit=500&offset=${offset}`,
        );
        const rows = response.data.items;
        options.push(
          ...rows.map((row) => ({ value: String(row['VpqUUID']), label: String(row['VpqName']) })),
        );
        if (rows.length < 500) break;
      }
      this.queueOptions.set(options);
    } catch (error) {
      this.snack.error(this.errorMessage(error));
    }
  }
}
