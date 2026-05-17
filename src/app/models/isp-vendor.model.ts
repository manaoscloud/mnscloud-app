export type IspVendor = {
  VendorUUID: string;
  VendorName: string;
  SupplierUUID?: string | null;
  SupplierName?: string | null;
  VendorWebsite?: string | null;
  VendorSupportEmail?: string | null;
  VendorSupportPhone?: string | null;
  VendorNotes?: string | null;
  VendorStatus: number;
  VendorDateCreated?: string | null;
  VendorDateUpdated?: string | null;
};
