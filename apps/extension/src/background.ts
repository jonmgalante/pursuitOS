export {};

import {
  createExtensionCaptureErrorResponse,
  createExtensionCaptureRequest,
  parseExtensionCaptureResponse,
  type ExtensionCaptureResponse,
  type ExtensionCaptureSummary
} from '@copilot/portal-grip';

interface ExtensionSettings {
  webAppUrl: string;
  workspaceId: string;
}

interface ExtensionStoredState extends ExtensionSettings {
  lastCaptureSummary?: ExtensionCaptureSummary;
}

interface RuntimeMessage {
  type?: 'GET_SETTINGS' | 'SAVE_SETTINGS' | 'OPEN_WORKSPACE' | 'CAPTURE_CURRENT_TAB';
  payload?: Partial<ExtensionSettings>;
}

const DEFAULT_SETTINGS: ExtensionSettings = {
  webAppUrl: 'http://localhost:3000',
  workspaceId: 'ws_demo_summit_2026'
};

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  const settings = await chrome.storage.local.get<ExtensionStoredState>(DEFAULT_SETTINGS);
  await chrome.storage.local.set<ExtensionStoredState>(settings);
});

chrome.runtime.onMessage.addListener(
  (
  message: RuntimeMessage,
  _sender,
  sendResponse
) =>{
    if (message?.type === 'GET_SETTINGS') {
      chrome.storage.local.get<ExtensionStoredState>(DEFAULT_SETTINGS).then(sendResponse);
      return true;
    }

    if (message?.type === 'SAVE_SETTINGS') {
      chrome.storage.local.set<ExtensionSettings>(message.payload ?? {}).then(() => sendResponse({ ok: true }));
      return true;
    }

    if (message?.type === 'OPEN_WORKSPACE') {
      chrome.storage.local.get<ExtensionSettings>(DEFAULT_SETTINGS).then((settings) => {
        chrome.tabs.create({
          url: `${settings.webAppUrl}/workspaces/${settings.workspaceId}`
        });
        sendResponse({ ok: true });
      });
      return true;
    }

    if (message?.type === 'CAPTURE_CURRENT_TAB') {
      captureCurrentTab()
        .then(sendResponse)
        .catch((error: Error) => {
          sendResponse({
            ok: false,
            error: error.message
          });
        });
      return true;
    }

    return false;
  }
);

async function captureCurrentTab() {
  const settings = await chrome.storage.local.get<ExtensionStoredState>(DEFAULT_SETTINGS);
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

  if (!tab?.id) {
    throw new Error('No active tab found.');
  }

  if (!tab.active) {
    throw new Error('Capture is limited to the current active tab.');
  }

  if (!tab.url || !/^https?:\/\//.test(tab.url)) {
    throw new Error('Open a live Grip page in an http or https tab before capturing.');
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  });

  const pageCapture = await chrome.tabs.sendMessage(tab.id, { type: 'CAPTURE_VISIBLE' });
  if (!pageCapture || !Array.isArray(pageCapture.records)) {
    return createExtensionCaptureErrorResponse('Capture failed because the page payload was malformed.');
  }

  if (pageCapture.records.length === 0) {
    return createExtensionCaptureErrorResponse(
      'No visible Grip attendee, speaker, or session records were found on this page.'
    );
  }

  const response = await fetch(`${settings.webAppUrl}/api/capture`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(createExtensionCaptureRequest(settings.workspaceId, pageCapture))
  });

  const result = parseExtensionCaptureResponse(await response.json());

  if (result.ok) {
    await chrome.storage.local.set<ExtensionStoredState>({
      lastCaptureSummary: result.summary
    });
  }

  if (!response.ok && !result.ok) {
    return result;
  }

  return result satisfies ExtensionCaptureResponse;
}
