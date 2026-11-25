export interface CustomerRecord {
  sno?: string;
  date?: string;
  customerName?: string;
  companyName?: string;
  projectName?: string;
  locationAddress: string;
  poNumber?: string;
  invoiceNumber?: string;
  refType?: 'PO' | 'Invoice' | '';
  refNumber?: string;
  emailSubject?: string;
  allValues?: string;
  searchText?: string;
}

export interface IndexedCustomerRecord {
  record: CustomerRecord;
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
}

let cachedCustomers: IndexedCustomerRecord[] | null = null;
let customersFetchPromise: Promise<IndexedCustomerRecord[]> | null = null;

export function getCachedCustomers(): IndexedCustomerRecord[] {
  return cachedCustomers || [];
}

/**
 * Trigger condition:
 * - If the typed query is numeric (e.g. 1, 5, 12) or starts with # followed by digits (e.g. #5, #12),
 *   trigger suggestions starting from 1 character.
 * - Otherwise, trigger at 2+ characters as before.
 */
export function shouldTriggerCustomerSearch(rawQuery: string): boolean {
  const query = rawQuery.trim();
  if (!query) return false;

  const isNumericOrHashNumber = /^\d+$/.test(query) || /^#\d+$/.test(query);
  if (isNumericOrHashNumber) {
    return query.length >= 1;
  }
  return query.length >= 2;
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

        const indexed: IndexedCustomerRecord[] = [];
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

          const poNumber = typeof rec.poNumber === 'string' ? rec.poNumber.trim() : '';
          const invoiceNumber = typeof rec.invoiceNumber === 'string' ? rec.invoiceNumber.trim() : '';
          const refType = rec.refType === 'Invoice' ? 'Invoice' : rec.refType === 'PO' ? 'PO' : (poNumber ? 'PO' : (invoiceNumber ? 'Invoice' : ''));
          const refNumber = typeof rec.refNumber === 'string' && rec.refNumber.trim() ? rec.refNumber.trim() : (poNumber || invoiceNumber || '');
          const emailSubject = typeof rec.emailSubject === 'string' ? rec.emailSubject.trim() : '';
          const date = typeof rec.date === 'string' ? rec.date.trim() : '';
          const extraSearch = typeof rec.searchText === 'string' ? rec.searchText.trim() : (typeof rec.allValues === 'string' ? rec.allValues.trim() : '');

          const snoNormalized = sno.replace(/^#/, '').trim().toLowerCase();
          const primaryName = companyName || projectName || customerName || locationAddress || (sno ? `Customer #${sno}` : 'Customer');

          // Combined search text across every column/field
          const combinedSearchText = [
            sno,
            sno ? `#${sno}` : '',
            customerName,
            companyName,
            projectName,
            locationAddress,
            poNumber,
            invoiceNumber,
            refNumber,
            emailSubject,
            date,
            extraSearch,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          indexed.push({
            record: {
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
              allValues: extraSearch,
              searchText: extraSearch,
            },
            sno,
            snoNormalized,
            dateStr: date || '1970-01-01',
            customerNameLower: customerName.toLowerCase(),
            companyNameLower: companyName.toLowerCase(),
            projectLower: projectName.toLowerCase(),
            addressLower: locationAddress.toLowerCase(),
            poNumberLower: poNumber.toLowerCase(),
            invoiceNumberLower: invoiceNumber.toLowerCase(),
            refNumberLower: refNumber.toLowerCase(),
            emailSubjectLower: emailSubject.toLowerCase(),
            primaryName,
            combinedSearchText,
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
  const tokens = queryLower.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  // Strip leading '#' for SNo matching (e.g. "#5" -> "5")
  const cleanQuery = queryLower.startsWith('#') ? queryLower.slice(1).trim() : queryLower;
  const cleanTokens = tokens.map((t) => (t.startsWith('#') ? t.slice(1) : t)).filter(Boolean);

  const matched: IndexedCustomerRecord[] = [];

  for (const item of customers) {
    // Multi-word token matching across EVERY field:
    // Every token must match either combinedSearchText or sno (with # stripped)
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
      matched.push(item);
    }
  }

  // Ranking / Sorting:
  // Exact sno matches first (rank 1), then sno starts-with matches (rank 2), then newest date first
  const getSnoRank = (item: IndexedCustomerRecord): number => {
    if (!item.snoNormalized) return 3;

    // Check exact SNo match: against full query (stripped) or any individual clean token
    if (cleanQuery && item.snoNormalized === cleanQuery) {
      return 1;
    }
    for (const ct of cleanTokens) {
      if (item.snoNormalized === ct) {
        return 1;
      }
    }

    // Check SNo starts-with match
    if (cleanQuery && item.snoNormalized.startsWith(cleanQuery)) {
      return 2;
    }
    for (const ct of cleanTokens) {
      if (item.snoNormalized.startsWith(ct)) {
        return 2;
      }
    }

    return 3;
  };

  matched.sort((a, b) => {
    const rankA = getSnoRank(a);
    const rankB = getSnoRank(b);
    if (rankA !== rankB) {
      return rankA - rankB; // Rank 1 before Rank 2 before Rank 3
    }
    // Secondary sort: newest date first
    return b.dateStr.localeCompare(a.dateStr);
  });

  return matched;
}
