const fieldLabels: Record<string, string> = {
  CleName: 'crm.field.Name',
  CleEmail: 'Email',
  ClePhone: 'crm.field.Phone',
  CleDocument: 'crm.field.Document',
  CleNeed: 'crm.field.Need',
  CleState: 'crm.field.State',
  CleCloseReason: 'crm.field.CloseReason',
  CleNextContactAt: 'crm.field.NextContactAt',
  CrmSourceCsoUUID: 'crm.title.sources',
  CrmProductCprUUID: 'crm.title.products',
  RegIndustryRinUUID: 'crm.title.industries',
  CrmWorkspaceCwsUUID: 'crm.field.Workspace',
  AssignedUserUsrUUID: 'crm.field.AssignedUserUsrUUID',
};

function fieldLabelKey(value: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(fieldLabels, value) ? fieldLabels[value] : undefined;
}

/** API codes are data, never translation keys or arbitrary text to show to operators. */
export function importFeedbackKey(value: unknown): string {
  if (typeof value !== 'string') return 'crm.prospect.importError.invalid';
  const field = fieldLabelKey(value);
  if (field) return field;
  // Only the allowlisted machine code before ':' is interpreted; SQL detail is never a key.
  const code = value.split(':', 1)[0].trim();
  if (['CRM_DUPLICATE', 'CRM_IMPORT_DUPLICATE'].includes(code))
    return 'crm.prospect.importError.duplicate';
  if (
    [
      'CRM_CONFLICT',
      'CRM_REVISION_CONFLICT',
      'CRM_IMPORT_CONFLICT',
      'CRM_IMPORT_REPLAY_CONFLICT',
    ].includes(code)
  )
    return 'crm.prospect.importError.conflict';
  if (
    /^CRM_(PERMISSION_DENIED|PERMISSION_REQUIRED|ASSIGNMENT_FORBIDDEN|FORBIDDEN|MEMBERSHIP_REQUIRED|CONTEXT_REQUIRED|WORKSPACE_FORBIDDEN|SUBSCRIPTION_REQUIRED)$/.test(
      code,
    )
  )
    return 'crm.prospect.importError.access';
  if (['CRM_REQUIRED', 'CRM_NEED_REQUIRED'].includes(code))
    return 'crm.prospect.importError.required';
  if (
    [
      'CRM_REFERENCE_INVALID',
      'CRM_INVALID_REFERENCE',
      'CRM_WORKSPACE_REFERENCE_INVALID',
      'CRM_WORKSPACE_UNAVAILABLE',
      'CRM_NOT_FOUND',
    ].includes(code)
  )
    return 'crm.prospect.importError.reference';
  return 'crm.prospect.importError.invalid';
}
/** Only canonical field names may add context to translated API feedback. */
export function importFeedbackText(value: unknown, translate: (key: string) => string): string {
  const message = translate(importFeedbackKey(value));
  if (typeof value !== 'string') return message;
  const parts = value.split(':');
  const field = parts.length === 2 ? fieldLabelKey(parts[1]) : undefined;
  return field ? `${message} · ${translate(field)}` : message;
}

export function duplicateReasonKey(reason: unknown): string {
  return typeof reason === 'string' && ['batch', 'email', 'phone', 'document'].includes(reason)
    ? `crm.prospect.duplicateReason.${reason}`
    : 'crm.prospect.importError.duplicate';
}
