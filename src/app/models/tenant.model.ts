export interface TenantAccess {
    tenantUUID: string;
    tenantFirstName: string;
    tenantLastName: string;
    tenantEmail: string;
    tenantAvatar: string | null;
    role: 'OWNER' | 'ADMIN' | 'USER';
    userAccessUUID: string;
    status: number;
    dateCreated: string;
}
