import { CustomerRecord } from './customerSearch';
import { ParsedCustomerDetails } from '../types';

export interface ParseCustomerPayload {
  text?: string;
  files?: Array<{ name: string; mimeType: string; base64: string }>;
  subject?: string;
  bodyText?: string;
  imageBase64?: string;
  imageMimeType?: string;
}

/**
 * Checks if a selected customer record contains raw/unstructured email text,
 * long multi-line prose, or is missing structured fields like companyName or refNumber.
 */
export function isUnstructuredCustomerRecord(record: CustomerRecord): boolean {
  // If email subject is present
  if (record.emailSubject && record.emailSubject.trim().length > 0) {
    return true;
  }

  const addr = record.locationAddress || '';
  // Long address text or newlines often indicates raw pasted email or multiple fields combined
  if (addr.includes('\n') || addr.trim().length > 70) {
    return true;
  }

  // Common email or transactional keywords in address field
  if (
    /(?:dear|regards|warranty|certificate|attached|forwarded|please|ref|invoice|po\b|attention|attn|hi\b|thanks|project)/i.test(
      addr
    )
  ) {
    return true;
  }

  // Missing clean company/project name or missing reference number
  if (!record.companyName?.trim() && !record.projectName?.trim()) {
    return true;
  }

  if (!record.refNumber?.trim() && !record.poNumber?.trim() && !record.invoiceNumber?.trim()) {
    return true;
  }

  return false;
}

/**
 * Sends request to /api/parse-customer serverless endpoint
 */
export async function parseCustomerWithAi(payload: ParseCustomerPayload): Promise<ParsedCustomerDetails> {
  const response = await fetch('/api/parse-customer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorMessage = `HTTP error ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson?.error) {
        errorMessage = errorJson.error;
      }
    } catch {
      // Use fallback status text
    }
    throw new Error(errorMessage);
  }

  const data: ParsedCustomerDetails = await response.json();

  // Ensure formattedAddressBlock is not empty
  if (!data.formattedAddressBlock?.trim()) {
    const lines: string[] = [];
    if (data.customerName?.trim()) lines.push(data.customerName.trim());
    if (data.designation?.trim()) lines.push(data.designation.trim());
    if (data.companyName?.trim()) lines.push(data.companyName.trim());
    if (data.projectName?.trim()) lines.push(data.projectName.trim());
    if (data.locationAddress?.trim()) {
      const addrLines = data.locationAddress
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      lines.push(...addrLines);
    }
    data.formattedAddressBlock = lines.join('\n');
  }

  return data;
}
