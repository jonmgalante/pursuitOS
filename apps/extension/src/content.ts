import { extractGripVisiblePage } from '@copilot/portal-grip';

interface RuntimeMessage {
  type?: 'CAPTURE_VISIBLE';
}

chrome.runtime.onMessage.addListener(
  (
  message: RuntimeMessage,
  _sender,
  sendResponse
) => {
    if (message?.type !== 'CAPTURE_VISIBLE') {
      return false;
    }

    const capture = extractGripVisiblePage(document);
    sendResponse(capture);
    return true;
  }
);