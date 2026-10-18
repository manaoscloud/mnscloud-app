import { DestroyRef } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { ConversationChange, watchConversationChanges } from './conversation-events';

class FakeDestroyRef implements DestroyRef {
  private callbacks: (() => void)[] = [];
  destroyed = false;
  onDestroy(callback: () => void) {
    this.callbacks.push(callback);
    return () => undefined;
  }
  destroy() {
    this.destroyed = true;
    this.callbacks.forEach((callback) => callback());
  }
}

describe('watchConversationChanges', () => {
  it('starts from the current cursor, reports changes and follows the new cursor', async () => {
    const calls: string[] = [];
    const responses = [
      { data: { cursor: '10', items: [] } },
      { data: { cursor: '12', items: [{ ConversationCnvUUID: 'C1', kind: 'message' }] } },
    ];
    const destroy = new FakeDestroyRef();
    const api = {
      get: (endpoint: string) => {
        calls.push(endpoint);
        const next = responses.shift();
        return next ? Promise.resolve(next) : new Promise(() => undefined);
      },
    } as unknown as ApiService;
    const seen: ConversationChange[][] = [];
    watchConversationChanges(api, destroy, (changes) => seen.push(changes));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls.slice(0, 3)).toEqual([
      'conversations/events',
      'conversations/events?after=10&wait=25',
      'conversations/events?after=12&wait=25',
    ]);
    expect(seen).toEqual([[{ ConversationCnvUUID: 'C1', kind: 'message' }]]);
    destroy.destroy();
  });
});
