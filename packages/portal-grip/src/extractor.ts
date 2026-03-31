import { nowIso, type CapturePagePayload, type CapturePageType, type CaptureRecord } from '@copilot/core';
import {
  ATTENDEE_CARD_SELECTORS,
  EXTRACTOR_VERSION,
  FIELD_SELECTORS,
  PAGE_MARKER_SELECTORS,
  SESSION_CARD_SELECTORS,
  SPEAKER_CARD_SELECTORS
} from './selectors';

const MAX_RAW_HTML_LENGTH = 8_000;
const MAX_PAGE_HTML_LENGTH = 250_000;
const MAX_PAGE_TEXT_SUMMARY_LENGTH = 1_200;

export interface GripVisiblePageExtractionOptions {
  pageUrl?: string;
  capturedAt?: string;
}

interface PersonRecordOptions {
  defaultIsAttendee: boolean;
  defaultIsSpeaker: boolean;
  nameAttributes: readonly string[];
  titleAttributes: readonly string[];
  companyAttributes: readonly string[];
  emailAttributes: readonly string[];
  externalKeyAttributes: readonly string[];
  selectorHints: string[];
  fieldSelectors: {
    name: readonly string[];
    title: readonly string[];
    company: readonly string[];
    email: readonly string[];
  };
}

function uniqueElements(elements: Element[]): Element[] {
  return Array.from(new Set(elements));
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength).trimEnd() : value;
}

function optionalString(value: string | null | undefined): string | undefined {
  const normalized = value ? compactWhitespace(value) : '';
  return normalized || undefined;
}

function queryAny(root: ParentNode, selectors: readonly string[]): Element[] {
  const matches = selectors.flatMap((selector) => Array.from(root.querySelectorAll(selector)));
  return uniqueElements(matches);
}

function queryFirstText(root: ParentNode, selectors: readonly string[]): string | undefined {
  for (const selector of selectors) {
    const match = root.querySelector(selector);
    const text = optionalString(match?.textContent);
    if (text) {
      return text;
    }
  }

  return undefined;
}

function queryAttribute(root: Element, attributes: readonly string[]): string | undefined {
  for (const attribute of attributes) {
    const value = optionalString(root.getAttribute(attribute));
    if (value) {
      return value;
    }
  }

  return undefined;
}

function visible(element: Element): boolean {
  const htmlElement = element as HTMLElement;
  const style = globalThis.getComputedStyle?.(htmlElement);
  const rect = htmlElement.getBoundingClientRect?.() ?? { width: 1, height: 1 };
  const hasBox =
    rect.width > 0 ||
    rect.height > 0 ||
    ((htmlElement as HTMLElement & { offsetWidth?: number }).offsetWidth ?? 0) > 0 ||
    ((htmlElement as HTMLElement & { offsetHeight?: number }).offsetHeight ?? 0) > 0;
  const isConnected = 'isConnected' in htmlElement ? htmlElement.isConnected : true;
  const allowsOffsetParent = style?.position === 'fixed' || style?.position === 'sticky';

  return (
    isConnected &&
    hasBox &&
    style?.visibility !== 'hidden' &&
    style?.display !== 'none' &&
    htmlElement.getAttribute('aria-hidden') !== 'true' &&
    (htmlElement.offsetParent !== null || allowsOffsetParent)
  );
}

function readMailto(root: ParentNode): string | undefined {
  const anchor = root.querySelector('a[href^="mailto:"]') as HTMLAnchorElement | null;
  const href = anchor?.href;
  if (!href) {
    return undefined;
  }

  return optionalString(href.replace(/^mailto:/, ''));
}

function cardHtml(element: Element): string {
  const html = element.outerHTML ?? '';
  return truncate(html, MAX_RAW_HTML_LENGTH);
}

function currentPageUrl(options?: GripVisiblePageExtractionOptions): string {
  if (options?.pageUrl) {
    return options.pageUrl;
  }

  return globalThis.location?.href ?? '';
}

function pathSegments(pageUrl: string): string[] {
  if (!pageUrl) {
    return [];
  }

  try {
    return new URL(pageUrl).pathname.split('/').filter(Boolean);
  } catch {
    return [];
  }
}

function pageHints(pageUrl: string, pageTitle: string): {
  isAttendeeList: boolean;
  isAttendeeProfile: boolean;
  isSpeakerList: boolean;
  isSpeakerProfile: boolean;
  isSessionList: boolean;
  isSessionProfile: boolean;
} {
  const segments = pathSegments(pageUrl);
  const title = pageTitle.toLowerCase();
  const hasAttendeeSegment = segments.includes('attendees');
  const hasSpeakerSegment = segments.includes('speakers');
  const hasSessionSegment = segments.includes('sessions');

  return {
    isAttendeeList:
      (hasAttendeeSegment && segments[segments.length - 1] === 'attendees') ||
      title.includes('attendee search') ||
      title.includes('attendee list'),
    isAttendeeProfile:
      hasAttendeeSegment &&
      segments.length > 1 &&
      segments[segments.length - 2] === 'attendees',
    isSpeakerList:
      (hasSpeakerSegment && segments[segments.length - 1] === 'speakers') || title.includes('speaker list'),
    isSpeakerProfile:
      hasSpeakerSegment &&
      segments.length > 1 &&
      segments[segments.length - 2] === 'speakers',
    isSessionList:
      (hasSessionSegment && segments[segments.length - 1] === 'sessions') || title.includes('session list'),
    isSessionProfile:
      hasSessionSegment &&
      segments.length > 1 &&
      segments[segments.length - 2] === 'sessions'
  };
}

function pageMarkerType(documentLike: Document): CapturePageType | undefined {
  const marker = optionalString(documentLike.querySelector(PAGE_MARKER_SELECTORS[0])?.getAttribute('data-grip-page'));

  switch (marker) {
    case 'attendee-list':
      return 'ATTENDEE_LIST';
    case 'attendee-profile':
      return 'ATTENDEE_PROFILE';
    case 'speaker-list':
      return 'SPEAKER_LIST';
    case 'speaker-profile':
      return 'SPEAKER_PROFILE';
    case 'session-list':
      return 'SESSION_LIST';
    case 'session-profile':
      return 'SESSION_PROFILE';
    default:
      return undefined;
  }
}

function buildPageTextSummary(pageTitle: string, pageType: CapturePageType, records: CaptureRecord[]): string {
  const values = [
    pageTitle,
    pageType.replaceAll('_', ' ').toLowerCase(),
    ...records.flatMap((record) => {
      const orderedFields =
        record.entityType === 'PERSON'
          ? [
              record.fields.fullName,
              record.fields.title,
              record.fields.companyName,
              record.fields.email
            ]
          : [
              record.fields.title,
              record.fields.location,
              record.fields.startsAt,
              ...(Array.isArray(record.fields.speakerNames) ? record.fields.speakerNames : [])
            ];

      return orderedFields
        .map((value) => (typeof value === 'string' ? optionalString(value) : undefined))
        .filter(Boolean);
    })
  ].filter(Boolean) as string[];

  return truncate(Array.from(new Set(values)).join(' | '), MAX_PAGE_TEXT_SUMMARY_LENGTH);
}

function hasMeaningfulPersonRecord(record: CaptureRecord): boolean {
  return Boolean(
    optionalString(String(record.fields.fullName ?? '')) ||
      optionalString(String(record.fields.email ?? '')) ||
      optionalString(String(record.externalKey ?? ''))
  );
}

function hasMeaningfulSessionRecord(record: CaptureRecord): boolean {
  return Boolean(
    optionalString(String(record.fields.title ?? '')) ||
      optionalString(String(record.externalKey ?? '')) ||
      optionalString(String(record.fields.location ?? ''))
  );
}

function extractPersonCards(
  documentLike: Document,
  selectors: readonly string[],
  options: PersonRecordOptions
): CaptureRecord[] {
  const cards = queryAny(documentLike, selectors).filter(visible);

  return cards
    .map((card) => {
      const fullName =
        queryAttribute(card, options.nameAttributes) ?? queryFirstText(card, options.fieldSelectors.name);
      const title =
        queryAttribute(card, options.titleAttributes) ?? queryFirstText(card, options.fieldSelectors.title);
      const companyName =
        queryAttribute(card, options.companyAttributes) ?? queryFirstText(card, options.fieldSelectors.company);
      const email =
        queryAttribute(card, options.emailAttributes) ??
        readMailto(card) ??
        queryFirstText(card, options.fieldSelectors.email);
      const externalKey = queryAttribute(card, options.externalKeyAttributes);
      const isSpeaker = card.getAttribute('data-is-speaker') === 'true' || options.defaultIsSpeaker;
      const isAttendee = card.getAttribute('data-is-attendee') === 'false' ? false : options.defaultIsAttendee;

      const record: CaptureRecord = {
        entityType: 'PERSON',
        externalKey,
        fields: {
          fullName,
          title,
          companyName,
          email,
          isSpeaker,
          isAttendee
        },
        rawHtmlSnippet: cardHtml(card),
        selectorHints: options.selectorHints
      };

      return hasMeaningfulPersonRecord(record) ? record : undefined;
    })
    .filter((record): record is CaptureRecord => Boolean(record));
}

function readSpeakerNames(card: Element): string[] {
  const attributeNames = optionalString(card.getAttribute('data-speakers'));
  if (attributeNames) {
    return attributeNames
      .split('|')
      .map((value) => optionalString(value))
      .filter((value): value is string => Boolean(value));
  }

  return queryAny(card, FIELD_SELECTORS.speakerPills)
    .map((speaker) => optionalString(speaker.getAttribute('data-speaker-name')) ?? optionalString(speaker.textContent))
    .filter((value): value is string => Boolean(value));
}

function extractSessionCards(documentLike: Document): CaptureRecord[] {
  const cards = queryAny(documentLike, SESSION_CARD_SELECTORS).filter(visible);
  const records: CaptureRecord[] = [];

  for (const card of cards) {
    const title = queryAttribute(card, ['data-session-title']) ?? queryFirstText(card, FIELD_SELECTORS.sessionTitle);
    const description =
      queryAttribute(card, ['data-session-description']) ??
      queryFirstText(card, FIELD_SELECTORS.sessionDescription);
    const location =
      queryAttribute(card, ['data-location']) ?? queryFirstText(card, FIELD_SELECTORS.sessionLocation);
    const startsAt = queryAttribute(card, ['data-starts-at']);
    const endsAt = queryAttribute(card, ['data-ends-at']);
    const externalKey = queryAttribute(card, ['data-session-external-id']);
    const speakerNames = readSpeakerNames(card);

    const sessionRecord: CaptureRecord = {
      entityType: 'SESSION',
      externalKey,
      fields: {
        title,
        description,
        location,
        startsAt,
        endsAt,
        speakerNames
      },
      rawHtmlSnippet: cardHtml(card),
      selectorHints: ['session-card']
    };

    if (hasMeaningfulSessionRecord(sessionRecord)) {
      records.push(sessionRecord);
    }

    for (const speakerName of speakerNames) {
      records.push({
        entityType: 'PERSON',
        externalKey: `${externalKey ?? title ?? 'session'}::speaker::${speakerName.toLowerCase().replace(/\s+/g, '-')}`,
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

export function detectGripPageType(
  documentLike: Document,
  options?: Pick<GripVisiblePageExtractionOptions, 'pageUrl'>
): CapturePageType {
  const markerType = pageMarkerType(documentLike);
  if (markerType) {
    return markerType;
  }

  const attendeeCount = queryAny(documentLike, ATTENDEE_CARD_SELECTORS).filter(visible).length;
  const speakerCount = queryAny(documentLike, SPEAKER_CARD_SELECTORS).filter(visible).length;
  const sessionCount = queryAny(documentLike, SESSION_CARD_SELECTORS).filter(visible).length;
  const pageUrl = currentPageUrl(options);
  const hints = pageHints(pageUrl, documentLike.title);

  if (hints.isAttendeeProfile || (attendeeCount === 1 && sessionCount === 0 && !hints.isSessionProfile)) {
    return 'ATTENDEE_PROFILE';
  }

  if (hints.isSessionProfile || (sessionCount === 1 && attendeeCount === 0 && speakerCount === 0 && !hints.isAttendeeProfile)) {
    return 'SESSION_PROFILE';
  }

  if (hints.isSpeakerProfile || (speakerCount === 1 && attendeeCount === 0 && sessionCount === 0)) {
    return 'SPEAKER_PROFILE';
  }

  if (hints.isAttendeeList || (attendeeCount > 1 && sessionCount === 0)) {
    return 'ATTENDEE_LIST';
  }

  if (hints.isSpeakerList || (speakerCount > 1 && attendeeCount === 0 && sessionCount === 0)) {
    return 'SPEAKER_LIST';
  }

  if (hints.isSessionList || (sessionCount > 1 && attendeeCount === 0 && speakerCount === 0)) {
    return 'SESSION_LIST';
  }

  if (attendeeCount > 0 && sessionCount === 0) {
    return attendeeCount === 1 ? 'ATTENDEE_PROFILE' : 'ATTENDEE_LIST';
  }

  if (speakerCount > 0 && attendeeCount === 0 && sessionCount === 0) {
    return speakerCount === 1 ? 'SPEAKER_PROFILE' : 'SPEAKER_LIST';
  }

  if (sessionCount > 0 && attendeeCount === 0) {
    return sessionCount === 1 ? 'SESSION_PROFILE' : 'SESSION_LIST';
  }

  return 'UNKNOWN';
}

export function extractGripVisiblePage(
  documentLike: Document,
  options?: GripVisiblePageExtractionOptions
): CapturePagePayload {
  const attendeeRecords = extractPersonCards(documentLike, ATTENDEE_CARD_SELECTORS, {
    defaultIsAttendee: true,
    defaultIsSpeaker: false,
    nameAttributes: ['data-attendee-name'],
    titleAttributes: ['data-attendee-title'],
    companyAttributes: ['data-company'],
    emailAttributes: ['data-email'],
    externalKeyAttributes: ['data-person-external-id'],
    selectorHints: ['attendee-card'],
    fieldSelectors: {
      name: FIELD_SELECTORS.attendeeName,
      title: FIELD_SELECTORS.attendeeTitle,
      company: FIELD_SELECTORS.attendeeCompany,
      email: FIELD_SELECTORS.attendeeEmail
    }
  });
  const speakerRecords = extractPersonCards(documentLike, SPEAKER_CARD_SELECTORS, {
    defaultIsAttendee: false,
    defaultIsSpeaker: true,
    nameAttributes: ['data-speaker-name', 'data-attendee-name'],
    titleAttributes: ['data-speaker-title', 'data-attendee-title'],
    companyAttributes: ['data-speaker-company', 'data-company'],
    emailAttributes: ['data-speaker-email', 'data-email'],
    externalKeyAttributes: ['data-speaker-external-id', 'data-person-external-id'],
    selectorHints: ['speaker-card'],
    fieldSelectors: {
      name: FIELD_SELECTORS.speakerName,
      title: FIELD_SELECTORS.speakerTitle,
      company: FIELD_SELECTORS.speakerCompany,
      email: FIELD_SELECTORS.speakerEmail
    }
  });
  const sessionRecords = extractSessionCards(documentLike);
  const records = [...attendeeRecords, ...speakerRecords, ...sessionRecords];
  const pageType = detectGripPageType(documentLike, { pageUrl: options?.pageUrl });
  const pageTitle = optionalString(documentLike.title) ?? 'Untitled page';
  const pageTextSummary = buildPageTextSummary(pageTitle, pageType, records);
  const pageHtml = truncate(documentLike.documentElement?.outerHTML ?? '', MAX_PAGE_HTML_LENGTH) || undefined;

  return {
    portalProvider: 'GRIP',
    captureMethod: 'DOM',
    pageType,
    pageUrl: currentPageUrl(options),
    pageTitle,
    pageTextSummary,
    capturedAt: options?.capturedAt ?? nowIso(),
    pageHtml,
    extractorVersion: EXTRACTOR_VERSION,
    records
  };
}
