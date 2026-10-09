import { WarrantyFormData, WarrantyTableRow } from '../types';

export function parseCustomerAddress(rawAddress: string) {
  const lines = rawAddress
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return {
      customerName: 'Mr./Ms. [Customer Name]',
      designation: '[Designation]',
      companyName: '[Company Name]',
      companyAddress: '[Company Address]',
      formattedLines: ['Mr./Ms. [Customer Name]', '[Designation]', '[Company Name]', '[Company Address]'],
    };
  }

  if (lines.length === 1) {
    return {
      customerName: lines[0],
      designation: '',
      companyName: lines[0],
      companyAddress: '',
      formattedLines: lines,
    };
  }

  if (lines.length === 2) {
    return {
      customerName: lines[0],
      designation: '',
      companyName: lines[0],
      companyAddress: lines[1],
      formattedLines: lines,
    };
  }

  if (lines.length === 3) {
    // Check if line 1 has honorific (Mr, Ms, Eng, Dr)
    const hasHonorific = /^(mr|ms|mrs|eng|dr|prof)\.?\s+/i.test(lines[0]);
    if (hasHonorific) {
      return {
        customerName: lines[0],
        designation: lines[1],
        companyName: lines[2],
        companyAddress: lines[2],
        formattedLines: lines,
      };
    } else {
      return {
        customerName: lines[0],
        designation: '',
        companyName: lines[0],
        companyAddress: lines.slice(1).join(', '),
        formattedLines: lines,
      };
    }
  }

  // 4 or more lines
  return {
    customerName: lines[0],
    designation: lines[1],
    companyName: lines[2],
    companyAddress: lines.slice(3).join(', '),
    formattedLines: lines,
  };
}

export function parseItemSupplied(rawItem: string): WarrantyTableRow[] {
  if (!rawItem || !rawItem.trim()) {
    return [
      {
        itemCode: '[Item Code]',
        description: '[Product Description]',
        warrantyPeriod: '[Warranty Period]',
        productBrand: 'Kevilton',
      },
    ];
  }

  const lines = rawItem
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const rows: WarrantyTableRow[] = [];

  for (const line of lines) {
    let itemCode = '';
    let description = line;
    let warrantyPeriod = '1 Year';
    let productBrand = 'Kevilton';

    // Check for warranty period pattern (e.g., "5 Years", "2 Year", "10 Years Warranty", "3-Year")
    const warrantyMatch = line.match(/(\d+\s*(?:year|yr|month|mth)s?(?:\s+warranty)?)/i);
    if (warrantyMatch) {
      warrantyPeriod = warrantyMatch[1].replace(/warranty/i, '').trim();
      if (!/years?|months?/i.test(warrantyPeriod)) {
        warrantyPeriod += ' Year';
      }
      description = description.replace(warrantyMatch[0], '').trim();
    }

    // Check for explicit "Item Code:" or "Code:"
    const codeMatch = line.match(/(?:item\s*code|code|model|part\s*no\.?)\s*[:=-]\s*([a-zA-Z0-9\-_/]+)/i);
    if (codeMatch) {
      itemCode = codeMatch[1].trim();
      description = description.replace(codeMatch[0], '').trim();
    } else {
      // Check for code pattern at start like "KEV-101 -" or "WP-202:" or "KV-MCB-32A"
      const startCodeMatch = description.match(/^([a-zA-Z0-9]{2,10}(?:-[a-zA-Z0-9]+)+)\s*[-:]?\s*(.*)$/);
      if (startCodeMatch) {
        itemCode = startCodeMatch[1].trim();
        description = startCodeMatch[2].trim();
      }
    }

    // Clean up trailing commas, brackets, hyphens
    description = description
      .replace(/^[-–—:\s]+|[-–—:\s]+$/g, '')
      .replace(/^\((.*)\)$/, '$1')
      .replace(/,\s*$/, '')
      .trim();

    // If description is empty, use the line
    if (!description && itemCode) {
      description = itemCode;
    } else if (!description) {
      description = line;
    }

    // If item code wasn't found, generate a clean standardized code or derive from product name
    if (!itemCode) {
      const words = description.split(/\s+/).slice(0, 3);
      const acronym = words.map((w) => w[0]?.toUpperCase()).join('');
      itemCode = `KV-${acronym || 'PRD'}-${Math.floor(100 + Math.random() * 900)}`;
    }

    // Product brand detection
    if (/modular/i.test(description)) {
      productBrand = 'Kevilton Modular Range';
    } else if (/switches|sockets/i.test(description)) {
      productBrand = 'Kevilton Wiring Devices';
    } else if (/mcb|rcbo|isolator|distribution/i.test(description)) {
      productBrand = 'Kevilton Power Distribution';
    } else if (/led|light|lamp/i.test(description)) {
      productBrand = 'Kevilton Luminaires';
    }

    rows.push({
      itemCode,
      description,
      warrantyPeriod: warrantyPeriod.endsWith('s') || warrantyPeriod.endsWith('Year') || warrantyPeriod.endsWith('Month') ? warrantyPeriod : `${warrantyPeriod} Year`,
      productBrand,
    });
  }

  return rows.length > 0 ? rows : [
    {
      itemCode: '[Item Code]',
      description: rawItem.trim(),
      warrantyPeriod: '1 Year',
      productBrand: 'Kevilton',
    },
  ];
}

export function formatDateForCertificate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDate();
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    return `${months[d.getMonth()]} ${day}, ${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

/**
 * Returns the subject title for Common Warranty Certificate without "Subject: " word,
 * with the PO number appended to the end of the subject title.
 */
export function getCommonWarrantySubject(poNumber?: string): string {
  const trimmed = poNumber?.trim();
  if (!trimmed) {
    return 'Warranty Certificate for Kevilton Products Supplied Against PO [PO Number]';
  }
  if (/^against\s+/i.test(trimmed)) {
    return `Warranty Certificate for Kevilton Products Supplied ${trimmed}`;
  }
  if (/^po\b|^po[-:/]/i.test(trimmed)) {
    return `Warranty Certificate for Kevilton Products Supplied Against ${trimmed}`;
  }
  return `Warranty Certificate for Kevilton Products Supplied Against PO ${trimmed}`;
}
