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

          // Collect all lowercase field values for starts-with matching
          const fieldValuesLower = [
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
            .map((val) => val.toLowerCase());

          // Extract all unique words across fields for 1-char word-boundary starts-with matching
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
