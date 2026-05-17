export interface UserProfile {
    userUUID: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    dateBirth: string | null;
    avatarUrl?: string | null;
    status: number;
    dateCreated: string;
}
