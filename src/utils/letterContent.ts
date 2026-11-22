import { LetterWordingOverrides, WarrantyFormData, WarrantyTableRow } from '../types';
import { formatDateForCertificate, parseCustomerAddress, getCommonWarrantySubject } from './templateParser';

export interface StyledSpan {
  text: string;
  bold?: boolean;
}

export interface ResolvedLetterContent {
  isPoCertificate: boolean;
  dateText: string;
  addressLines: string[];
  companyName: string;
  poNumberText: string;
  salutation: string;
  subject: string;
  introParagraph1: string;
  introParagraph2: string;
  itemsHeader: string;
  bodyParagraphs: string[];
  thankYou: string;
  closing: string;
  closingCompany: string;
  signatureLine: string;
  signatoryTitle: string;
  signatoryCompany: string;
}

export const KEVILTON_COMPANY_NAME = 'Kevilton Electrical Products (Pvt.) Ltd.';

/**
 * Checks whether any template wording field (subject, salutation, body paragraphs, closing, signatory)
 * has been customized in Live Edit Mode.
 */
export function hasCustomWording(overrides?: LetterWordingOverrides): boolean {
  if (!overrides) return false;
  if (
    overrides.salutation !== undefined ||
    overrides.subject !== undefined ||
    overrides.introParagraph1 !== undefined ||
    overrides.introParagraph2 !== undefined ||
    overrides.itemsHeader !== undefined ||
    overrides.thankYou !== undefined ||
    overrides.closing !== undefined ||
    overrides.closingCompany !== undefined ||
    overrides.signatureLine !== undefined ||
    overrides.signatoryTitle !== undefined ||
    overrides.signatoryCompany !== undefined
  ) {
    return true;
  }
  if (Array.isArray(overrides.bodyParagraphs) && overrides.bodyParagraphs.some((p) => p !== undefined)) {
    return true;
  }
  return false;
}

/**
 * Attempts to parse an inline-edited human date string (e.g. "September 30, 2026" or "2026-09-30")
 * into an ISO YYYY-MM-DD string for syncing back to the form's <input type="date">.
 */
export function parseEditedDateToIso(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d) {
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    return null;
  }

  // Require an explicit 4-digit year and a month name to avoid accidental partial parses
  if (!/\b\d{4}\b/.test(trimmed) || !/[a-zA-Z]{3,}/.test(trimmed)) {
    return null;
  }

  // Only accept clean calendar strings without ordinal suffixes ("30th") so custom formatting is preserved
  if (/\b\d+(?:st|nd|rd|th)\b/i.test(trimmed)) {
    return null;
  }

  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) return null;

  const year = parsed.getFullYear();
  if (year < 1900 || year > 2100) return null;

  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Splits a plain string into styled spans, bolding exact occurrences of specified phrases
 * (e.g., "Kevilton Electrical Products (Pvt.) Ltd.", "Note:", company name, PO number).
 */
export function splitStyledSpans(text: string, boldTerms: string[]): StyledSpan[] {
  const cleanTerms = Array.from(new Set(boldTerms.filter((t) => t && t.trim().length > 0)));
  if (!text || cleanTerms.length === 0) {
    return [{ text }];
  }

  // Sort longest first so overlapping phrases match cleanly
  cleanTerms.sort((a, b) => b.length - a.length);
  const escaped = cleanTerms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'g');

  const parts = text.split(regex);
  const spans: StyledSpan[] = [];
  for (const part of parts) {
    if (!part) continue;
    const isBold = cleanTerms.includes(part);
    spans.push(isBold ? { text: part, bold: true } : { text: part });
  }
  return spans.length > 0 ? spans : [{ text }];
}

/**
 * Computes default letter text merged with any Live Edit Mode wording overrides.
 * Used identically across Live Preview, PDF export, and Word (.docx) export.
 */
export function resolveLetterContent(
  formData: WarrantyFormData,
  rows: WarrantyTableRow[],
  brandSubject: string
): ResolvedLetterContent {
  const isPoCertificate = formData.letterType === 'po_certificate';
  const parsedAddr = parseCustomerAddress(formData.customerAddress);
  const overrides = formData.wordingOverrides;

  const defaultFormattedDate = formatDateForCertificate(formData.date);
  const dateText = overrides?.dateDisplay !== undefined ? overrides.dateDisplay : defaultFormattedDate;

  const companyName = parsedAddr.companyName || '[Company Name]';
  const poNumberText = formData.poNumber?.trim() || '[PO Number]';

  if (isPoCertificate) {
    const defaultBodyParagraphs = [
      'Note: The above warranty covers manufacturing defects under normal installation and operating conditions from the date of purchase.',
      'This warranty does not cover defects or damage resulting from improper installation, misuse, accidents, unauthorized modifications, negligence, or external causes. Proof of purchase and relevant product identification details are required for any warranty claim.',
      'Should you require any further information regarding this warranty, please do not hesitate to contact us.',
    ];

    const bodyParagraphs = defaultBodyParagraphs.map((def, idx) =>
      overrides?.bodyParagraphs?.[idx] !== undefined ? overrides.bodyParagraphs[idx] : def
    );

    return {
      isPoCertificate: true,
      dateText,
      addressLines: parsedAddr.formattedLines,
      companyName,
      poNumberText,
      salutation: overrides?.salutation !== undefined ? overrides.salutation : 'Dear Sir/Madam,',
      subject:
        overrides?.subject !== undefined
          ? overrides.subject
          : getCommonWarrantySubject(formData.poNumber),
      introParagraph1:
        overrides?.introParagraph1 !== undefined
          ? overrides.introParagraph1
          : `We, ${KEVILTON_COMPANY_NAME}, sincerely appreciate the trust you have placed in our products. We are committed to providing high-quality products that comply with national and international standards.`,
      introParagraph2:
        overrides?.introParagraph2 !== undefined
          ? overrides.introParagraph2
          : `We hereby confirm that the following products supplied against Purchase Order No. ${poNumberText} are covered under the Kevilton warranty program.`,
      itemsHeader:
        overrides?.itemsHeader !== undefined
          ? overrides.itemsHeader
          : 'Items Covered Under This Warranty:',
      bodyParagraphs,
      thankYou: overrides?.thankYou !== undefined ? overrides.thankYou : 'Thank you.',
      closing: overrides?.closing !== undefined ? overrides.closing : 'Yours faithfully,',
      closingCompany: '',
      signatureLine: overrides?.signatureLine !== undefined ? overrides.signatureLine : '……………………..',
      signatoryTitle:
        overrides?.signatoryTitle !== undefined
          ? overrides.signatoryTitle
          : 'Manager – Quality Assurance',
      signatoryCompany:
        overrides?.signatoryCompany !== undefined
          ? overrides.signatoryCompany
          : KEVILTON_COMPANY_NAME,
    };
  }

  // Template 1: Common Draft Warranty Certificate (Declaration)
  const defaultBodyParagraphs = [
    'The above warranty covers manufacturing defects arising under normal installation and operating conditions from the date of delivery.',
    `During the warranty period, ${KEVILTON_COMPANY_NAME} will, at its discretion, repair or replace any product found to be defective due to manufacturing faults.`,
    'This warranty does not cover defects or damage resulting from improper installation, misuse, accidents, unauthorized modification, negligence, incorrect handling, external causes, or normal wear and tear. Proof of purchase and relevant product identification details may be required for any warranty claim.',
    `The decision of ${KEVILTON_COMPANY_NAME} shall be final regarding any warranty claim or dispute that may arise. This letter is issued upon request as a warranty reference for the above-mentioned product.`,
    'Should you require any further information regarding this warranty, please do not hesitate to contact us.',
  ];

  const bodyParagraphs = defaultBodyParagraphs.map((def, idx) =>
    overrides?.bodyParagraphs?.[idx] !== undefined ? overrides.bodyParagraphs[idx] : def
  );

  return {
    isPoCertificate: false,
    dateText,
    addressLines: parsedAddr.formattedLines,
    companyName,
    poNumberText,
    salutation: overrides?.salutation !== undefined ? overrides.salutation : 'Dear Sir/Madam,',
    subject:
      overrides?.subject !== undefined
        ? overrides.subject
        : `Warranty Declaration for ${brandSubject}`,
    introParagraph1:
      overrides?.introParagraph1 !== undefined
        ? overrides.introParagraph1
        : `With reference to the product supplied to ${companyName}, we hereby confirm that ${KEVILTON_COMPANY_NAME} provides the following warranty for the product detailed below:`,
    introParagraph2: '',
    itemsHeader: '',
    bodyParagraphs,
    thankYou: overrides?.thankYou !== undefined ? overrides.thankYou : 'Thank you.',
    closing: overrides?.closing !== undefined ? overrides.closing : 'Yours Faithfully,',
    closingCompany:
      overrides?.closingCompany !== undefined ? overrides.closingCompany : KEVILTON_COMPANY_NAME,
    signatureLine:
      overrides?.signatureLine !== undefined
        ? overrides.signatureLine
        : '.............................................',
    signatoryTitle:
      overrides?.signatoryTitle !== undefined
        ? overrides.signatoryTitle
        : 'Manager – Quality Assurance',
    signatoryCompany:
      overrides?.signatoryCompany !== undefined
        ? overrides.signatoryCompany
        : KEVILTON_COMPANY_NAME,
  };
}
