// Extract product info from MIC product edit page
(function () {
  function extractProductData() {
    const url = window.location.href;
    const idMatch = url.match(/id=(\d+)/);
    const productId = idMatch ? idMatch[1] : null;

    const titleEl = document.querySelector('input[name="title"], #productTitle, [data-field="title"]');
    const title = titleEl ? titleEl.value || titleEl.textContent : document.title;

    const categoryEl = document.querySelector('[data-field="category"], .product-category, #productCategory');
    const category = categoryEl ? categoryEl.textContent.trim() : '';

    return { productId, title, category, url };
  }

  chrome.runtime.sendMessage({
    type: 'PAGE_DATA',
    data: extractProductData(),
  });

  // Watch for field changes
  const observer = new MutationObserver(() => {
    chrome.runtime.sendMessage({
      type: 'PAGE_DATA',
      data: extractProductData(),
    });
  });

  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['value'] });
})();
