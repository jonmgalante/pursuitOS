import { extractGripVisiblePage } from '@copilot/portal-grip';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'CAPTURE_VISIBLE') {
    return false;
  }

  const capture = extractGripVisiblePage(document);
  sendResponse(capture);
  return true;
});
