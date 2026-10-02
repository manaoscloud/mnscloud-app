export interface UserProfile {
  userUUID: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  dateBirth: string | null;
  avatarUrl?: string | null;
  /** Billing data: payer of individual wallet top-ups. */
  document: string;
  addressZip: string;
  addressStreet: string;
  addressNumber: string;
  addressComplement: string;
  addressDistrict: string;
  addressCity: string;
  addressState: string;
  status: number;
  dateCreated: string;
}
