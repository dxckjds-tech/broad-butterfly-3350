const keyFor = (url: string) => `identityUserVerified:${url}`;

export async function getIdentityUserVerified(url: string): Promise<boolean> {
  if (!url) return false;
  try {
    const data = await chrome.storage.local.get(keyFor(url));
    return Boolean(data[keyFor(url)]);
  } catch {
    return false;
  }
}

export async function setIdentityUserVerified(url: string, verified: boolean): Promise<void> {
  if (!url) return;
  try {
    await chrome.storage.local.set({ [keyFor(url)]: verified });
  } catch {
    /* ignore */
  }
}
