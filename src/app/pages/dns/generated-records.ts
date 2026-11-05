import { MatDialog } from '@angular/material/dialog';
import { ApiService } from '../../services/api.service';
import { openDataViewerDialog } from '../../shared/data-viewer-dialog/data-viewer-dialog';

/** Texts of a generated-records viewer (host names PD4, reverse PTR PD5c). */
export interface GeneratedRecordsLabels {
  title: string;
  description: string;
  zone: string;
  syncedAt: string;
  empty: string;
}

type RecordsResponse = {
  data?: { zone?: string; records?: Record<string, unknown>[]; syncedAt?: string };
};

/** Loads `<url>` (zone, records, syncedAt) and shows the generated records read only. */
export async function openGeneratedRecords(
  api: ApiService,
  dialog: MatDialog,
  url: string,
  labels: GeneratedRecordsLabels,
): Promise<void> {
  const response = await api.get<RecordsResponse>(url);
  const rows = (response?.data?.records ?? []).map((record) => ({
    name: String(record['name'] ?? ''),
    type: String(record['type'] ?? ''),
    value: Array.isArray(record['data']) ? record['data'].join(' ') : '',
  }));
  openDataViewerDialog(dialog, {
    title: labels.title,
    description: labels.description,
    details: [
      { label: labels.zone, value: response?.data?.zone ?? '' },
      { label: labels.syncedAt, value: response?.data?.syncedAt ?? '' },
    ],
    sections: [
      {
        title: labels.title,
        table: {
          columns: [
            { key: 'name', label: 'Name', monospace: true },
            { key: 'type', label: 'Type' },
            { key: 'value', label: 'Value', monospace: true },
          ],
          rows,
          emptyLabel: labels.empty,
        },
      },
    ],
  });
}
