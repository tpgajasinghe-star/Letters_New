export const PRODUCT_BRAND_OPTIONS = [
  'Wiring Devices',
  'Circuit Protection Devices',
  'Lightings',
  'Wiring Accessories',
  'PVC Products',
  'Power Fix',
  'Appliances',
] as const;

export type ProductBrandOption = (typeof PRODUCT_BRAND_OPTIONS)[number];

export type WarrantyLetterType = 'declaration' | 'po_certificate';

export interface ProductItemRow {
  // Column 1: Product Description (can enter I Code & Item Description)
  itemCode?: string; // I code / Item Code (e.g. "KEV-SW-101")
  description?: string; // Item Description (e.g. "1 Gang 1 Way Switch 10A White")

  // Column 2: Product Brand (shows Product Family / Brand)
  productBrand?: string; // Product Brand (e.g. "Kevilton")
  productFamily?: string; // Product Family

  // Column 3: Warranty Period
  warrantyPeriod?: string; // e.g. "5 Years"

  // Backward compatibility
  productType?: string;
}

export interface WarrantyFormData {
  letterType: WarrantyLetterType;
  date: string;
  customerAddress: string;
  poNumber?: string;

  // Structured product rows
  items: ProductItemRow[];

  // Backward compatibility fields
  itemSupplied?: string;
  templateType?: 'declaration' | 'po_certificate';
  certificateKind?: 'draft' | 'official';
}

export interface WarrantyTableRow {
  itemCode: string;
  description: string;
  warrantyPeriod: string;
  productBrand?: string;
  productType?: string;
}
