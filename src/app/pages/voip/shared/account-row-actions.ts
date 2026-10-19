import type {
  ConfigurableCrudOption,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
  CrudRowActionContext,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { openDataViewerDialog } from '../../../shared/data-viewer-dialog/data-viewer-dialog';
import {
  accountWebRtcDomainActions,
  openAccountWebRtcDomain,
  WEBRTC_DOMAIN_ACTION,
} from './webrtc-domain-action';

/** DNS publication states of a PABX/Softswitch account realm (list column and dialog). */
export const ACCOUNT_PUBLICATION_STATES: ConfigurableCrudOption[] = [
  { value: 'not_requested', label: 'Not requested' },
  { value: 'pending', label: 'Pending' },
  { value: 'queued', label: 'Queued' },
  { value: 'published', label: 'Published' },
  { value: 'failed', label: 'Failed' },
  { value: 'blocked', label: 'Needs review' },
  { value: 'deleted', label: 'Deleted' },
];

/** What the shared account row actions need from the PABX/Softswitch account page. */
export type AccountRowActionContext = CrudRowActionContext;

/** Row actions shared by PABX and Softswitch accounts: WebRTC domain and SIP realm DNS. */
export function accountRowActions(
  row: ConfigurableCrudRecord,
  canEdit: boolean,
): ConfigurableCrudRowAction[] {
  const state = String(row['DnsPublicationState'] ?? 'not_requested');
  const webrtc = accountWebRtcDomainActions(canEdit);
  if (state === 'not_requested') return webrtc;
  return [
    ...webrtc,
    { key: 'dns-status', label: 'DNS publication', icon: 'dns' },
    ...(canEdit && state === 'failed'
      ? [{ key: 'dns-retry', label: 'Retry DNS publication', icon: 'refresh' }]
      : []),
    ...(canEdit && state === 'blocked'
      ? [{ key: 'dns-recheck', label: 'Recheck DNS result', icon: 'fact_check' }]
      : []),
  ];
}

export async function handleAccountRowAction(
  context: AccountRowActionContext,
  type: 'pabx' | 'softswitch',
  action: ConfigurableCrudRowAction,
  accountUUID: string,
): Promise<void> {
  if (action.key === WEBRTC_DOMAIN_ACTION.key) {
    return openAccountWebRtcDomain(
      context.api,
      context.dialog,
      type,
      accountUUID,
      context.notifyError,
    );
  }
  const endpoint = `voip/${type}/accounts/${accountUUID}/dns-publication`;
  const result = await context.api.get<any>(endpoint),
    p = result?.data?.item;
  if (!p) {
    context.notifyError('Unavailable');
    return;
  }
  if ((action.key === 'dns-retry' || action.key === 'dns-recheck') && Number(p.canRetry) === 1) {
    await context.api.post(endpoint + '/retry', {});
    context.refresh();
    return;
  }
  if (action.key === 'dns-recheck') {
    if (p.operationUUID && Number(p.canRecheck) === 1) {
      context.trackOperation(
        await context.api.post(`user/operations/${p.operationUUID}/recheck`, {}),
      );
      context.refresh();
    }
    return;
  }
  openDataViewerDialog(context.dialog, {
    title: 'DNS publication',
    description: 'Publication confirms provider readback, not SIP readiness or DNS cache expiry.',
    details: [
      { label: 'Domain', value: p.name },
      {
        label: 'Status',
        value: context.t(
          ACCOUNT_PUBLICATION_STATES.find(
            (option) =>
              option.value ===
              (['failed', 'blocked'].includes(p.operationState) ? p.operationState : p.state),
          )?.label ?? p.state,
        ),
      },
      { label: 'Operation', value: p.operationUUID },
      { label: 'Error', value: p.operationError ?? p.errorCode },
      { label: 'Updated at', value: p.updatedAt, kind: 'datetime' },
    ],
    sections: [
      {
        title: 'DNS records',
        table: {
          columns: [
            { key: 'type', label: 'Type' },
            { key: 'name', label: 'Name' },
            { key: 'value', label: 'Value' },
            { key: 'ttl', label: 'TTL' },
          ],
          rows: (p.records ?? []).map((r: any) => ({ ...r, value: r.data.join(', ') })),
        },
      },
    ],
  });
}
