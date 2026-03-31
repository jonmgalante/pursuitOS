import type { CapturePagePayload, CaptureRecord, CapturePageType } from '@copilot/core';
import { EXTRACTOR_VERSION, ATTENDEE_CARD_SELECTORS, FIELD_SELECTORS, SESSION_CARD_SELECTORS } from './selectors';

function uniqueElements(elements: Element[]): Element[] {
  return Array.from(new Set(elements));
}

function queryAny(root: ParentNode, selectors: readonly string[]): Element[] {
  const matches = selectors.flatMap((selector) => Array.from(root.querySelectorAll(selector)));
  return uniqueElements(matches);
}

function queryText(root: ParentNode, selectors: readonly string[]): string | undefined {
  for (const selector of selectors) {
    const match = root.querySelector(selector);
    const text = match?.textContent?.trim();
    if (text) {
      return text;
    }
  }

  return undefined;
}

function visible(element: Element): boolean {
  const htmlElement = element as HTMLElement;
  const style = globalThis.getComputedStyle?.(htmlElement);
  const rect = htmlElement.getBoundingClientRect();

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style?.visibility !== 'hidden' &&
    style?.display !== 'none' &&
    htmlElement.offsetParent !== null
  );
}

function readMailto(root: ParentNode): string | undefined {
  const anchor = root.querySelector('a[href^="mailto:"]') as HTMLAnchorElement | null;
  const href = anchor?.href;
  if (!href) {
    return undefined;
  }
  return href.replace(/^mailto:/, '').trim() || undefined;
}

function cardHtml(element: Element): string {
  const html = element.outerHTML ?? '';
  return html.length > 5000 ? `${html.slice(0, 5000)}…` : html;
}

function extractAttendeeCards(documentLike: Document): CaptureRecord[] {
  const cards = queryAny(documentLike, ATTENDEE_CARD_SELECTORS).filter(visible);

  return cards.map((card) => {
    const name = card.getAttribute('data-attendee-name') ?? queryText(card, FIELD_SELECTORS.attendeeName);
    const title = card.getAttribute('data-attendee-title') ?? queryText(card, FIELD_SELECTORS.attendeeTitle);
    const companyName =
      card.getAttribute('data-company') ?? queryText(card, FIELD_SELECTORS.attendeeCompany);
    const email = card.getAttribute('data-email') ?? readMailto(card);
    const externalKey = card.getAttribute('data-person-external-id') ?? undefined;
    const isSpeaker = card.getAttribute('data-is-speaker') === 'true';

    return {
      entityType: 'PERSON',
      externalKey,
      fields: {
        fullName: name,
        title,
        companyName,
        email,
        isSpeaker,
        isAttendee: true
      },
      rawHtmlSnippet: cardHtml(card),
      selectorHints: ['attendee-card']
    };
  });
}

function extractSessionCards(documentLike: Document): CaptureRecord[] {
  const cards = queryAny(documentLike, SESSION_CARD_SELECTORS).filter(visible);
  const records: CaptureRecord[] = [];

  for (const card of cards) {
    const title = card.getAttribute('data-session-title') ?? queryText(card, FIELD_SELECTORS.sessionTitle);
    const description =
      card.getAttribute('data-session-description') ??
      queryText(card, FIELD_SELECTORS.sessionDescription);
    const location = card.getAttribute('data-location') ?? queryText(card, FIELD_SELECTORS.sessionLocation);
    const startsAt = card.getAttribute('data-starts-at') ?? undefined;
    const endsAt = card.getAttribute('data-ends-at') ?? undefined;
    const externalKey = card.getAttribute('data-session-external-id') ?? undefined;
    const speakersRaw = card.getAttribute('data-speakers') ?? '';
    const speakers = speakersRaw
      .split('|')
      .map((value) => value.trim())
      .filter(Boolean);

    records.push({
      entityType: 'SESSION',
      externalKey,
      fields: {
        title,
        description,
        location,
        startsAt,
        endsAt,
        speakerNames: speakers
      },
      rawHtmlSnippet: cardHtml(card),
      selectorHints: ['session-card']
    });

    for (const speakerName of speakers) {
      records.push({
        entityType: 'PERSON',
        externalKey: `${externalKey ?? 'session'}::speaker::${speakerName.toLowerCase().replace(/\s+/g, '-')}`,
        fields: {
          fullName: speakerName,
          title: undefined,
          companyName: undefined,
          email: undefined,
          isSpeaker: true,
          isAttendee: false
        },
        rawHtmlSnippet: cardHtml(card),
        selectorHints: ['session-speaker']
      });
    }
  }

  return records;
}

function detectPageType(documentLike: Document): CapturePageType {
  const profileMarker = documentLike.querySelector('[data-grip-page]')?.getAttribute('data-grip-page');

  if (profileMarker === 'attendee-profile') {
    return 'ATTENDEE_PROFILE';
  }

  if (profileMarker === 'session-profile') {
    return 'SESSION_PROFILE';
  }

  const attendeeCount = queryAny(documentLike, ATTENDEE_CARD_SELECTORS).filter(visible).length;
  const sessionCount = queryAny(documentLike, SESSION_CARD_SELECTORS).filter(visible).length;

  if (attendeeCount > 0 && sessionCount === 0) {
    return 'ATTENDEE_LIST';
  }

  if (sessionCount > 0 && attendeeCount === 0) {
    return 'SESSION_LIST';
  }

  return 'UNKNOWN';
}

export function extractGripVisiblePage(documentLike: Document): CapturePagePayload {
  const pageType = detectPageType(documentLike);
  const attendeeRecords = extractAttendeeCards(documentLike);
  const sessionRecords = extractSessionCards(documentLike);
  const pageHtml = documentLike.documentElement?.outerHTML?.slice(0, 250_000);

  return {
    portalProvider: 'GRIP',
    captureMethod: 'DOM',
    pageType,
    pageUrl: globalThis.location?.href ?? '',
    pageTitle: documentLike.title,
    pageHtml,
    extractorVersion: EXTRACTOR_VERSION,
    records: [...attendeeRecords, ...sessionRecords]
  };
}
