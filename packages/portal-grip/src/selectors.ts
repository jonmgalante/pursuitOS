export const ATTENDEE_CARD_SELECTORS = [
  '[data-grip-card-type="attendee"]',
  '[data-testid="attendee-card"]',
  '[data-entity="attendee-card"]',
  'article[data-attendee-name]'
] as const;

export const SESSION_CARD_SELECTORS = [
  '[data-grip-card-type="session"]',
  '[data-testid="session-card"]',
  '[data-entity="session-card"]',
  'article[data-session-title]'
] as const;

export const FIELD_SELECTORS = {
  attendeeName: ['[data-field="name"]', 'h2', 'h3'],
  attendeeTitle: ['[data-field="title"]', '[data-field="role"]', '.title'],
  attendeeCompany: ['[data-field="company"]', '.company'],
  attendeeEmail: ['[data-field="email"]', 'a[href^="mailto:"]'],
  sessionTitle: ['[data-field="session-title"]', 'h2', 'h3'],
  sessionDescription: ['[data-field="session-description"]', 'p'],
  sessionLocation: ['[data-field="location"]', '.location'],
  sessionTime: ['[data-field="time"]', 'time'],
  speakerPills: ['[data-speaker-name]', '[data-field="speaker"]', '.speaker-pill']
} as const;

export const EXTRACTOR_VERSION = 'grip-dom-v0.1.0';
