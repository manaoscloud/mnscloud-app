/** Display-only labels returned by the canonical permission lists; never authorization. */
export function capacityScopeLabel(
  row: Record<string, unknown>,
  translate: (key: string) => string,
): string {
  let scopes = row['conditionScopes'];
  if (typeof scopes === 'string') {
    try {
      scopes = JSON.parse(scopes);
    } catch {
      return translate('capacityAccess.scopeUnavailable');
    }
  }
  if (!Array.isArray(scopes)) return translate('capacityAccess.scopeUnavailable');
  if (!scopes.length) return translate('capacityAccess.unrestricted');
  return scopes
    .map((scope: unknown) => {
      if (!scope || typeof scope !== 'object' || Array.isArray(scope)) {
        return translate('capacityAccess.scopeUnavailable');
      }
      const value = scope as Record<string, unknown>;
      if (Number(value['supported']) !== 1) return translate('capacityAccess.unsupported');
      const parts: string[] = [];
      for (const key of ['clusters', 'providers']) {
        const resources = value[key];
        if (resources === null) continue;
        if (!Array.isArray(resources) || !resources.length) {
          return translate('capacityAccess.scopeUnavailable');
        }
        const names: string[] = [];
        for (const resource of resources) {
          if (!resource || typeof resource !== 'object' || typeof resource.uuid !== 'string') {
            return translate('capacityAccess.scopeUnavailable');
          }
          names.push(
            typeof resource.name === 'string' && resource.name
              ? resource.name
              : `${translate('capacityAccess.unavailableResource')} (${resource.uuid})`,
          );
        }
        parts.push(`${translate(`capacityAccess.${key}`)}: ${names.join(', ')}`);
      }
      return parts.length ? parts.join(' · ') : translate('capacityAccess.scopeUnavailable');
    })
    .join(` ${translate('capacityAccess.and')} `);
}
