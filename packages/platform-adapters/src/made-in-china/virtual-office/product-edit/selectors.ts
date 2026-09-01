export const PRODUCT_EDIT_SELECTORS = {
  productNameInputs: [
    'input[name*="prodName" i]',
    'input[name*="productName" i]',
    'input[name*="product_name" i]',
    'textarea[name*="prodName" i]',
    '[data-field="productName"] input',
    '[data-mic-field="productName"]',
  ],
  keywordInputs: [
    '[data-mic-field="keyword"]',
    'input[name*="keyword" i]',
    'input[name*="prodKeyword" i]',
  ],
  centerTermInputs: [
    '[data-mic-field="centerTerm"]',
    'input[name*="centerWord" i]',
    'input[name*="coreWord" i]',
  ],
  categorySelected: [
    '[data-mic-field="selectedCategory"]',
    '.selected-category',
    '[class*="selected"][class*="categor"]',
  ],
  imageUpload: [
    '[class*="upload"] img',
    '[class*="photo"] img',
    '[class*="prod-pic"] img',
    '[class*="product-pic"] img',
    '[data-mic-field="productImage"]',
    '.pic-item img',
    '.img-item img',
  ],
  specRows: [
    '[data-mic-module="specifications"] .spec-row',
    '[class*="attr"] tr',
    '[class*="spec"] tr',
  ],
} as const;

export const IMAGE_UI_NOISE =
  /logo|icon|avatar|qr[-_]?code|qrcode|sprite|pixel|badge|star|rating|nav|header|ai麦可|made-in-china|mic-logo|favicon|button/i;
