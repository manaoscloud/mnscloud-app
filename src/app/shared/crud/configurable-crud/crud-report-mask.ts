/** Capture classification; secret controls cannot opt out of masking. */
export function crudReportMask(field: {
  key: string;
  type?: string;
  reportMask?: boolean;
}): '' | null {
  if (field.type === 'password' || field.type === 'secret-content') return '';
  if (field.reportMask !== undefined) return field.reportMask ? '' : null;
  const sensitiveKey =
    /(pass(word|phrase)?|pwd|secret|token|private.?key|api.?key|credential|pin$)/i;
  return sensitiveKey.test(field.key) && !/uuid$/i.test(field.key) ? '' : null;
}
