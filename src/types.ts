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

  // Order quantity & catalog match indicator
  qty?: string;
  isUnmatched?: boolean;

  // Backward compatibility
  productType?: string;
}

export interface LetterWordingOverrides {
  dateDisplay?: string;
  salutation?: string;
  subject?: string;
  introParagraph1?: string;
  introParagraph2?: string;
  itemsHeader?: string;
  noteContent?: string;
  bodyParagraphs?: string[];
  thankYou?: string;
  closing?: string;
  closingCompany?: string;
  signatureLine?: string;
  signatoryTitle?: string;
  signatoryCompany?: string;
}

export type ReferenceTypeOption = 'projectName' | 'companyName' | 'customerName';
export type PoInvoiceTypeOption = 'PO' | 'Invoice';
export type NoteOption = 'withoutNote' | 'withNote';

export interface WarrantyFormData {
  letterType: WarrantyLetterType;
  date: string;
  customerAddress: string;
  poNumber?: string;

  // New features
  referenceType?: ReferenceTypeOption;
  referenceName?: string;
  poInvoiceType?: PoInvoiceTypeOption;
  noteOption?: NoteOption;
  noteContent?: string;

  // Structured product rows
  items: ProductItemRow[];

  // Optional inline Live Edit Mode overrides for letter template wording
  wordingOverrides?: LetterWordingOverrides;

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

export interface ParsedOrderItem {
  itemCode: string;
  description: string;
  qty: string;
}

export interface ParsedOrder {
  customerName: string;
  designation: string;
  companyName: string;
  projectName: string;
  customerAddress: string;
  poNumber: string;
  invoiceNumber: string;
  date: string;
  items: ParsedOrderItem[];
}

export interface ParsedCustomerDetails {
  customerName: string;
  designation: string;
  companyName: string;
  projectName: string;
  locationAddress: string;
  customerAddress?: string;
  poNumber: string;
  invoiceNumber: string;
  refType: 'PO' | 'Invoice' | '';
  refNumber: string;
  formattedAddressBlock: string;
  date?: string;
  items?: ParsedOrderItem[];
  orders?: ParsedOrder[];
}


