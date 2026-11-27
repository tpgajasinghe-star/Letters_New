import type { IncomingMessage, ServerResponse } from 'http';

export interface ParseCustomerFileInput {
  name: string;
  mimeType: string;
  base64: string;
}

export interface ParseCustomerRequestBody {
  text?: string;
  files?: ParseCustomerFileInput[];
  // Backwards compatibility with previous payload:
  subject?: string;
  bodyText?: string;
  imageBase64?: string;
  imageMimeType?: string;
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

export interface ParseCustomerApiResponse {
  orders: ParsedOrder[];
  // Backwards compatibility properties from primary order
  customerName?: string;
  designation?: string;
  companyName?: string;
  projectName?: string;
  customerAddress?: string;
  locationAddress?: string;
  poNumber?: string;
  invoiceNumber?: string;
  date?: string;
  items?: ParsedOrderItem[];
  refType?: 'PO' | 'Invoice' | '';
  refNumber?: string;
  formattedAddressBlock?: string;
}

interface ApiResponse extends ServerResponse {
  status?: (code: number) => ApiResponse;
  json?: (data: unknown) => ApiResponse;
}

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

async function parseRequestBody(req: IncomingMessage): Promise<ParseCustomerRequestBody> {
  const reqAny = req as { body?: unknown };
  if (reqAny.body) {
    if (typeof reqAny.body === 'string') {
      try {
        return JSON.parse(reqAny.body);
      } catch {
        return {};
      }
    }
    if (typeof reqAny.body === 'object' && reqAny.body !== null) {
      return reqAny.body as ParseCustomerRequestBody;
    }
  }

  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8').trim();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => {
      resolve({});
    });
  });
}

const EXTRACTION_INSTRUCTION = `You are an expert AI data extraction assistant for Kevilton Electrical Products (Pvt) Ltd warranty certificate issuance.
Your job is to analyze the provided text and/or attached files (emails, Purchase Orders, Tax Invoices, Delivery Slips, RFQs, PDF documents, or screenshots) and extract warranty customer and order details.

CRITICAL EXTRACTION RULES:
1. SELLER IDENTITY: Kevilton Electrical Products (Pvt) Ltd is the SELLER/SUPPLIER/WARRANTOR. NEVER extract "Kevilton Electrical Products (Pvt) Ltd", "Kevilton", or any Kevilton staff/offices as the customer or buyer!
2. BUYER / CUSTOMER IDENTITY: Extract the EXTERNAL client, buyer, contractor, or project entity purchasing or receiving the products.
3. MULTIPLE ORDERS & MERGING:
   - If multiple distinct Purchase Orders (POs) or Invoices are present, return a separate order object in the "orders" array for each distinct order.
   - If a Purchase Order (PO) and a Tax Invoice share the same PO number (or refer to the same order transaction), MERGE them into ONE single order object.
   - When merging a PO and a Tax Invoice, PREFER the Tax Invoice item codes, descriptions, and quantities.
4. ORDER FIELDS:
   Each order must contain:
   - customerName: Contact person / recipient name (e.g. "Mr. Sunil Perera") or "" if not mentioned.
   - designation: Job title or designation (e.g. "Project Manager", "Senior Electrical Engineer") or "" if not mentioned.
   - companyName: Company, contractor, or firm name (e.g. "SP Lanka Engineering (Pvt) Ltd") or "" if not mentioned.
   - projectName: Specific project name, building, or site location (e.g. "Prime Grand Residencies - Colombo 07") or "" if not mentioned.
   - customerAddress: Multi-line physical/postal address of the customer / site (street, city, etc.). Do NOT include greetings, email sign-offs, or company name if already in companyName.
   - poNumber: Purchase order number (e.g. "PO-2024-9981") or "" if not mentioned.
   - invoiceNumber: Invoice or Tax Invoice number (e.g. "INV-4521") or "" if not mentioned.
   - date: Document date in YYYY-MM-DD or DD/MM/YYYY format or "" if not mentioned.
   - items: Array of ordered/invoiced items, each with:
     - itemCode: Specific item or catalog code (e.g. "KEV-SW-101") or "" if not specified.
     - description: Product description or item name (e.g. "1 Gang 1 Way Switch 10A White").
     - qty: Quantity ordered or invoiced (e.g. "50", "100 Nos") or "".

OUTPUT FORMAT:
Return ONLY a valid JSON object matching this schema:
{
  "orders": [
    {
      "customerName": string,
      "designation": string,
      "companyName": string,
      "projectName": string,
      "customerAddress": string,
      "poNumber": string,
      "invoiceNumber": string,
      "date": string,
      "items": [
        {
          "itemCode": string,
          "description": string,
          "qty": string
        }
      ]
    }
  ]
}`;

/**
 * Executes fetch to Gemini REST API with 1 automatic retry after 2 seconds for 503 or 429
 */
async function callGeminiWithRetry(url: string, payload: unknown): Promise<Response> {
  let response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  // Handle 503 (Service Unavailable) or 429 (Too Many Requests) with 1 automatic retry after 2 seconds
  if (response.status === 503 || response.status === 429) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }

  return response;
}

export default async function handler(req: IncomingMessage, res: ApiResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return respond(res, 204, null);
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return respond(res, 405, { error: 'Method not allowed. Use POST.' });
  }

  // 1. Read process.env.GEMINI_API_KEY
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return respond(res, 500, { error: 'GEMINI_API_KEY is not configured' });
  }

  // 2. Resolve model name: defaults to gemini-3.8-flash as requested
  const model = (process.env.GEMINI_MODEL || 'gemini-3.8-flash').trim();

  try {
    // 3. Parse input body supporting both text & files and legacy payload
    const body = await parseRequestBody(req);

    // Resolve text
    let text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) {
      const sub = typeof body.subject === 'string' ? body.subject.trim() : '';
      const bText = typeof body.bodyText === 'string' ? body.bodyText.trim() : '';
      if (sub && bText) text = `Subject: ${sub}\n\n${bText}`;
      else if (sub) text = `Subject: ${sub}`;
      else if (bText) text = bText;
    }

    // Resolve files (supporting plain text, images PNG/JPEG/WEBP, and PDF files)
    const files: ParseCustomerFileInput[] = [];
    if (Array.isArray(body.files)) {
      for (const f of body.files) {
        if (f && typeof f.base64 === 'string' && f.base64.trim()) {
          files.push({
            name: typeof f.name === 'string' ? f.name : 'file',
            mimeType: typeof f.mimeType === 'string' && f.mimeType ? f.mimeType.trim() : 'application/pdf',
            base64: f.base64.replace(/^data:[^;]+;base64,/, '').trim(),
          });
        }
      }
    } else if (body.imageBase64 && typeof body.imageBase64 === 'string') {
      files.push({
        name: 'image.png',
        mimeType: typeof body.imageMimeType === 'string' && body.imageMimeType ? body.imageMimeType.trim() : 'image/png',
        base64: body.imageBase64.replace(/^data:[^;]+;base64,/, '').trim(),
      });
    }

    if (!text && files.length === 0) {
      return respond(res, 400, {
        error: 'Please provide text or files to parse.',
      });
    }

    // 4. Build Gemini parts
    const parts: Array<Record<string, unknown>> = [
      { text: EXTRACTION_INSTRUCTION },
    ];

    if (text) {
      parts.push({
        text: `Input Document / Email Text:\n${text}`,
      });
    }

    for (const file of files) {
      parts.push({
        inline_data: {
          mime_type: file.mimeType,
          data: file.base64,
        },
      });
    }

    // 5. Call Gemini REST API using model gemini-3.8-flash with retry
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const geminiPayload = {
      contents: [
        {
          role: 'user',
          parts,
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    };

    const response = await callGeminiWithRetry(url, geminiPayload);

    if (!response.ok) {
      let errDetails = `HTTP ${response.status} ${response.statusText}`;
      try {
        const errJson = await response.json();
        if (errJson?.error?.message) {
          errDetails = errJson.error.message;
        }
      } catch {
        // fallback to status text
      }
      return respond(res, response.status >= 400 && response.status < 600 ? response.status : 500, {
        error: `Gemini API error: ${errDetails}`,
      });
    }

    const geminiResponse = await response.json();
    const candidateText =
      geminiResponse?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!candidateText) {
      return respond(res, 500, {
        error: 'No response content returned by Gemini.',
      });
    }

    // 6. Safe JSON parse, stripping markdown fences if present
    let cleanedJsonText = candidateText.trim();
    if (cleanedJsonText.startsWith('```json')) {
      cleanedJsonText = cleanedJsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedJsonText.startsWith('```')) {
      cleanedJsonText = cleanedJsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(cleanedJsonText);
    } catch {
      return respond(res, 500, {
        error: 'Failed to parse JSON response from Gemini.',
        raw: candidateText,
      });
    }

    // 7. Normalize parsed orders array
    let rawOrders: unknown[] = [];
    if (Array.isArray(parsed.orders)) {
      rawOrders = parsed.orders;
    } else if (Array.isArray(parsed)) {
      rawOrders = parsed;
    } else if (parsed && typeof parsed === 'object') {
      rawOrders = [parsed];
    }

    const normalizedOrders: ParsedOrder[] = rawOrders.map((rawOrder: any) => {
      const customerName = typeof rawOrder?.customerName === 'string' ? rawOrder.customerName.trim() : '';
      const designation = typeof rawOrder?.designation === 'string' ? rawOrder.designation.trim() : '';
      const companyName = typeof rawOrder?.companyName === 'string' ? rawOrder.companyName.trim() : '';
      const projectName = typeof rawOrder?.projectName === 'string' ? rawOrder.projectName.trim() : '';
      const customerAddress = typeof rawOrder?.customerAddress === 'string'
        ? rawOrder.customerAddress.trim()
        : (typeof rawOrder?.locationAddress === 'string' ? rawOrder.locationAddress.trim() : '');
      const poNumber = typeof rawOrder?.poNumber === 'string' ? rawOrder.poNumber.trim() : '';
      const invoiceNumber = typeof rawOrder?.invoiceNumber === 'string' ? rawOrder.invoiceNumber.trim() : '';
      const date = typeof rawOrder?.date === 'string' ? rawOrder.date.trim() : '';

      const rawItems = Array.isArray(rawOrder?.items) ? rawOrder.items : [];
      const items: ParsedOrderItem[] = rawItems.map((item: any) => ({
        itemCode: typeof item?.itemCode === 'string' ? item.itemCode.trim() : '',
        description: typeof item?.description === 'string' ? item.description.trim() : '',
        qty: typeof item?.qty === 'string' ? item.qty.trim() : (item?.qty != null ? String(item.qty).trim() : ''),
      }));

      return {
        customerName,
        designation,
        companyName,
        projectName,
        customerAddress,
        poNumber,
        invoiceNumber,
        date,
        items,
      };
    });

    // 8. Construct response with orders array and backwards-compatible primary order fields
    const primaryOrder = normalizedOrders[0] || {
      customerName: '',
      designation: '',
      companyName: '',
      projectName: '',
      customerAddress: '',
      poNumber: '',
      invoiceNumber: '',
      date: '',
      items: [],
    };

    const blockLines: string[] = [];
    if (primaryOrder.customerName) blockLines.push(primaryOrder.customerName);
    if (primaryOrder.designation) blockLines.push(primaryOrder.designation);
    if (primaryOrder.companyName) blockLines.push(primaryOrder.companyName);
    if (primaryOrder.projectName) blockLines.push(primaryOrder.projectName);
    if (primaryOrder.customerAddress) {
      const addrLines = primaryOrder.customerAddress
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      blockLines.push(...addrLines);
    }
    const formattedAddressBlock = blockLines.join('\n');

    const refType: 'PO' | 'Invoice' | '' = primaryOrder.poNumber
      ? 'PO'
      : (primaryOrder.invoiceNumber ? 'Invoice' : '');
    const refNumber = primaryOrder.poNumber || primaryOrder.invoiceNumber || '';

    const responsePayload: ParseCustomerApiResponse = {
      orders: normalizedOrders,
      customerName: primaryOrder.customerName,
      designation: primaryOrder.designation,
      companyName: primaryOrder.companyName,
      projectName: primaryOrder.projectName,
      customerAddress: primaryOrder.customerAddress,
      locationAddress: primaryOrder.customerAddress,
      poNumber: primaryOrder.poNumber,
      invoiceNumber: primaryOrder.invoiceNumber,
      date: primaryOrder.date,
      items: primaryOrder.items,
      refType,
      refNumber,
      formattedAddressBlock,
    };

    return respond(res, 200, responsePayload);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error during customer parsing';
    return respond(res, 500, { error: message });
  }
}
