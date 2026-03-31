export {};

import type { ExtensionCaptureResponse, ExtensionCaptureSummary } from '@copilot/portal-grip';

type ExtensionState = {
  webAppUrl: string;
  workspaceId: string;
  lastCaptureSummary?: ExtensionCaptureSummary;
};

const webAppInput = document.querySelector<HTMLInputElement>('#webAppUrl');
const workspaceInput = document.querySelector<HTMLInputElement>('#workspaceId');
const statusEl = document.querySelector<HTMLDivElement>('#status');
const lastCaptureCardEl = document.querySelector<HTMLDivElement>('#lastCaptureCard');
const lastCaptureSummaryEl = document.querySelector<HTMLDivElement>('#lastCaptureSummary');
const saveButton = document.querySelector<HTMLButtonElement>('#saveSettings');
const openWorkspaceButton = document.querySelector<HTMLButtonElement>('#openWorkspace');
const captureButton = document.querySelector<HTMLButtonElement>('#capture');

function setStatus(kind: 'idle' | 'loading' | 'success' | 'error', text: string) {
  if (statusEl) {
    statusEl.textContent = text;
    statusEl.dataset.state = kind;
  }
}

function setBusy(isBusy: boolean) {
  if (captureButton) {
    captureButton.disabled = isBusy;
    captureButton.textContent = isBusy ? 'Capturing...' : 'Capture current page';
  }
}

function renderLastCaptureSummary(summary?: ExtensionCaptureSummary) {
  if (!lastCaptureCardEl || !lastCaptureSummaryEl) {
    return;
  }

  if (!summary) {
    lastCaptureCardEl.hidden = true;
    lastCaptureSummaryEl.textContent = '';
    return;
  }

  lastCaptureCardEl.hidden = false;
  lastCaptureSummaryEl.textContent = [
    `${summary.pageTitle || summary.pageType}`,
    `${summary.pageType} · ${summary.totalRecords} records`,
    `Added people: ${summary.addedPeople} · Added sessions: ${summary.addedSessions}`,
    new Date(summary.capturedAt).toLocaleString(),
    summary.pageUrl,
    summary.pageTextSummary
  ].join('\n');
}

async function loadSettings() {
  const response = (await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' })) as ExtensionState;
  if (webAppInput) {
    webAppInput.value = response.webAppUrl;
  }
  if (workspaceInput) {
    workspaceInput.value = response.workspaceId;
  }
  renderLastCaptureSummary(response.lastCaptureSummary);
}

async function saveSettings(options?: { quiet?: boolean }) {
  const payload: Pick<ExtensionState, 'webAppUrl' | 'workspaceId'> = {
    webAppUrl: webAppInput?.value?.trim() || 'http://localhost:3000',
    workspaceId: workspaceInput?.value?.trim() || 'ws_demo_summit_2026'
  };

  await chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', payload });
  if (!options?.quiet) {
    setStatus('success', `Saved settings for ${payload.workspaceId}.`);
  }
}

async function captureCurrentPage() {
  setBusy(true);
  setStatus('loading', 'Capturing visible Grip records from the active tab...');

  try {
    await saveSettings({ quiet: true });

    const response = (await chrome.runtime.sendMessage({
      type: 'CAPTURE_CURRENT_TAB'
    })) as ExtensionCaptureResponse;

    if (!response.ok) {
      setStatus('error', `Capture failed.\n${response.error}`);
      return;
    }

    renderLastCaptureSummary(response.summary);
    setStatus(
      'success',
      `Capture complete.\n${response.summary.pageType} · ${response.summary.totalRecords} records\nAdded people: ${response.summary.addedPeople}\nAdded sessions: ${response.summary.addedSessions}`
    );
  } finally {
    setBusy(false);
  }
}

saveButton?.addEventListener('click', () => {
  void saveSettings();
});

openWorkspaceButton?.addEventListener('click', async () => {
  await saveSettings({ quiet: true });
  setStatus('success', 'Opening workspace in a new tab.');
  await chrome.runtime.sendMessage({ type: 'OPEN_WORKSPACE' });
});

captureButton?.addEventListener('click', () => {
  void captureCurrentPage();
});

void loadSettings();
