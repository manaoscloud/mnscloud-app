export interface InviteValidateData {
  InviteEmail: string;
  RoleCode: string;
  RoleName: string;
  EnvironmentUUID: string;
  EnvironmentName: string;
  token: string;
  UserUUID?: string | null;
  UserExists?: number;
  UserProfileComplete?: number;
}
