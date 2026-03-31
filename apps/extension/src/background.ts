export {};

interface ExtensionSettings {
  webAppUrl: string;
  workspaceId: string;
}

const DEFAULT_SETTINGS: ExtensionSettings = {
  webAppUrl: 'http://localhost:3000',
  workspaceId: 'ws_demo_summit_2026'
};

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  const settings = await chrome.storage.local.get(DEFAULT_SETTINGS);
  await chrome.storage.local.set(settings);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'GET_SETTINGS') {
    chrome.storage.local.get(DEFAULT_SETTINGS).then(sendResponse);
    return true;
  }

  if (message?.type === 'SAVE_SETTINGS') {
    chrome.storage.local.set(message.payload).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === 'OPEN_WORKSPACE') {
    chrome.storage.local.get(DEFAULT_SETTINGS).then((settings) => {
      chrome.tabs.create({
        url: `${settings.webAppUrl}/workspaces/${settings.workspaceId}`
      });
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message?.type === 'CAPTURE_CURRENT_TAB') {
    captureCurrentTab().then(sendResponse).catch((error: Error) => {
      sendResponse({
        ok: false,
        error: error.message
      });
    });
    return true;
  }

  return false;
});

async function captureCurrentTab() {
  const settings = (await chrome.storage.local.get(DEFAULT_SETTINGS)) as ExtensionSettings;
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

  if (!tab?.id) {
    throw new Error('No active tab found.');
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  });

  const pageCapture = await chrome.tabs.sendMessage(tab.id, { type: 'CAPTURE_VISIBLE' });

  const response = await fetch(`${settings.webAppUrl}/api/capture`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      workspaceId: settings.workspaceId,
      capture: pageCapture
    })
  });

  const result = await response.json();
  await chrome.storage.local.set({
    lastCaptureResult: result
  });

  return {
    ok: response.ok,
    result
  };
}
