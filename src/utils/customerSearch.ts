export interface CustomerRecordItem {
  itemCode: string;
  description: string;
  qty: string;
}

export interface CustomerRecord {
  sno?: string;
  date?: string;
  customerName?: string;
  designation?: string;
  companyName?: string;
  projectName?: string;
  customerAddress?: string;
  locationAddress: string;
  poNumber?: string;
  invoiceNumber?: string;
  refType?: 'PO' | 'Invoice' | '';
  refNumber?: string;
  emailSubject?: string;
  items?: CustomerRecordItem[];
  mailGroupId?: string;
  allValues?: string;
  searchText?: string;
}

export interface IndexedCustomerRecord {
  record: CustomerRecord;
  orders: CustomerRecord[];
  mailGroupId?: string;
  orderCount: number;
  sno: string;
  snoNormalized: string;
  dateStr: string;
  customerNameLower: string;
  companyNameLower: string;
  projectLower: string;
  addressLower: string;
  poNumberLower: string;
  invoiceNumberLower: string;
  refNumberLower: string;
  emailSubjectLower: string;
  primaryName: string;
  combinedSearchText: string;
  fieldValuesLower: string[];
  wordsLower: string[];
}

let cachedCustomers: IndexedCustomerRecord[] | null = null;
let customersFetchPromise: Promise<IndexedCustomerRecord[]> | null = null;

export function getCachedCustomers(): IndexedCustomerRecord[] {
  return cachedCustomers || [];
}

/**
 * Trigger condition:
 * Show the suggestion dropdown immediately starting from 1 character across all columns
 * (e.g. 's', 'c', '1', '#1', etc.).
 */
export function shouldTriggerCustomerSearch(rawQuery: string): boolean {
  return rawQuery.trim().length >= 1;
}

export function refreshCustomerRecords(): Promise<IndexedCustomerRecord[]> {
  cachedCustomers = null;
  customersFetchPromise = null;
  return loadCustomerRecords();
}

export function loadCustomerRecords(): Promise<IndexedCustomerRecord[]> {
  if (cachedCustomers) {
    return Promise.resolve(cachedCustomers);
  }
  if (!customersFetchPromise) {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const apiPath = `${baseUrl.replace(/\/$/, '')}/api/customers`;
    const fallbackPath = `${baseUrl.replace(/\/$/, '')}/data/customers.json`;

    customersFetchPromise = fetch(apiPath)
      .then((res) => {
        if (!res.ok) throw new Error('API customers endpoint unavailable');
        const contentType = res.headers.get('content-type') || '';
        if (contentType && !contentType.includes('application/json') && !contentType.includes('text/plain')) {
          throw new Error('API returned non-JSON response');
        }
        return res.json();
      })
      .catch(() => {
        return fetch(fallbackPath)
          .then((res) => {
            if (!res.ok) return [];
            return res.json().catch(() => []);
          })
          .catch(() => []);
      })
      .then((raw: unknown) => {
        // Handle both plain JSON array `[...]` and object `{ customers: [...] }`
        let rawList: unknown[] = [];
        if (Array.isArray(raw)) {
          rawList = raw;
        } else if (raw && typeof raw === 'object' && Array.isArray((raw as { customers?: unknown[] }).customers)) {
          rawList = (raw as { customers: unknown[] }).customers;
        } else {
          cachedCustomers = [];
          return [];
        }

        // 1. Parse each row into a CustomerRecord
        const parsedRows: CustomerRecord[] = [];
        for (let idx = 0; idx < rawList.length; idx++) {
          const entry = rawList[idx];
          if (!entry || typeof entry !== 'object') continue;
          const rec = entry as Partial<CustomerRecord> & Record<string, unknown>;

          const locationAddress = typeof rec.locationAddress === 'string' ? rec.locationAddress.trim() : '';
          const customerName = typeof rec.customerName === 'string' ? rec.customerName.trim() : '';
          const companyName = typeof rec.companyName === 'string' ? rec.companyName.trim() : '';
          const projectName = typeof rec.projectName === 'string' ? rec.projectName.trim() : '';

          let rawSno = typeof rec.sno === 'string' ? rec.sno.trim() : '';
          if (!rawSno && typeof rec['Customer SNo'] === 'string') {
            rawSno = (rec['Customer SNo'] as string).trim();
          }
          if (!rawSno && typeof rec['Customer SNo'] === 'number') {
            rawSno = String(rec['Customer SNo']);
          }
          if (!rawSno || rawSno.startsWith('=')) {
            rawSno = String(idx + 1);
          }
          const sno = rawSno.trim();

          // Keep row if at least one primary identifying field or sno is present
          if (!locationAddress && !customerName && !companyName && !projectName && !sno) {
            continue;
          }

          const designation = typeof rec.designation === 'string' ? rec.designation.trim() : '';
          const customerAddress = typeof rec.customerAddress === 'string' ? rec.customerAddress.trim() : locationAddress;
          const poNumber = typeof rec.poNumber === 'string' ? rec.poNumber.trim() : '';
          const invoiceNumber = typeof rec.invoiceNumber === 'string' ? rec.invoiceNumber.trim() : '';
          const refType = rec.refType === 'Invoice' ? 'Invoice' : rec.refType === 'PO' ? 'PO' : (poNumber ? 'PO' : (invoiceNumber ? 'Invoice' : ''));
          const refNumber = typeof rec.refNumber === 'string' && rec.refNumber.trim() ? rec.refNumber.trim() : (poNumber || invoiceNumber || '');
          const emailSubject = typeof rec.emailSubject === 'string' ? rec.emailSubject.trim() : '';
          const date = typeof rec.date === 'string' ? rec.date.trim() : '';
          const items = Array.isArray(rec.items) ? (rec.items as CustomerRecordItem[]) : [];
          const mailGroupId = typeof rec.mailGroupId === 'string' ? rec.mailGroupId.trim() : '';
          const extraSearch = typeof rec.searchText === 'string' ? rec.searchText.trim() : (typeof rec.allValues === 'string' ? rec.allValues.trim() : '');

          parsedRows.push({
            sno,
            date,
            customerName,
            designation,
            companyName,
            projectName,
            customerAddress,
            locationAddress,
            poNumber,
            invoiceNumber,
            refType,
            refNumber,
            emailSubject,
            items,
            mailGroupId,
            allValues: extraSearch,
            searchText: extraSearch,
          });
        }

        // 2. Group cleanly by customer + mailGroupId (if mailGroupId is present)
        // If mailGroupId is empty, each row remains a separate entry
        const groupMap = new Map<string, CustomerRecord[]>();
        const groupKeysOrder: string[] = [];

        parsedRows.forEach((row, rowIdx) => {
          const mg = (row.mailGroupId || '').trim().toLowerCase();
          let groupKey: string;
          if (mg) {
            const customerKey = (
              row.companyName ||
              row.customerName ||
              row.projectName ||
              row.customerAddress ||
              row.locationAddress
            )
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9]/g, '');
            groupKey = `group:${customerKey || 'cust'}:::${mg}`;
          } else {
            groupKey = `single:${rowIdx}:${row.sno || ''}`;
          }

          if (!groupMap.has(groupKey)) {
            groupMap.set(groupKey, []);
            groupKeysOrder.push(groupKey);
          }
          groupMap.get(groupKey)!.push(row);
        });

        const indexed: IndexedCustomerRecord[] = [];

        for (const gKey of groupKeysOrder) {
          const orders = groupMap.get(gKey) || [];
          if (orders.length === 0) continue;
          const primary = orders[0];

          const sno = primary.sno || '';
          const snoNormalized = sno.replace(/^#/, '').trim().toLowerCase();
          const primaryName =
            primary.companyName ||
            primary.projectName ||
            primary.customerName ||
            primary.customerAddress ||
            primary.locationAddress ||
            (sno ? `Customer #${sno}` : 'Customer');

          // Collect all lowercase field values across ALL orders in this group
          const fieldValuesSet = new Set<string>();
          for (const ord of orders) {
            const vals = [
              ord.sno,
              ord.sno ? `#${ord.sno}` : '',
              ord.customerName,
              ord.designation,
              ord.companyName,
              ord.projectName,
              ord.locationAddress,
              ord.customerAddress,
              ord.poNumber,
              ord.invoiceNumber,
              ord.refNumber,
              ord.emailSubject,
              ord.mailGroupId,
              ord.date,
              ord.searchText,
              ord.allValues,
            ];
            for (const v of vals) {
              if (v) fieldValuesSet.add(v.toLowerCase().trim());
            }
            if (ord.items) {
              for (const it of ord.items) {
                if (it.itemCode) fieldValuesSet.add(it.itemCode.toLowerCase().trim());
                if (it.description) fieldValuesSet.add(it.description.toLowerCase().trim());
              }
            }
          }
          const fieldValuesLower = Array.from(fieldValuesSet);

          const wordsSet = new Set<string>();
          for (const fv of fieldValuesLower) {
            const words = fv.split(/[\s,./#\-()_]+/).filter(Boolean);
            for (const w of words) {
              wordsSet.add(w);
            }
          }
          const wordsLower = Array.from(wordsSet);
          const combinedSearchText = fieldValuesLower.join(' ');

          indexed.push({
            record: primary,
            orders,
            mailGroupId: primary.mailGroupId,
            orderCount: orders.length,
            sno,
            snoNormalized,
            dateStr: primary.date || '1970-01-01',
            customerNameLower: (primary.customerName || '').toLowerCase(),
            companyNameLower: (primary.companyName || '').toLowerCase(),
            projectLower: (primary.projectName || '').toLowerCase(),
            addressLower: (primary.customerAddress || primary.locationAddress || '').toLowerCase(),
            poNumberLower: (primary.poNumber || '').toLowerCase(),
            invoiceNumberLower: (primary.invoiceNumber || '').toLowerCase(),
            refNumberLower: (primary.refNumber || '').toLowerCase(),
            emailSubjectLower: (primary.emailSubject || '').toLowerCase(),
            primaryName,
            combinedSearchText,
            fieldValuesLower,
            wordsLower,
          });
        }

        // Sort newest date first by default
        indexed.sort((a, b) => b.dateStr.localeCompare(a.dateStr));
        cachedCustomers = indexed;
        return indexed;
      })
      .catch(() => {
        cachedCustomers = [];
        return [];
      });
  }
  return customersFetchPromise;
}

export function filterAndRankCustomers(
  customers: IndexedCustomerRecord[],
  rawQuery: string
): IndexedCustomerRecord[] {
  const query = rawQuery.trim();
  if (!shouldTriggerCustomerSearch(query) || customers.length === 0) {
    return [];
  }

  const queryLower = query.toLowerCase();
  const isOneChar = queryLower.length === 1;

  // Clean query without leading '#' for SNo checks (e.g. "#1" -> "1", "#" -> "")
  const cleanQuery = queryLower.startsWith('#') ? queryLower.slice(1).trim() : queryLower;

  const matched: { item: IndexedCustomerRecord; rank: number }[] = [];

  if (isOneChar) {
    // -------------------------------------------------------------
    // 1-Character Query Mode:
    // Match any row where any field value OR any word inside a field starts with that character
    // (no noisy middle-of-word matches).
    // -------------------------------------------------------------
    const char = queryLower;
    const cleanChar = char === '#' ? '' : char;

    for (const item of customers) {
      let isMatch = false;
      let hasWordStartsWith = false;

      if (char === '#') {
        // Typing '#' matches all rows having an SNo
        if (item.sno) isMatch = true;
      } else if (cleanChar) {
        if (item.snoNormalized && item.snoNormalized.startsWith(cleanChar)) {
          isMatch = true;
          hasWordStartsWith = true;
        } else if (item.wordsLower.some((w) => w.startsWith(cleanChar))) {
          isMatch = true;
          hasWordStartsWith = true;
        } else if (item.fieldValuesLower.some((fv) => fv.startsWith(cleanChar))) {
          isMatch = true;
          hasWordStartsWith = true;
        }
      }

      if (isMatch) {
        // Determine rank for 1-char mode:
        // Rank 1: exact sno match (e.g. typing "1" when sno is "1")
        // Rank 2: field or word starts-with match
        // Rank 3: other matches
        let rank = 3;
        if (cleanChar && item.snoNormalized === cleanChar) {
          rank = 1;
        } else if (hasWordStartsWith) {
          rank = 2;
        }
        matched.push({ item, rank });
      }
    }
  } else {
    // -------------------------------------------------------------
    // 2+ Character Query Mode:
    // Full multi-word substring token matching across all columns
    // (every typed word must match somewhere in the row).
    // -------------------------------------------------------------
    const tokens = queryLower.split(/\s+/).filter(Boolean);
    const cleanTokens = tokens.map((t) => (t.startsWith('#') ? t.slice(1) : t)).filter(Boolean);

    for (const item of customers) {
      const matchesAllTokens = tokens.every((token) => {
        if (item.combinedSearchText.includes(token)) {
          return true;
        }
        const cleanToken = token.startsWith('#') ? token.slice(1) : token;
        if (cleanToken) {
          if (item.combinedSearchText.includes(cleanToken)) {
            return true;
          }
          if (item.snoNormalized && (item.snoNormalized === cleanToken || item.snoNormalized.startsWith(cleanToken))) {
            return true;
          }
        }
        return false;
      });

      if (matchesAllTokens) {
        // Determine rank for 2+ char mode:
        // Rank 1: exact sno match against full cleanQuery or any token
        // Rank 2: field or word starts-with match
        // Rank 3: general substring match
        let rank = 3;
        if (cleanQuery && item.snoNormalized === cleanQuery) {
          rank = 1;
        } else if (cleanTokens.some((ct) => item.snoNormalized === ct)) {
          rank = 1;
        } else if (
          (cleanQuery && item.snoNormalized.startsWith(cleanQuery)) ||
          item.fieldValuesLower.some((fv) => fv.startsWith(queryLower) || (cleanQuery && fv.startsWith(cleanQuery))) ||
          item.wordsLower.some((w) => w.startsWith(queryLower) || (cleanQuery && w.startsWith(cleanQuery)))
        ) {
          rank = 2;
        }

        matched.push({ item, rank });
      }
    }
  }

  // Sorting priority:
  // 1. Exact sno match first (rank 1)
  // 2. Field or word starts-with match (rank 2)
  // 3. General substring match (rank 3)
  // 4. Newest date first
  matched.sort((a, b) => {
    if (a.rank !== b.rank) {
      return a.rank - b.rank;
    }
    return b.item.dateStr.localeCompare(a.item.dateStr);
  });

  return matched.map((m) => m.item);
}
