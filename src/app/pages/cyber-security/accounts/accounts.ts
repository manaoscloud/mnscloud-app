import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { hasEffectivePermission } from '../../../core/guards/permission.guard';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { openDataViewerDialog } from '../../../shared/data-viewer-dialog/data-viewer-dialog';
import { reportMonth, vulnerabilityReportView } from './vulnerability-report';
import {
  aiFailureKey,
  aiLanguage,
  narrativeForm,
  narrativeMonth,
  type ReportNarrative,
} from '../cyber-ai';
import {
  resaleAccountCrud,
  resaleAccountRowActions,
} from '../../../shared/crud/configurable-crud/account-resale-actions';
import { portalAccessConfig, unblockRequestsConfig } from './account-portal';

export const CYBER_SECURITY_ACCOUNTS_CONFIG = resaleAccountCrud({
  endpoint: 'cyber-security/accounts',
  prefix: 'Cya',
  pageTitle: 'cyberSecurity.accounts',
  pageDescription: 'cyberSecurity.accountsDescription',
  createTitle: 'cyberSecurity.newAccount',
  editTitle: 'cyberSecurity.editAccount',
  i18n: 'cyberSecurity',
  extraColumns: [
    { id: 'servers', field: 'ServersCount', label: 'cyberSecurity.protectedServers' },
    { id: 'vaults', field: 'SecretVaultsCount', label: 'cyberSecurity.secretVaults' },
  ],
});

@Component({
  selector: 'app-cyber-security-accounts',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class CyberSecurityAccountsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    const auth = inject(AuthService);
    const router = inject(Router);
    const canManage = () =>
      hasEffectivePermission(auth.user()?.permissions ?? [], 'tenant.cyber-security.accounts.all');
    const isCustomer = (row: ConfigurableCrudRecord) => row['CyaKind'] === 'customer';
    super({
      ...CYBER_SECURITY_ACCOUNTS_CONFIG,
      canCreate: canManage(),
      rowActions: [
        {
          key: 'dashboard',
          label: 'cyberSecurity.accountDashboard',
          icon: 'space_dashboard',
          run: (row) =>
            void router.navigate(['/cyber-security/dashboard'], {
              queryParams: { cyberAccountUUID: row['CyaUUID'] },
            }),
        },
        ...resaleAccountRowActions({
          module: 'cyber-security',
          uuidField: 'CyaUUID',
          revisionField: 'CyaRevision',
          portalField: 'CyaPortalEnabled',
          kindField: 'CyaKind',
          memberUuidField: 'CymUUID',
          memberStatusField: 'CymStatus',
          publicationLabel: 'cyberSecurity.publication',
          publicationTitle: 'cyberSecurity.publication',
          publicationDescription: 'cyberSecurity.publicationDescription',
          portalEnabledLabel: 'cyberSecurity.portalEnabled',
          assignLabel: 'cyberSecurity.assignOperator',
          assignTitle: 'cyberSecurity.assignOperator',
          operatorsLabel: 'cyberSecurity.operators',
          operatorsTitle: 'cyberSecurity.operators',
          operatorsDescription: 'cyberSecurity.operatorsDescription',
          canManage,
        }),
        {
          key: 'portalAccess',
          label: 'cyberSecurity.portalAccess',
          icon: 'badge',
          visible: (row) => canManage() && isCustomer(row),
          collection: (row) => portalAccessConfig(row),
        },
        {
          key: 'unblockRequests',
          label: 'cyberSecurity.unblockRequests',
          icon: 'lock_open',
          visible: isCustomer,
          collection: unblockRequestsConfig(),
        },
        {
          key: 'vulnerabilityReport',
          label: 'cyberSecurity.report.actionCurrent',
          icon: 'summarize',
        },
        {
          key: 'vulnerabilityReportPrevious',
          label: 'cyberSecurity.report.actionPrevious',
          icon: 'history',
        },
        {
          key: 'reportText',
          label: 'cyberSecurity.ai.reportTextAction',
          icon: 'edit_note',
          visible: isCustomer,
        },
        {
          key: 'reportTextAi',
          label: 'cyberSecurity.ai.reportDraftAction',
          icon: 'auto_awesome',
          visible: isCustomer,
        },
      ],
    });
  }

  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: ConfigurableCrudRecord,
  ): Promise<void> {
    if (action.key === 'reportText' || action.key === 'reportTextAi') {
      await this.editReportText(row, action.key === 'reportTextAi');
      return;
    }
    if (action.key !== 'vulnerabilityReport' && action.key !== 'vulnerabilityReportPrevious') {
      return;
    }
    const month = reportMonth(new Date(), action.key === 'vulnerabilityReport' ? 0 : 1);
    try {
      const response = await this.api.get<{ data?: Record<string, unknown> }>(
        `cyber-security/accounts/${encodeURIComponent(String(row['CyaUUID']))}/vulnerability-report?month=${month}`,
      );
      openDataViewerDialog(
        this.dialog,
        vulnerabilityReportView(response?.data ?? {}, this.t.bind(this)),
      );
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error) || 'cyberSecurity.report.loadFailed'));
    }
  }

  /**
   * Reviewed text of the previous month report (shown in the Customer Portal once published). With
   * AI, cyber_security.monthly_report drafts it and the form opens for review; nothing is saved
   * or published before the reseller saves.
   */
  private async editReportText(row: ConfigurableCrudRecord, withAi: boolean): Promise<void> {
    const account = String(row['CyaUUID']);
    const month = narrativeMonth(new Date());
    const base = `cyber-security/accounts/${encodeURIComponent(account)}/vulnerability-report/narrative`;
    try {
      const current =
        (await this.api.get<{ data?: ReportNarrative }>(`${base}?month=${month}`))?.data ?? null;
      let draft: string | null = null;
      if (withAi) {
        if (
          current &&
          !(await this.confirmAction(
            'cyberSecurity.ai.reportDraftAction',
            'cyberSecurity.ai.reportDraftReplace',
            'cyberSecurity.ai.reportDraftAction',
          ))
        ) {
          return;
        }
        const response = await this.api.post<{ data?: { text?: string } }>(`${base}/ai-draft`, {
          month,
          language: aiLanguage(this.transloco.getActiveLang()),
        });
        draft = response?.data?.text ?? '';
      }
      await this.runRowAction(
        {
          key: 'reportTextForm',
          label: 'cyberSecurity.ai.reportText',
          icon: 'edit_note',
          form: () => narrativeForm(account, month, current, draft),
        },
        row,
      );
    } catch (error) {
      this.snack.error(
        this.t(aiFailureKey(error) ?? (this.errorMessage(error) || 'cyberSecurity.ai.failed')),
      );
    }
  }
}
