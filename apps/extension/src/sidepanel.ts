export {};

type ExtensionSettings = {
  webAppUrl: string;
  workspaceId: string;
};

const webAppInput = document.querySelector<HTMLInputElement>('#webAppUrl');
const workspaceInput = document.querySelector<HTMLInputElement>('#workspaceId');
const statusEl = document.querySelector<HTMLDivElement>('#status');
const saveButton = document.querySelector<HTMLButtonElement>('#saveSettings');
const openWorkspaceButton = document.querySelector<HTMLButtonElement>('#openWorkspace');
const captureButton = document.querySelector<HTMLButtonElement>('#capture');

function setStatus(text: string) {
  if (statusEl) {
    statusEl.textContent = text;
  }
}

async function loadSettings() {
  const response = (await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' })) as ExtensionSettings;
  if (webAppInput) {
    webAppInput.value = response.webAppUrl;
  }
  if (workspaceInput) {
    workspaceInput.value = response.workspaceId;
  }
}

async function saveSettings() {
  const payload: ExtensionSettings = {
    webAppUrl: webAppInput?.value?.trim() || 'http://localhost:3000',
    workspaceId: workspaceInput?.value?.trim() || 'ws_demo_summit_2026'
  };

  await chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', payload });
  setStatus(`Saved settings for ${payload.workspaceId}.`);
}

async function captureCurrentPage() {
  setStatus('Capturing visible records from the active tab...');
  await saveSettings();

  const response = (await chrome.runtime.sendMessage({
    type: 'CAPTURE_CURRENT_TAB'
  })) as { ok: boolean; result?: { totalRecords?: number; addedPeople?: number; addedSessions?: number }; error?: string };

  if (!response.ok) {
    setStatus(`Capture failed.\n${response.error ?? 'Unknown error.'}`);
    return;
  }

  const result = response.result ?? {};
  setStatus(
    `Capture complete.\nRecords: ${result.totalRecords ?? 0}\nAdded people: ${result.addedPeople ?? 0}\nAdded sessions: ${result.addedSessions ?? 0}`
  );
}

saveButton?.addEventListener('click', () => {
  void saveSettings();
});

openWorkspaceButton?.addEventListener('click', async () => {
  await saveSettings();
  await chrome.runtime.sendMessage({ type: 'OPEN_WORKSPACE' });
});

captureButton?.addEventListener('click', () => {
  void captureCurrentPage();
});

void loadSettings();
