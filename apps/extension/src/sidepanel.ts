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
const statusLabelByKind: Record<'idle' | 'loading' | 'success' | 'error', string> = {
  idle: 'Ready',
  loading: 'Working',
  success: 'Success',
  error: 'Error'
};

function createSummaryRow(
  label: string,
  value: string,
  options?: { href?: string }
) {
  const row = document.createElement('div');
  row.className = 'summary-row';

  const labelEl = document.createElement('div');
  labelEl.className = 'summary-label';
  labelEl.textContent = label;

  let valueEl: HTMLElement;
  if (options?.href) {
    const link = document.createElement('a');
    link.className = 'summary-value summary-link';
    link.href = options.href;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = value;
    valueEl = link;
  } else {
    const text = document.createElement('div');
    text.className = 'summary-value';
    text.textContent = value;
    valueEl = text;
  }

  row.append(labelEl, valueEl);
  return row;
}

function setStatus(kind: 'idle' | 'loading' | 'success' | 'error', text: string) {
  if (statusEl) {
    statusEl.textContent = `${statusLabelByKind[kind]}\n${text}`;
    statusEl.dataset.state = kind;
    statusEl.setAttribute('aria-label', `${statusLabelByKind[kind]} ${text}`.replaceAll('\n', ' '));
  }
}

function setBusy(isBusy: boolean) {
  if (captureButton) {
    captureButton.disabled = isBusy;
    captureButton.textContent = isBusy ? 'Capturing...' : 'Capture current page';
    captureButton.setAttribute('aria-busy', isBusy ? 'true' : 'false');
  }
}

function renderLastCaptureSummary(summary?: ExtensionCaptureSummary) {
  if (!lastCaptureCardEl || !lastCaptureSummaryEl) {
    return;
  }

  if (!summary) {
    lastCaptureCardEl.hidden = true;
    lastCaptureSummaryEl.replaceChildren();
    return;
  }

  lastCaptureCardEl.hidden = false;
  lastCaptureSummaryEl.replaceChildren(
    createSummaryRow('Page', summary.pageTitle || summary.pageType),
    createSummaryRow('Records', `${summary.pageType} · ${summary.totalRecords} records`),
    createSummaryRow(
      'Added',
      `People ${summary.addedPeople} · Sessions ${summary.addedSessions}`
    ),
    createSummaryRow('Captured', new Date(summary.capturedAt).toLocaleString()),
    createSummaryRow('URL', summary.pageUrl, { href: summary.pageUrl }),
    createSummaryRow('Visible summary', summary.pageTextSummary)
  );
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

setStatus('idle', 'Open a visible attendee or session page to capture.');
void loadSettings();
