import type { IncomingMessage, ServerResponse } from 'http';
import * as XLSX from 'xlsx';

export interface CustomerApiRecord {
  sno: string;
  date: string;
  customerName: string;
  companyName: string;
  projectName: string;
  locationAddress: string;
  poNumber: string;
  invoiceNumber: string;
  refType: 'PO' | 'Invoice' | '';
  refNumber: string;
  emailSubject: string;
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
  res.setHeader('Cache-Control', 'no-store');
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

export default async function handler(req: IncomingMessage, res: ApiResponse) {
  // Support GET and HEAD requests
  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    return respond(res, 405, { error: 'Method not allowed' });
  }

  // 1. Read download URL from environment variables or fallback
  const downloadUrl = (
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
    // 2. Fetch the .xlsx file with a browser User-Agent header and follow redirects
    const response = await fetch(downloadUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
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

    // 6. Map each non-empty row to exact JSON structure expected by the frontend
    const records: CustomerApiRecord[] = [];

    for (let rowIndex = 0; rowIndex < rawRows.length; rowIndex++) {
      const row = rawRows[rowIndex];

      const customerName = getField(row, 'Customer Name', 'customerName', 'Customer');
      const companyName = getField(row, 'Company Name', 'companyName', 'Company');
      const projectName = getField(row, 'Project Name', 'projectName', 'Project');
      const locationAddress = getField(row, 'Customer Address', 'locationAddress', 'Address');

      // Keep only rows where at least one of Customer Address, Company Name, Project Name, or Customer Name is non-empty
      if (!locationAddress && !companyName && !projectName && !customerName) {
        continue;
      }

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

      const date = getField(row, 'Date', 'date');
      const poNumber = getField(row, 'PO Number', 'poNumber', 'PO');
      const invoiceNumber = getField(row, 'Invoice Number', 'invoiceNumber', 'Invoice');
      const emailSubject = getField(row, 'Email Subject', 'emailSubject', 'Subject');

      const refType: 'PO' | 'Invoice' | '' = poNumber ? 'PO' : invoiceNumber ? 'Invoice' : '';
      const refNumber = poNumber || invoiceNumber || '';

      // Combine ALL non-empty cell values from that row into allValues / searchText
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

      const allValues = cellValues.join(' ');
      const searchText = allValues;

      records.push({
        sno,
        date,
        customerName,
        companyName,
        projectName,
        locationAddress,
        poNumber,
        invoiceNumber,
        refType,
        refNumber,
        emailSubject,
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
