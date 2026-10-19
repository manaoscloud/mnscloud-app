import { MatDialog } from '@angular/material/dialog';

import { ApiService } from '../../../services/api.service';
import type { ConfigurableCrudRowAction } from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { openDataViewerDialog } from '../../../shared/data-viewer-dialog/data-viewer-dialog';

/** Row action of PABX/Softswitch accounts: generate (or show) the account WSS domain. */
export const WEBRTC_DOMAIN_ACTION: ConfigurableCrudRowAction = {
  key: 'webrtc-domain',
  label: 'WebRTC domain',
  icon: 'language',
  tooltip: 'Generate or show the WebRTC (WSS) domain of the account',
};

/**
 * Accounts created with WebRTC › Automatic DNS enabled already have their domain; this action
 * backfills older accounts and shows the WSS URL, edge and certificate state. Idempotent.
 */
export async function openAccountWebRtcDomain(
  api: ApiService,
  dialog: MatDialog,
  type: 'pabx' | 'softswitch',
  accountUUID: string,
): Promise<void> {
  const result = await api.post<any>(`voip/${type}/accounts/${accountUUID}/webrtc-domain`, {});
  const item = result?.data?.item ?? {};
  openDataViewerDialog(dialog, {
    title: 'WebRTC domain',
    description:
      'WSS address of the account for PhoneWeb and WebRTC clients, with managed DNS and the free certificate of the WebRTC edge.',
    details: [
      { label: 'WSS URL', value: item['WssUrl'], monospace: true, wide: true },
      { label: 'Domain', value: item['WebRtcDomainName'], monospace: true },
      { label: 'WebRTC server', value: item['ServerName'] },
      { label: 'Certificate', value: item['RwdCertificateStatus'], translate: true },
    ],
  });
}
