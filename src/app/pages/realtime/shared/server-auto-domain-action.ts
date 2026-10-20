import type {
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';

/**
 * Row action of TURN/STUN and WebRTC servers without a domain (created before the automatic domain
 * parameter was on): generates the managed <uuid>.<base> domain with the creation rules.
 */
export const SERVER_AUTO_DOMAIN_ACTION: ConfigurableCrudRowAction = {
  key: 'generate-auto-domain',
  label: 'Generate automatic domain',
  icon: 'dns',
  tooltip: 'Generate the managed domain of this server from the automatic domain parameter',
  visible: (row: ConfigurableCrudRecord) => !String(row['RtdName'] ?? '').trim(),
};

/** Calls the API and refreshes the list (the domain column shows the name); errors carry the reason. */
export async function runServerAutoDomainAction(
  generate: () => Promise<any>,
  page: { snack: { success(m: string): void; error(m: string): void }; refreshList(): void },
  errorMessage: (error: unknown) => string | null | undefined,
): Promise<void> {
  try {
    await generate();
    page.snack.success('Automatic domain ready.');
    page.refreshList();
  } catch (error) {
    page.snack.error(errorMessage(error) || 'Automatic domain could not be generated.');
  }
}
