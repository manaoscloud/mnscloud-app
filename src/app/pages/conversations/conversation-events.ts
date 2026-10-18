import { DestroyRef } from '@angular/core';
import { ApiService } from '../../services/api.service';

export type ConversationChange = { ConversationCnvUUID: string; kind: 'conversation' | 'message' };
type EventsResponse = { data?: { cursor?: string; items?: ConversationChange[]; more?: boolean } };

const RETRY_MIN_MS = 5_000;
const RETRY_MAX_MS = 60_000;

/**
 * Inbox push gateway client: long-polls `GET /conversations/events` and reports the conversations
 * that changed, until `destroyRef` is destroyed. Errors back off; nothing is shown to the user.
 */
export function watchConversationChanges(
  api: ApiService,
  destroyRef: DestroyRef,
  onChange: (changes: ConversationChange[]) => void,
): void {
  let stopped = false;
  destroyRef.onDestroy(() => (stopped = true));
  const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  void (async () => {
    let cursor: string | null = null;
    let retry = RETRY_MIN_MS;
    while (!stopped) {
      try {
        const query: string = cursor === null ? '' : `?after=${encodeURIComponent(cursor)}&wait=25`;
        const response: EventsResponse = await api.get<EventsResponse>(
          `conversations/events${query}`,
          {
            timeout: 35_000,
            silent: true,
          },
        );
        if (stopped) return;
        const data = response?.data;
        if (cursor !== null && data?.items?.length) onChange(data.items);
        cursor = String(data?.cursor ?? cursor ?? '0');
        retry = RETRY_MIN_MS;
      } catch {
        if (stopped) return;
        await pause(retry);
        retry = Math.min(retry * 2, RETRY_MAX_MS);
      }
    }
  })();
}
