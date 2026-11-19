/** API codes are data, never translation keys or arbitrary text to show to operators. */
export function importFeedbackKey(value: unknown): string {
  const fields: Record<string, string> = {
    CleName: 'crm.field.Name',
    CleEmail: 'Email',
    ClePhone: 'crm.field.Phone',
    CleDocument: 'crm.field.Document',
    CleNeed: 'crm.field.Need',
    CrmWorkspaceCwsUUID: 'crm.field.Workspace',
    AssignedUserUsrUUID: 'crm.field.AssignedUserUsrUUID',
  };
  if (typeof value !== 'string') return 'crm.prospect.importError.invalid';
  if (fields[value]) return fields[value];
  if (value === 'CRM_DUPLICATE') return 'crm.prospect.importError.duplicate';
  if (['CRM_CONFLICT', 'CRM_REVISION_CONFLICT', 'CRM_IMPORT_CONFLICT'].includes(value))
    return 'crm.prospect.importError.conflict';
  if (
    /^CRM_(PERMISSION_DENIED|FORBIDDEN|MEMBERSHIP_REQUIRED|CONTEXT_REQUIRED|WORKSPACE_FORBIDDEN|SUBSCRIPTION_REQUIRED)$/.test(
      value,
    )
  )
    return 'crm.prospect.importError.access';
  if (['CRM_REQUIRED', 'CRM_NEED_REQUIRED'].includes(value))
    return 'crm.prospect.importError.required';
  if (
    [
      'CRM_REFERENCE_INVALID',
      'CRM_INVALID_REFERENCE',
      'CRM_WORKSPACE_REFERENCE_INVALID',
      'CRM_WORKSPACE_UNAVAILABLE',
      'CRM_NOT_FOUND',
    ].includes(value)
  )
    return 'crm.prospect.importError.reference';
  return 'crm.prospect.importError.invalid';
}
export function duplicateReasonKey(reason: unknown): string {
  return typeof reason === 'string' && ['batch', 'email', 'phone', 'document'].includes(reason)
    ? `crm.prospect.duplicateReason.${reason}`
    : 'crm.prospect.importError.duplicate';
}
