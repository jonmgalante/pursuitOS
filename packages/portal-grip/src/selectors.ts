export const ATTENDEE_CARD_SELECTORS = [
  '[data-grip-card-type="attendee"]',
  '[data-testid="attendee-card"]',
  '[data-entity="attendee-card"]',
  'article[data-attendee-name]'
] as const;

export const SPEAKER_CARD_SELECTORS = [
  '[data-grip-card-type="speaker"]',
  '[data-testid="speaker-card"]',
  '[data-entity="speaker-card"]',
  'article[data-speaker-name]'
] as const;

export const SESSION_CARD_SELECTORS = [
  '[data-grip-card-type="session"]',
  '[data-testid="session-card"]',
  '[data-entity="session-card"]',
  'article[data-session-title]'
] as const;

export const PAGE_MARKER_SELECTORS = ['[data-grip-page]'] as const;

export const FIELD_SELECTORS = {
  attendeeName: ['[data-field="name"]', 'h2', 'h3'],
  attendeeTitle: ['[data-field="title"]', '[data-field="role"]', '.title'],
  attendeeCompany: ['[data-field="company"]', '.company'],
  attendeeEmail: ['[data-field="email"]', 'a[href^="mailto:"]'],
  speakerName: ['[data-speaker-name]', '[data-field="speaker-name"]', '[data-field="name"]', 'h2', 'h3'],
  speakerTitle: ['[data-speaker-title]', '[data-field="title"]', '[data-field="role"]', '.title'],
  speakerCompany: ['[data-speaker-company]', '[data-field="company"]', '.company'],
  speakerEmail: ['[data-speaker-email]', '[data-field="email"]', 'a[href^="mailto:"]'],
  sessionTitle: ['[data-field="session-title"]', 'h2', 'h3'],
  sessionDescription: ['[data-field="session-description"]', 'p'],
  sessionLocation: ['[data-field="location"]', '.location'],
  sessionTime: ['[data-field="time"]', 'time'],
  speakerPills: ['[data-speaker-name]', '[data-field="speaker"]', '.speaker-pill']
} as const;

export const EXTRACTOR_VERSION = 'grip-dom-v0.2.0';
