chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'OPEN_ADMIN') {
    const url = chrome.runtime.getURL('admin/index.html');
    chrome.tabs.create({ url });
  }
  if (msg.type === 'OPEN_OPPORTUNITIES') {
    const url = chrome.runtime.getURL('admin/opportunities.html');
    chrome.tabs.create({ url });
  }
  return true;
});
