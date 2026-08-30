import { findSectionRoot, readFieldByLabel, readRadioValue, sectionLooksCollapsed } from './form-reader';
import { PRODUCT_EDIT_LABELS } from './types';

export function parseTradeInfo(doc: Document): {
  moq: string;
  deliveryTime: string;
  oemAvailable: boolean;
  oemKnown: boolean;
  tradeLoaded: boolean;
  oemLoaded: boolean;
  matched: Record<string, string>;
} {
  const trade = findSectionRoot(doc, PRODUCT_EDIT_LABELS.trade);
  const oemSection = findSectionRoot(doc, PRODUCT_EDIT_LABELS.oem);
  const tradeLoaded = Boolean(trade) && !sectionLooksCollapsed(trade);
  const oemLoaded = Boolean(oemSection) && !sectionLooksCollapsed(oemSection);

  const moqHit = tradeLoaded ? readFieldByLabel(doc, PRODUCT_EDIT_LABELS.moq) : { value: '', matched: '' };
  const deliveryHit = tradeLoaded ? readFieldByLabel(doc, PRODUCT_EDIT_LABELS.delivery) : { value: '', matched: '' };

  let oemAvailable = false;
  let oemKnown = false;
  if (oemLoaded && oemSection) {
    oemKnown = true;
    const radio = readRadioValue(oemSection);
    const blob = `${oemSection.textContent || ''} ${radio}`.toLowerCase();
    oemAvailable = /\byes\b|支持|available|oem|odm|custom/i.test(blob) && !/\bno\b.*oem|不支持/.test(blob);
    const checked = oemSection.querySelector('input[type="checkbox"]:checked, input[type="radio"]:checked');
    if (checked) {
      oemKnown = true;
      const label = checked.closest('label')?.textContent || (checked as HTMLInputElement).value;
      oemAvailable = /yes|oem|odm|custom|支持|有/i.test(label || '');
    }
  }

  return {
    moq: moqHit.value,
    deliveryTime: deliveryHit.value,
    oemAvailable,
    oemKnown,
    tradeLoaded,
    oemLoaded,
    matched: {
      moq: moqHit.matched,
      delivery: deliveryHit.matched,
    },
  };
}
