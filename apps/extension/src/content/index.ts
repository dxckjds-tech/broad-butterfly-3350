import { captureCurrentPage } from '@trade-ai/platform-adapters';
import type { PlatformPageData } from '@trade-ai/shared-types';

function readPage(): PlatformPageData {
  try {
    return captureCurrentPage(document, location.href);
  } catch {
    return {
      platform: 'UNKNOWN',
      pageType: 'UNKNOWN',
      url: location.href,
      title: document.title || '',
      companyName: '',
      productName: '',
      description: '',
      keywords: [],
      images: [],
      specifications: {},
      category: '',
      moq: '',
      deliveryTime: '',
      oemAvailable: false,
      certifications: [],
      rawText: '',
      capturedAt: new Date().toISOString(),
    };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'GET_PAGE_DATA') {
    try {
      sendResponse({ ok: true, data: readPage() });
    } catch (error) {
      sendResponse({
        ok: false,
        message: error instanceof Error ? error.message : 'CAPTURE_FAILED',
      });
    }
  }
  return true;
});
