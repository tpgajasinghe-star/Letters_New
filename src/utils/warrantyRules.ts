export interface CatalogItem {
  itemCode: string;
  itemName: string;
  category: string;
  subCategory: string;
}

export interface CatalogMatch {
  productBrand: string;
  warrantyPeriod: string;
}

function includesAny(text: string, keywords: readonly string[]): boolean {
  return keywords.some((kw) => text.includes(kw));
}

export function getProductWarrantyInfo(item: CatalogItem): CatalogMatch {
  const itemName = (item.itemName || '').toLowerCase();
  const category = (item.category || '').toLowerCase();
  const subCategory = (item.subCategory || '').toLowerCase();
  const full = `${category} ${subCategory} ${itemName}`;

  // 1. Hotel Key Card & Shaver Socket (MUST run before sunk box / accessory rules)
  if (includesAny(full, ['hotel key', 'hottel key', 'shaver', 'shv-sct'])) {
    return { productBrand: 'Switch & Socket', warrantyPeriod: '5 Years' };
  }

  // 2. Multi / Trailer Sockets (with or without USB)
  const multiSocketKeywords = ['trailer socket', 'trailing socket', 'multi socket'];
  if (includesAny(itemName, multiSocketKeywords) || includesAny(subCategory, multiSocketKeywords)) {
    return { productBrand: 'Electrical Accessory', warrantyPeriod: '6 Months' };
  }

  // 3. Enclosures, Conduit & Electrical Accessories (check itemName before LED/Switch)
  if (
    includesAny(itemName, [
      'enclosure',
      'encl',
      'conduit',
      'polycon',
      'sunk box',
      'mounting box',
      'junction box',
      'holder',
      'ceiling rose',
      'adaptor',
      'adapter',
      'convertor',
      'plug top',
      'insulation tape',
      'bus bar',
      'busbar',
      'earth rod',
      'transparent cover',
      'saddle',
      'trunking',
      'corrugat',
      'pipe',
      'bend',
    ])
  ) {
    return { productBrand: 'Electrical Accessory', warrantyPeriod: '6 Months' };
  }

  // 4. Wall USB A & C / USB Items
  if (full.includes('usb')) {
    return { productBrand: 'Switch & Socket', warrantyPeriod: '5 Years' };
  }

  // 5. Protection Devices
  if (itemName.includes('changeover') || subCategory.includes('changeover')) {
    return { productBrand: 'Protection Device', warrantyPeriod: '2 Years' };
  }
  if (itemName.includes('spd') || subCategory.includes('surge protection')) {
    return { productBrand: 'Protection Device', warrantyPeriod: '6 Months' };
  }
  if (itemName.includes('electric bell')) {
    return { productBrand: 'Protection Device', warrantyPeriod: '1 Year' };
  }
  if (itemName.includes('hexa') || category.includes('hexa')) {
    if (itemName.includes('rccb') || subCategory.includes('rccb')) {
      return { productBrand: 'Protection Device', warrantyPeriod: '10 Years' };
    }
    return { productBrand: 'Protection Device', warrantyPeriod: 'Lifetime' };
  }
  const safetaaProtectionKeywords = ['mcb', 'rccb', 'isolator'];
  if (
    full.includes('safetaa') &&
    (includesAny(itemName, safetaaProtectionKeywords) ||
      includesAny(subCategory, safetaaProtectionKeywords))
  ) {
    return { productBrand: 'Protection Device', warrantyPeriod: '5 Years' };
  }
  if (
    includesAny(itemName, ['mcb', 'rccb', 'mccb', 'isolator']) ||
    (category.includes('protection') && category.includes('kevilton'))
  ) {
    return { productBrand: 'Protection Device', warrantyPeriod: '10 Years' };
  }

  // 6. Ding Dong Bell, Fans & Solar Tubular Battery
  if (itemName.includes('ding dong')) {
    return { productBrand: 'Electrical Accessory', warrantyPeriod: '1 Year' };
  }
  if (itemName.includes('ceiling fan')) {
    return { productBrand: 'Ceiling Fans', warrantyPeriod: '2 Years' };
  }
  if (includesAny(itemName, ['ventilation', 'vantilation'])) {
    return { productBrand: 'Ventilation Fan', warrantyPeriod: '2 Years' };
  }
  if (includesAny(itemName, ['solar tubular', 'battery'])) {
    return { productBrand: 'Solar Tubular Battery', warrantyPeriod: '2 Years' };
  }

  // 7. Lighting & LED
  if (
    includesAny(itemName, [
      'flood light',
      'wall lamp',
      'wall light',
      '2x2',
      'panel light',
      'panal light',
      'ceiling light',
      'ceiling lamp',
      'batten light',
      'tube light',
      'candle',
      'circuit driver',
      'led indicator',
    ])
  ) {
    return { productBrand: 'Lighting', warrantyPeriod: '2 Years' };
  }
  if (itemName.includes('safetaa') && itemName.includes('led')) {
    return { productBrand: 'Lighting', warrantyPeriod: '2 Years' };
  }
  if (includesAny(itemName, ['30w', '40w', '50w']) && itemName.includes('led')) {
    return { productBrand: 'Lighting', warrantyPeriod: '2 Years' };
  }
  if (
    (itemName.includes('kevilton') && itemName.includes('led')) ||
    includesAny(itemName, ['kv/led', 'kv / led'])
  ) {
    return { productBrand: 'Lighting', warrantyPeriod: '3 Years' };
  }
  if (full.includes('led') || itemName.includes('lamp')) {
    return { productBrand: 'Lighting', warrantyPeriod: '2 Years' };
  }

  // 8. Switch & Socket Series (White / Modular / Nature / Matt)
  if (
    includesAny(full, [
      'white series',
      'modular',
      'nature series',
      'matt series',
      'gang switch',
      'switch',
      'socket',
      'controller',
      'dimmer',
      'video & voice',
      'bell press',
      'blank plate',
      'mahogany',
      'kumbuk',
      'teak',
      'cloudy gray',
      'frosty white',
      'deep',
    ])
  ) {
    return { productBrand: 'Switch & Socket', warrantyPeriod: 'Lifetime' };
  }

  // 9. Fallback
  return { productBrand: '', warrantyPeriod: '' };
}
