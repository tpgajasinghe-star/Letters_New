export interface CustomerRecord {
  date?: string;
  customerName?: string;
  companyName?: string;
  projectName?: string;
  locationAddress: string;
  refType?: 'PO' | 'Invoice' | '';
  refNumber?: string;
  emailSubject?: string;
}

export interface IndexedCustomerRecord {
  record: CustomerRecord;
  dateStr: string;
  customerNameLower: string;
  companyNameLower: string;
  projectLower: string;
  addressLower: string;
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
        if (!Array.isArray(raw)) {
          cachedCustomers = [];
          return [];
        }
        const indexed: IndexedCustomerRecord[] = [];
        for (const entry of raw) {
          if (!entry || typeof entry !== 'object') continue;
          const rec = entry as Partial<CustomerRecord>;
          const locationAddress = typeof rec.locationAddress === 'string' ? rec.locationAddress.trim() : '';
          const customerName = typeof rec.customerName === 'string' ? rec.customerName.trim() : '';
          const companyName = typeof rec.companyName === 'string' ? rec.companyName.trim() : '';
          const projectName = typeof rec.projectName === 'string' ? rec.projectName.trim() : '';
          if (!locationAddress && !customerName && !companyName && !projectName) continue;

          const refType = rec.refType === 'Invoice' ? 'Invoice' : rec.refType === 'PO' ? 'PO' : '';
          const refNumber = typeof rec.refNumber === 'string' ? rec.refNumber.trim() : '';
          const emailSubject = typeof rec.emailSubject === 'string' ? rec.emailSubject.trim() : '';
          const date = typeof rec.date === 'string' ? rec.date.trim() : '';

          const primaryName = companyName || projectName || customerName || locationAddress;
          const combinedSearchText = [customerName, companyName, projectName, locationAddress, refNumber, emailSubject, date]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          indexed.push({
            record: {
              date,
              customerName,
              companyName,
              projectName,
              locationAddress,
              refType,
              refNumber,
              emailSubject,
            },
            dateStr: date || '1970-01-01',
            customerNameLower: customerName.toLowerCase(),
            companyNameLower: companyName.toLowerCase(),
            projectLower: projectName.toLowerCase(),
            addressLower: locationAddress.toLowerCase(),
            refNumberLower: refNumber.toLowerCase(),
            emailSubjectLower: emailSubject.toLowerCase(),
            primaryName,
            combinedSearchText,
          });
        }

        // Sort newest date first
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
  const query = rawQuery.trim().toLowerCase();
  if (query.length < 2 || customers.length === 0) {
    return [];
  }

  const tokens = query.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const matched: IndexedCustomerRecord[] = [];
  for (const item of customers) {
    const matchesAll = tokens.every((token) => item.combinedSearchText.includes(token));
    if (matchesAll) {
      matched.push(item);
    }
  }

  // Already sorted newest date first
  return matched;
}
