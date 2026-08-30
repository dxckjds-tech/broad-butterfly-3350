async function enableSidePanel(): Promise<void> {
  try {
    if (chrome.sidePanel?.setPanelBehavior) {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    }
  } catch (error) {
    console.warn('Side Panel unavailable, popup fallback will be used.', error);
  }
}

void enableSidePanel();

chrome.runtime.onInstalled.addListener(() => {
  void enableSidePanel();
});
