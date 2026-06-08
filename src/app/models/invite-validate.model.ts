export interface InviteValidateData {
  InviteEmail: string;
  InviteRole: string;
  EnvironmentUUID: string;
  EnvironmentName: string;
  token: string;
  UserUUID?: string | null;
  UserExists?: number;
  UserProfileComplete?: number;
}
