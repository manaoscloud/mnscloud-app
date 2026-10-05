/** One idempotency key per logical draft, scoped to the active environment. */
export class SupportRequestDraft {
  private current: { scope: string; fingerprint: string; payload: Record<string, unknown> } | null =
    null;

  prepare(scope: string, payload: Record<string, unknown>, identity: unknown = payload) {
    const fingerprint = JSON.stringify(identity);
    if (!this.current || this.current.scope !== scope || this.current.fingerprint !== fingerprint) {
      this.current = {
        scope,
        fingerprint,
        payload: { ...structuredClone(payload), idempotencyKey: crypto.randomUUID() },
      };
    }
    return structuredClone(this.current.payload);
  }

  clear() {
    this.current = null;
  }
}
