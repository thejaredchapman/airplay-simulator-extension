document.getElementById('scan-btn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) return;

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'scan' });
    const count = response && response.count ? response.count : 0;

    document.getElementById('status-msg').textContent =
      count > 0 ? `Found ${count} video(s)!` : 'No videos found yet.';
  } catch (error) {
    document.getElementById('status-msg').textContent = 'Error scanning page. Reload page?';
    console.error(error);
  }
});

document.getElementById('fallback-btn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) return;

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'fallback' });
    const status = response && response.status;

    if (status === 'shown') {
      document.getElementById('status-msg').textContent = 'Showing stream URLs...';
    } else {
      document.getElementById('status-msg').textContent = 'No videos found to show URL for.';
    }
  } catch (error) {
    console.error(error);
  }
});
