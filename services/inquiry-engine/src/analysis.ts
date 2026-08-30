import type { InquiryAnalysisResult, InquiryReplyDraft, MICInquiryRecord } from '@trade-ai/shared-types';

const QTY = /(\b\d+[\d,]*\s*(pcs|pieces|sets?|units|kg|tons?|meters?)|\bmoq\b|quantity)/i;
const PRICE = /\b(usd|price|fob|cif|budget|target price)\b/i;
const CERT = /\b(ce|iso|rohs|fda|ul|certif)/i;
const CUSTOM = /\b(oem|odm|custom|logo|packag)/i;
const DELIVERY = /\b(lead time|delivery|days|urgent|asap)\b/i;

export function analyzeInquiry(record: MICInquiryRecord): InquiryAnalysisResult {
  const text = `${record.subject} ${record.messagePreview}`.toLowerCase();
  const keyRequirements: string[] = [];
  if (QTY.test(text)) keyRequirements.push('quantity');
  if (PRICE.test(text)) keyRequirements.push('price');
  if (CERT.test(text)) keyRequirements.push('certification');
  if (CUSTOM.test(text)) keyRequirements.push('customization');
  if (DELIVERY.test(text)) keyRequirements.push('delivery');

  const completeness = keyRequirements.length / 5;
  const productMatch = record.productName ? 0.8 : 0.2;
  const intent = /please send price/.test(text) && keyRequirements.length <= 1 ? 0.35 : 0.2 + completeness * 0.7;
  const unreplied = /unreplied|pending|new|待回复/i.test(record.status) ? 0.15 : 0;
  const opportunityScore = Math.round(
    Math.min(
      92,
      (completeness * 25 + productMatch * 20 + intent * 25 + unreplied * 15 + 15) ,
    ),
  );

  const highIntent = keyRequirements.filter((k) => ['quantity', 'delivery', 'customization'].includes(k)).length >= 2 && Boolean(record.productName);

  return {
    buyerIntent: highIntent ? 'HIGH' : intent > 0.5 ? 'MEDIUM' : 'LOW',
    productInterest: record.productName || 'UNSPECIFIED',
    keyRequirements,
    quantity: QTY.test(text) ? 'SIGNAL_PRESENT' : 'UNKNOWN',
    targetPrice: PRICE.test(text) ? 'ASKED' : 'UNKNOWN',
    certificationNeeds: CERT.test(text) ? ['mentioned'] : [],
    customizationNeeds: CUSTOM.test(text) ? 'mentioned' : 'UNKNOWN',
    deliveryNeeds: DELIVERY.test(text) ? 'mentioned' : 'UNKNOWN',
    questions: keyRequirements.length ? [] : ['Could you share target quantity and destination port?'],
    riskSignals: /please send price/.test(text) && keyRequirements.length <= 1 ? ['price-only inquiry'] : [],
    nextAction: unreplied ? 'FOLLOW_UP_INQUIRY' : 'MONITOR',
    opportunityScore,
    evidenceLevel: 'INFERRED',
  };
}

export function draftInquiryReply(record: MICInquiryRecord, analysis: InquiryAnalysisResult): InquiryReplyDraft {
  const factsToConfirm: string[] = [];
  if (analysis.quantity === 'UNKNOWN') factsToConfirm.push('quantity / MOQ');
  if (analysis.targetPrice === 'UNKNOWN') factsToConfirm.push('target price / trade term');
  if (analysis.deliveryNeeds === 'UNKNOWN') factsToConfirm.push('required lead time');

  const product = record.productName || 'the requested product';
  const english = [
    `Thank you for your inquiry regarding ${product}.`,
    analysis.quantity === 'UNKNOWN'
      ? 'To prepare an accurate quotation, please confirm the quantity and destination.'
      : 'We have noted your quantity requirement and will confirm availability.',
    'We do not quote a price until specifications and quantity are confirmed.',
    'Please let us know any certification or OEM needs if applicable.',
  ].join(' ');

  return {
    english,
    chineseSummary: `感谢询盘（${product}）。未确认数量/规格前不虚构价格或交期。`,
    factsToConfirm,
    followUpQuestions: [
      'What is the target quantity and unit?',
      'Which destination port or country should we quote?',
    ],
    cta: 'Reply with quantity and destination so we can prepare a formal offer.',
    autoSend: false,
  };
}
