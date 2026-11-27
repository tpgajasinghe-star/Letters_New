import type { IncomingMessage, ServerResponse } from 'http';
import * as XLSX from 'xlsx';

export interface CustomerItem {
  itemCode: string;
  description: string;
  qty: string;
}

export interface CustomerApiRecord {
  sno: string;
  date: string;
  customerName: string;
  designation: string;
  companyName: string;
  projectName: string;
  customerAddress: string;
  locationAddress: string; // backwards compatibility alias for customerAddress
  poNumber: string;
  invoiceNumber: string;
  refType: 'PO' | 'Invoice' | '';
  refNumber: string;
  emailSubject: string;
  items: CustomerItem[];
  mailGroupId: string;
  allValues: string;
  searchText: string;
}

interface ApiResponse extends ServerResponse {
  status?: (code: number) => ApiResponse;
  json?: (data: unknown) => ApiResponse;
}

const DEFAULT_DOWNLOAD_URL =
  'https://drive.usercontent.google.com/download?id=1q4SI8H2wTT6rFvDsWXwt8YwWvCIdBRjq&export=download&confirm=t';

function respond(res: ApiResponse, statusCode: number, data: unknown) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const resWithHelpers = res as {
    status?: (code: number) => { json?: (body: unknown) => void };
    json?: (body: unknown) => void;
  };
  if (typeof resWithHelpers.status === 'function') {
    const chain = resWithHelpers.status(statusCode);
    if (chain && typeof chain.json === 'function') {
      return chain.json(data);
    }
  } else if (typeof resWithHelpers.json === 'function') {
    res.statusCode = statusCode;
    return resWithHelpers.json(data);
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function getField(row: Record<string, unknown>, ...candidateKeys: string[]): string {
  for (const key of candidateKeys) {
    if (row[key] !== undefined && row[key] !== null) {
      return String(row[key]).trim();
    }
  }
  const normalizedCandidates = candidateKeys.map((k) =>
    k.toLowerCase().replace(/[^a-z0-9]/g, '')
  );
  for (const [k, v] of Object.entries(row)) {
    const normKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalizedCandidates.includes(normKey) && v !== undefined && v !== null) {
      return String(v).trim();
    }
  }
  return '';
}

/**
 * Parses the Items column string format:
 * `itemCode | description | qty ; itemCode | description | qty`
 * into a structured array: Array<{ itemCode: string; description: string; qty: string }>
 */
export function parseItemsString(rawItems: string): CustomerItem[] {
  if (!rawItems || typeof rawItems !== 'string') return [];
  const trimmed = rawItems.trim();
  if (!trimmed) return [];

  // Split by ';' or newlines
  const segments = trimmed
    .split(/[;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const items: CustomerItem[] = [];

  for (const segment of segments) {
    const parts = segment.split('|').map((p) => p.trim());
    if (parts.length >= 3) {
      items.push({
        itemCode: parts[0] || '',
        description: parts[1] || '',
        qty: parts[2] || '',
      });
    } else if (parts.length === 2) {
      items.push({
        itemCode: parts[0] || '',
        description: parts[1] || '',
        qty: '',
      });
    } else if (parts.length === 1 && parts[0]) {
      items.push({
        itemCode: '',
        description: parts[0],
        qty: '',
      });
    }
  }

  return items;
}

export default async function handler(req: IncomingMessage, res: ApiResponse) {
  // Support GET and HEAD requests
  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    return respond(res, 405, { error: 'Method not allowed' });
  }

  // 1. Read download URL from environment variables (preferring CUSTOMERS_EXCEL_URL)
  const downloadUrl = (
    process.env.CUSTOMERS_EXCEL_URL ||
    process.env['https://drive.usercontent.google.com/download?id=1q4SI8H2wTT6rFvDsWXwt8YwWvCIdBRjq&export=download&confirm=t'] ||
    process.env.CUSTOMER_LIST_URL ||
    process.env.CUSTOMERS_URL ||
    process.env.CUSTOMERS_XLSX_URL ||
    DEFAULT_DOWNLOAD_URL
  )?.trim();

  // If missing or unconfigured, return HTTP 200 with [] to degrade gracefully
  if (!downloadUrl) {
    return respond(res, 200, []);
  }

  try {
    // Append timestamp query parameter to bypass intermediary/CDN caches
    const separator = downloadUrl.includes('?') ? '&' : '?';
    const fetchUrlWithTimestamp = `${downloadUrl}${separator}_t=${Date.now()}`;

    // 2. Fetch the .xlsx file with a browser User-Agent header, no-store cache headers, and follow redirects
    const response = await fetch(fetchUrlWithTimestamp, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Cache-Control': 'no-cache, no-store',
        Pragma: 'no-cache',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return respond(res, 502, {
        error: `Failed to fetch customer workbook: HTTP ${response.status} ${response.statusText}`,
      });
    }

    // 3. Convert to Buffer and verify first 2 bytes are "PK" (valid .xlsx zip header)
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length < 2 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      return respond(res, 502, {
        error: 'Downloaded file is not a valid .xlsx workbook (missing "PK" zip header).',
      });
    }

    // 4. Parse workbook using xlsx: Read "Customers" sheet (or fallback to first sheet)
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames.includes('Customers')
      ? 'Customers'
      : workbook.SheetNames[0];

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return respond(res, 200, []);
    }

    // 5. Convert rows with defval: "" and raw: false
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false,
    });

    // 6. Map all 12 columns for each non-empty row to exact JSON structure
    const records: CustomerApiRecord[] = [];

    for (let rowIndex = 0; rowIndex < rawRows.length; rowIndex++) {
      const row = rawRows[rowIndex];

      // Customer SNo: handle formula (=ROW()-1) or fallback to 1-based index (rowIndex + 1)
      let rawSno = getField(
        row,
        'Customer SNo',
        'Customer Sno',
        'Customer S.No',
        'SNo',
        'S No',
        'S.No',
        'Serial No',
        'sno',
        'No'
      );
      if (!rawSno || rawSno.startsWith('=')) {
        rawSno = String(rowIndex + 1);
      }
      const sno = rawSno.trim();

      const customerName = getField(row, 'Customer Name', 'customerName', 'Customer', 'Contact Person');
      const designation = getField(row, 'Designation', 'designation', 'Title', 'Job Title');
      const companyName = getField(row, 'Company Name', 'companyName', 'Company', 'Client');
      const projectName = getField(row, 'Project Name', 'projectName', 'Project', 'Site');
      const customerAddress = getField(row, 'Customer Address', 'customerAddress', 'Address', 'Location Address', 'locationAddress');
      const poNumber = getField(row, 'PO Number', 'poNumber', 'PO', 'PO No', 'P.O. Number');
      const invoiceNumber = getField(row, 'Invoice Number', 'invoiceNumber', 'Invoice', 'Invoice No', 'Inv No');
      const date = getField(row, 'Date', 'date', 'Issue Date');
      const emailSubject = getField(row, 'Email Subject', 'emailSubject', 'Subject');
      const rawItemsString = getField(row, 'Items', 'items', 'Item List', 'Products', 'Product Items');
      const mailGroupId = getField(row, 'Mail Group ID', 'Mail Group Id', 'mailGroupId', 'MailGroupId', 'Mail Group');

      // Keep only rows where at least one core identifying field is non-empty
      if (
        !customerAddress &&
        !companyName &&
        !projectName &&
        !customerName &&
        !poNumber &&
        !invoiceNumber &&
        !rawItemsString
      ) {
        continue;
      }

      // Parse items string format "itemCode | description | qty ; ..."
      const items = parseItemsString(rawItemsString);

      const refType: 'PO' | 'Invoice' | '' = poNumber ? 'PO' : invoiceNumber ? 'Invoice' : '';
      const refNumber = poNumber || invoiceNumber || '';

      // Combine ALL non-empty cell values from that row into allValues / searchText for searching
      const cellValues: string[] = [];
      if (sno) cellValues.push(sno);

      for (const [key, val] of Object.entries(row)) {
        if (val !== undefined && val !== null) {
          const str = String(val).trim();
          if (str && !str.startsWith('=') && !cellValues.includes(str)) {
            cellValues.push(str);
          }
        }
      }

      // Ensure parsed item pieces are also searchable
      for (const it of items) {
        if (it.itemCode && !cellValues.includes(it.itemCode)) cellValues.push(it.itemCode);
        if (it.description && !cellValues.includes(it.description)) cellValues.push(it.description);
      }

      const allValues = cellValues.join(' ');
      const searchText = allValues;

      records.push({
        sno,
        date,
        customerName,
        designation,
        companyName,
        projectName,
        customerAddress,
        locationAddress: customerAddress, // backward compatibility alias
        poNumber,
        invoiceNumber,
        refType,
        refNumber,
        emailSubject,
        items,
        mailGroupId,
        allValues,
        searchText,
      });
    }

    // 7. Return the array directly as JSON with Cache-Control: no-store
    return respond(res, 200, records);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error while processing customers';
    return respond(res, 500, { error: message });
  }
}
