import { DEMO_ATTENDEES, DEMO_SESSIONS, type DemoAttendee, type DemoSession } from '@copilot/core';

export const DEMO_GRIP_ATTENDEE_LIST_PAGE_TITLE = 'Grip demo — attendee search results';
export const DEMO_GRIP_ATTENDEE_LIST_DESCRIPTION =
  'This page is intentionally instrumented with stable DOM attributes so the extension can capture visible attendee records in the first MVP slice.';
export const DEMO_GRIP_ATTENDEE_PROFILE_PAGE_TITLE = 'Grip demo — attendee profile';
export const DEMO_GRIP_ATTENDEE_PROFILE_DESCRIPTION =
  'Profile page example for page snapshot + provenance handling.';
export const DEMO_GRIP_SESSION_LIST_PAGE_TITLE = 'Grip demo — session list';
export const DEMO_GRIP_SESSION_LIST_DESCRIPTION =
  'Each visible session card includes speaker metadata so the extension can emit both session records and speaker person records.';

export interface DemoGripAttendeeCardFixture {
  key: string;
  dataAttributes: Record<string, string>;
  fullName: string;
  title: string;
  companyName: string;
  email: string;
  pills: string[];
}

export interface DemoGripSpeakerFixture {
  key: string;
  fullName: string;
}

export interface DemoGripSessionCardFixture {
  key: string;
  dataAttributes: Record<string, string>;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
  startsAtLabel: string;
  speakers: DemoGripSpeakerFixture[];
}

function formatSessionStartLabel(startsAt: string): string {
  return new Date(startsAt).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function buildAttendeeCardFixture(attendee: DemoAttendee): DemoGripAttendeeCardFixture {
  return {
    key: attendee.externalKey,
    dataAttributes: {
      'data-grip-card-type': 'attendee',
      'data-person-external-id': attendee.externalKey,
      'data-attendee-name': attendee.fullName,
      'data-attendee-title': attendee.title,
      'data-company': attendee.companyName,
      'data-email': attendee.email
    },
    fullName: attendee.fullName,
    title: attendee.title,
    companyName: attendee.companyName,
    email: attendee.email,
    pills: ['attendee', 'visible', 'search result card']
  };
}

function buildSessionCardFixture(session: DemoSession): DemoGripSessionCardFixture {
  return {
    key: session.externalKey,
    dataAttributes: {
      'data-grip-card-type': 'session',
      'data-session-external-id': session.externalKey,
      'data-session-title': session.title,
      'data-session-description': session.description,
      'data-location': session.location,
      'data-starts-at': session.startsAt,
      'data-ends-at': session.endsAt,
      'data-speakers': session.speakers.map((speaker) => speaker.fullName).join('|')
    },
    title: session.title,
    description: session.description,
    location: session.location,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    startsAtLabel: formatSessionStartLabel(session.startsAt),
    speakers: session.speakers.map((speaker) => ({
      key: `${session.externalKey}-${speaker.fullName}`,
      fullName: speaker.fullName
    }))
  };
}

export function listDemoGripAttendeeCardFixtures(): DemoGripAttendeeCardFixture[] {
  return DEMO_ATTENDEES.map(buildAttendeeCardFixture);
}

export function getDemoGripAttendeeProfileFixture():
  | DemoGripAttendeeCardFixture
  | undefined {
  return DEMO_ATTENDEES[0] ? buildAttendeeCardFixture(DEMO_ATTENDEES[0]) : undefined;
}

export function listDemoGripSessionCardFixtures(): DemoGripSessionCardFixture[] {
  return DEMO_SESSIONS.map(buildSessionCardFixture);
}
