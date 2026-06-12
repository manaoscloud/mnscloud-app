export type AccountAction = 'suspend' | 'close' | 'anonymize' | 'legal-hold' | 'release-hold';

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
