import type { IncomingMessage, ServerResponse } from 'http';

export interface ParseCustomerRequestBody {
  subject?: string;
  bodyText?: string;
  imageBase64?: string;
  imageMimeType?: string;
}

export interface ParsedCustomerDetails {
  customerName: string;
  designation: string;
  companyName: string;
  projectName: string;
  locationAddress: string;
  poNumber: string;
  invoiceNumber: string;
  refType: 'PO' | 'Invoice' | '';
  refNumber: string;
  formattedAddressBlock: string;
}

interface ApiResponse extends ServerResponse {
  status?: (code: number) => ApiResponse;
  json?: (data: unknown) => ApiResponse;
}

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

async function parseRequestBody(req: IncomingMessage): Promise<ParseCustomerRequestBody> {
  // If req.body is already parsed (e.g. by Vercel serverless runtime or body-parser middleware)
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

  // Otherwise, buffer stream chunks from IncomingMessage
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

const EXTRACTION_INSTRUCTION = `You are an expert AI data extraction assistant for Kevilton Electrical Products warranty certificate issuance.
Your job is to analyze the provided email subject, email body, and/or attached screenshot (which may be an email thread, purchase order, quotation request, RFQ, or delivery slip) and extract warranty letter recipient details regardless of where they appear.

EXTRACTION GUIDELINES:
- Identify the external client, contractor, company, buyer, or project receiving the warranty.
- Focus strictly on the entity receiving the warranty.
- IGNORE greetings, sign-offs, sender's own signature/phone/disclaimers, Kevilton sales rep signatures, and unrelated replies.
- Extract the following fields:
  1. customerName: Contact person or customer name (e.g. "Mr. Sunil Perera", "Eng. Samantha Silva", "Kamal Fernando") or "" if not mentioned.
  2. designation: Job title or designation of the contact person (e.g. "Project Manager", "Senior Electrical Engineer", "Director", "Procurement Manager") or "" if not mentioned.
  3. companyName: The name of the company, contractor, or client purchasing or receiving the warranty (e.g. "SP Lanka Engineering (Pvt) Ltd", "Maga Engineering (Pvt) Ltd") or "" if not mentioned.
  4. projectName: Specific project name or site location if mentioned (e.g. "Prime Grand Residencies - Colombo 07", "Luxury Villa Project - Wadduwa") or "" if not mentioned.
  5. locationAddress: Physical or postal address of the recipient company/site/customer (street, city, etc.) or "" if not mentioned. Do NOT include person name or company name in locationAddress if they belong in their respective fields.
  6. poNumber: Purchase order number if mentioned (e.g. "PO-2024-9981", "SPL/PO/882", "PO#45019") or "" if not mentioned.
  7. invoiceNumber: Invoice number if mentioned (e.g. "INV-4521", "2024-1102") or "" if not mentioned.
  8. refType: "PO" if a purchase order number is identified; "Invoice" if an invoice number is identified (and no PO); otherwise "".
  9. refNumber: The identified reference number (poNumber if present, else invoiceNumber, else "").
  10. formattedAddressBlock: Formatted multi-line address block as it would be printed in the recipient block of an official warranty certificate, in this standard order:
      Line 1: Customer Name (with title if available)
      Line 2: Designation (if available)
      Line 3: Company Name (if available)
      Line 4: Project Name (if available)
      Line 5+: Location Address lines (each on its own line if multi-line)
      Do not include empty lines.

OUTPUT FORMAT:
Return a single JSON object with these exact keys:
{
  "customerName": string,
  "designation": string,
  "companyName": string,
  "projectName": string,
  "locationAddress": string,
  "poNumber": string,
  "invoiceNumber": string,
  "refType": "PO" | "Invoice" | "",
  "refNumber": string,
  "formattedAddressBlock": string
}`;

export default async function handler(req: IncomingMessage, res: ApiResponse) {
  // Handle CORS preflight if called cross-origin
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

  // 2. Resolve model name
  const model = (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();

  try {
    // 3. Parse input body
    const body = await parseRequestBody(req);
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const bodyText = typeof body.bodyText === 'string' ? body.bodyText.trim() : '';
    const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : '';
    const imageMimeType = typeof body.imageMimeType === 'string' && body.imageMimeType.trim()
      ? body.imageMimeType.trim()
      : 'image/png';

    if (!subject && !bodyText && !imageBase64) {
      return respond(res, 400, {
        error: 'Please provide email text (subject/body) or an image to extract customer details.',
      });
    }

    // 4. Build parts
    const parts: Array<Record<string, unknown>> = [
      { text: EXTRACTION_INSTRUCTION },
    ];

    let emailTextContent = '';
    if (subject) {
      emailTextContent += `Email Subject: ${subject}\n\n`;
    }
    if (bodyText) {
      emailTextContent += `Email Body / Unstructured Text:\n${bodyText}\n\n`;
    }
    if (emailTextContent) {
      parts.push({ text: emailTextContent.trim() });
    }

    if (imageBase64) {
      // Strip any data:...;base64, prefix
      const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '').trim();
      parts.push({
        inline_data: {
          mime_type: imageMimeType,
          data: cleanBase64,
        },
      });
    }

    // 5. Call Gemini REST API using native fetch
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

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(geminiPayload),
    });

    if (!response.ok) {
      let errDetails = `HTTP ${response.status} ${response.statusText}`;
      try {
        const errJson = await response.json();
        if (errJson?.error?.message) {
          errDetails = errJson.error.message;
        }
      } catch {
        // use status text
      }
      return respond(res, 500, { error: `Gemini API error: ${errDetails}` });
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

    // 7. Normalize fields according to expected schema
    const customerName = typeof parsed.customerName === 'string' ? parsed.customerName.trim() : '';
    const designation = typeof parsed.designation === 'string' ? parsed.designation.trim() : '';
    const companyName = typeof parsed.companyName === 'string' ? parsed.companyName.trim() : '';
    const projectName = typeof parsed.projectName === 'string' ? parsed.projectName.trim() : '';
    const locationAddress = typeof parsed.locationAddress === 'string' ? parsed.locationAddress.trim() : '';
    const poNumber = typeof parsed.poNumber === 'string' ? parsed.poNumber.trim() : '';
    const invoiceNumber = typeof parsed.invoiceNumber === 'string' ? parsed.invoiceNumber.trim() : '';

    let refType: 'PO' | 'Invoice' | '' = '';
    if (parsed.refType === 'PO' || parsed.refType === 'Invoice') {
      refType = parsed.refType;
    } else if (poNumber) {
      refType = 'PO';
    } else if (invoiceNumber) {
      refType = 'Invoice';
    }

    const refNumber =
      typeof parsed.refNumber === 'string' && parsed.refNumber.trim()
        ? parsed.refNumber.trim()
        : poNumber || invoiceNumber || '';

    let formattedAddressBlock =
      typeof parsed.formattedAddressBlock === 'string'
        ? parsed.formattedAddressBlock.trim()
        : '';

    // Compute fallback formattedAddressBlock if empty
    if (!formattedAddressBlock) {
      const blockLines: string[] = [];
      if (customerName) blockLines.push(customerName);
      if (designation) blockLines.push(designation);
      if (companyName) blockLines.push(companyName);
      if (projectName) blockLines.push(projectName);
      if (locationAddress) {
        const addrLines = locationAddress
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);
        blockLines.push(...addrLines);
      }
      formattedAddressBlock = blockLines.join('\n');
    }

    const result: ParsedCustomerDetails = {
      customerName,
      designation,
      companyName,
      projectName,
      locationAddress,
      poNumber,
      invoiceNumber,
      refType,
      refNumber,
      formattedAddressBlock,
    };

    return respond(res, 200, result);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Unknown error during customer parsing';
    return respond(res, 500, { error: message });
  }
}
