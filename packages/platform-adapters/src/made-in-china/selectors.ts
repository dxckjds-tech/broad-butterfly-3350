export const MIC_HOST_PATTERN = /(^|\.)made-in-china\.com$/i;

export const MIC_PRODUCT_URL_PATTERNS = [
  /\/product[-_]?detail/i,
  /\/product\//i,
  /\/showroom\/.+\/product/i,
  /_p\.html/i,
];

export const MIC_SHOP_URL_PATTERNS = [
  /\/company/i,
  /\/showroom/i,
  /\/factory/i,
  /\.en\.made-in-china\.com\/?$/i,
];

export const MIC_SELECTORS = {
  productName: ['.product-name', '.pro-name', '.sr-pro-name', 'h1.product-title', 'h1'],
  companyName: [
    '.company-name',
    '.com-name',
    '.sr-com-name',
    'a[href*="showroom"]',
    'meta[property="og:site_name"]',
  ],
  description: [
    '.product-description',
    '.pro-desc',
    '#productDescription',
    '[itemprop="description"]',
    '.detail-desc',
  ],
  images: [
    '.product-img img',
    '.pro-img img',
    '.preview-img img',
    '[itemprop="image"]',
    'img[src*="made-in-china"]',
  ],
  specTables: ['.spec-table', '.product-attr table', '.pro-attr table', 'table'],
  category: ['.breadcrumb', '.cate-path', 'nav.breadcrumb'],
  moq: ['.moq', '[data-role="moq"]'],
  delivery: ['.delivery-time', '.lead-time'],
};
