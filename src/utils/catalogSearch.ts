import { CatalogItem, CatalogMatch, getProductWarrantyInfo } from './warrantyRules';

export interface IndexedCatalogItem {
  item: CatalogItem;
  codeLower: string;
  nameLower: string;
  categoryLower: string;
  subCategoryLower: string;
  brandLower: string;
  combinedDisplay: string;
  combinedLower: string;
  match: CatalogMatch;
}

let cachedCatalog: IndexedCatalogItem[] | null = null;
let catalogFetchPromise: Promise<IndexedCatalogItem[]> | null = null;

export function getCachedCatalog(): IndexedCatalogItem[] {
  return cachedCatalog || [];
}

export function loadCatalogItems(): Promise<IndexedCatalogItem[]> {
  if (cachedCatalog) {
    return Promise.resolve(cachedCatalog);
  }
  if (!catalogFetchPromise) {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const dataUrl = `${baseUrl.replace(/\/$/, '')}/data/items.json`;
    catalogFetchPromise = fetch(dataUrl)
      .then((res) => {
        if (!res.ok) return [];
        return res.json();
      })
      .then((raw: unknown) => {
        if (!Array.isArray(raw)) {
          cachedCatalog = [];
          return [];
        }
        const indexed: IndexedCatalogItem[] = [];
        for (const entry of raw) {
          if (!entry || typeof entry !== 'object') continue;
          const record = entry as Partial<CatalogItem>;
          const itemCode = typeof record.itemCode === 'string' ? record.itemCode.trim() : '';
          const itemName = typeof record.itemName === 'string' ? record.itemName.trim() : '';
          if (!itemCode && !itemName) continue;
          const catalogItem: CatalogItem = {
            itemCode,
            itemName,
            category: typeof record.category === 'string' ? record.category : '',
            subCategory: typeof record.subCategory === 'string' ? record.subCategory : '',
          };
          const match = getProductWarrantyInfo(catalogItem);
          const combinedDisplay =
            itemCode && itemName ? `${itemCode} - ${itemName}` : itemName || itemCode;
          indexed.push({
            item: catalogItem,
            codeLower: itemCode.toLowerCase(),
            nameLower: itemName.toLowerCase(),
            categoryLower: catalogItem.category.toLowerCase(),
            subCategoryLower: catalogItem.subCategory.toLowerCase(),
            brandLower: match.productBrand.toLowerCase(),
            combinedDisplay,
            combinedLower: combinedDisplay.toLowerCase(),
            match,
          });
        }
        cachedCatalog = indexed;
        return indexed;
      })
      .catch(() => {
        cachedCatalog = [];
        return [];
      });
  }
  return catalogFetchPromise;
}

function getRelevanceRank(entry: IndexedCatalogItem, fullQuery: string): number {
  if (entry.codeLower === fullQuery) return 0;
  if (entry.codeLower.endsWith(fullQuery)) return 1;
  if (entry.codeLower.includes(fullQuery)) return 2;
  if (entry.nameLower.startsWith(fullQuery)) return 3;
  if (entry.nameLower.includes(fullQuery)) return 4;
  return 5;
}

/**
 * Multi-word token matching across itemCode, itemName, category, subCategory, and productBrand,
 * ranked by relevance (exact/tail code -> name starts/includes -> remaining multi-token matches).
 */
export function filterAndRankCatalog(
  catalog: IndexedCatalogItem[],
  rawQuery: string
): IndexedCatalogItem[] {
  const query = rawQuery.trim().toLowerCase();
  if (query.length < 2 || catalog.length === 0) {
    return [];
  }

  const tokens = query.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return [];
  }

  const ranked: Array<{ entry: IndexedCatalogItem; rank: number; index: number }> = [];
  for (let i = 0; i < catalog.length; i++) {
    const entry = catalog[i];
    const matchesAllTokens = tokens.every(
      (token) =>
        entry.combinedLower.includes(token) ||
        entry.categoryLower.includes(token) ||
        entry.subCategoryLower.includes(token) ||
        entry.brandLower.includes(token)
    );

    if (matchesAllTokens) {
      ranked.push({
        entry,
        rank: getRelevanceRank(entry, query),
        index: i,
      });
    }
  }

  ranked.sort((a, b) => a.rank - b.rank || a.index - b.index);
  return ranked.map((r) => r.entry);
}
