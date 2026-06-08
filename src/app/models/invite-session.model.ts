export interface InviteSession {
  token: string;
  userUUID?: string | null;
  inviteEmail?: string | null;
  inviteRole?: string | null;
  environmentUUID?: string | null;
  environmentName?: string | null;
  userExists?: number | null;
  userProfileComplete?: number | null;
}
