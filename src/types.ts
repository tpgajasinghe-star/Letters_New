export type WarrantyLetterType = 'declaration' | 'po_certificate';

export interface ProductItemRow {
  // For Template 1 (Common Draft Warranty Certificate):
  itemCode?: string;
  description?: string; // Product description
  warrantyPeriod?: string; // e.g. "5 Years"

  // For Template 2 (Common Warranty Certificate):
  productType?: string; // e.g. "Distribution Board", "MCB", "Switches"
  productBrand?: string; // e.g. "Kevilton"
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
