export type AccountAction =
  | 'suspend'
  | 'close'
  | 'anonymize'
  | 'legal-hold'
  | 'release-hold'
  | 'verify-email'
  | 'resend-verification'
  | TestTenantAction;

/** Test tenant marker actions (POST system/governance/users/:uuid/test-tenant). */
export type TestTenantAction =
  'test-mark' | 'test-unmark' | 'test-allow-provisioning' | 'test-deny-provisioning';

export const TEST_TENANT_API_ACTION: Record<TestTenantAction, string> = {
  'test-mark': 'mark',
  'test-unmark': 'unmark',
  'test-allow-provisioning': 'allow-provisioning',
  'test-deny-provisioning': 'deny-provisioning',
};

export interface ApiListResponse<T> {
  data?: {
    items?: T[];
    item?: T;
  };
}

export interface GovernanceUser {
  UserUUID: string;
  FirstName?: string | null;
  LastName?: string | null;
  Email?: string | null;
  Status?: number | null;
  EmailVerifiedAt?: string | null;
  EmailVerificationDeadlineAt?: string | null;
  TestTenant?: number | null;
  TestProvisioningAllowed?: number | null;
  DateDeleted?: string | null;
  DateCreated?: string | null;
  AccessCount?: number | null;
  MasterAccessCount?: number | null;
  ActiveLegalHoldCount?: number | null;
  LastAction?: string | null;
  LastActionAt?: string | null;
}

export interface GovernanceAction {
  UaaID?: string | null;
  UaaAction?: string | null;
  UaaStatus?: string | null;
  UaaReason?: string | null;
  RequestedByEmail?: string | null;
  UaaDateCreated?: string | null;
}

export interface LegalHold {
  UlhUUID: string;
  UlhID?: string | null;
  UlhStatus?: number | null;
  UlhReason?: string | null;
  UlhLegalBasis?: string | null;
  UlhReference?: string | null;
  UlhDateCreated?: string | null;
  UlhDateReleased?: string | null;
}

export type GovernanceUserFilters = {
  search: string;
  status: number | null;
};

export type GovernanceUserStatusFilter = '' | 0 | 1;

export const EMPTY_GOVERNANCE_USER_FILTERS: GovernanceUserFilters = {
  search: '',
  status: null,
};
