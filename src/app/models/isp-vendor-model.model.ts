export type IspVendorModel = {
  VendorModelUUID: string;
  VendorUUID: string;
  VendorName?: string | null;
  VendorModelName: string;
  VendorModelType: 'OLT' | 'ONU' | 'NAS' | 'CPE' | 'OPTICAL_CABLE' | 'UTP_CABLE' | 'SPLITTER';
  VendorModelNotes?: string | null;
  VendorModelStatus: number;
  VendorModelDateCreated?: string | null;
  VendorModelDateUpdated?: string | null;
};
