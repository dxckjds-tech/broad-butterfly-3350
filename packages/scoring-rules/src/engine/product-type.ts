import type { PlatformPageData, ProductTypeProfile } from '@trade-ai/shared-types';

const CUSTOM_HINTS =
  /custom|oem|odm|made to order|packaging|garment|apparel|clothing|plastic|printing|hardware|gift|promotional/i;
const MACHINERY_HINTS =
  /machine|machinery|equipment|lathe|cnc|press|pump|compressor|generator|production line/i;
const INDUSTRIAL_HINTS =
  /bearing|valve|fastener|fitting|sensor|motor|gear|industrial component|spare part/i;
const CONSUMER_HINTS = /home|kitchen|consumer|toy|daily|household|gift/i;

export function detectProductTypeProfile(page: PlatformPageData): ProductTypeProfile {
  const blob = [
    page.productName,
    page.category,
    ...(page.keywords ?? []),
    page.description?.slice(0, 800),
  ]
    .filter(Boolean)
    .join(' ');

  if (CUSTOM_HINTS.test(blob)) return 'CUSTOM_MANUFACTURING';
  if (MACHINERY_HINTS.test(blob)) return 'MACHINERY';
  if (INDUSTRIAL_HINTS.test(blob)) return 'INDUSTRIAL_COMPONENT';
  if (CONSUMER_HINTS.test(blob)) return 'CONSUMER_GOODS';
  return 'GENERAL';
}

export function isCustomizationRelevant(profile: ProductTypeProfile): boolean {
  return profile === 'CUSTOM_MANUFACTURING' || profile === 'CONSUMER_GOODS';
}
