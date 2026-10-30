const messages: Record<string, string> = {
  REGISTRY_WORKSPACE_FORBIDDEN: 'registryWorkspace.forbidden',
  REGISTRY_WORKSPACE_CONFLICT: 'registryWorkspace.conflict',
  REGISTRY_WORKSPACE_NOT_FOUND: 'registryWorkspace.notFound',
  REGISTRY_WORKSPACE_UNAVAILABLE: 'registryWorkspace.failed',
};

/** Stable server codes select translations without displaying server implementation details. */
export function registryWorkspaceErrorMessage(error: unknown): string | null {
  const code = (error as { error?: { code?: unknown } } | null)?.error?.code;
  return typeof code === 'string' ? (messages[code] ?? null) : null;
}
