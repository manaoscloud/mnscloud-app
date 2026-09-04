export interface InviteSession {
  token: string;
  userUUID?: string | null;
  inviteEmail?: string | null;
  roleCode?: string | null;
  roleName?: string | null;
  environmentUUID?: string | null;
  environmentName?: string | null;
  userExists?: number | null;
  userProfileComplete?: number | null;
}
