import type { Event, HubSpotDirectoryRecord, Workspace } from './types';
import { nowIso } from './ids';

export interface DemoAttendee {
  externalKey: string;
  fullName: string;
  title: string;
  companyName: string;
  email: string;
}

export interface DemoSession {
  externalKey: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
  speakers: Array<{ fullName: string; title: string; companyName: string; email?: string }>;
}

export const DEMO_EVENT: Event = {
  id: 'evt_demo_summit_2026',
  name: 'Pipeline Summit 2026',
  venue: 'Javits Center',
  city: 'New York',
  startsAt: '2026-05-18T13:00:00.000Z',
  endsAt: '2026-05-20T21:00:00.000Z',
  timezone: 'America/New_York',
  portalProvider: 'GRIP'
};

export const DEMO_WORKSPACE: Workspace = {
  id: 'ws_demo_summit_2026',
  eventId: DEMO_EVENT.id,
  name: 'Pipeline Summit 2026 — Rep Workspace',
  portalProvider: 'GRIP',
  mode: 'PRE_EVENT',
  createdAt: nowIso(),
  updatedAt: nowIso()
};

export const DEMO_ATTENDEES: DemoAttendee[] = [
  {
    externalKey: 'grip_attendee_001',
    fullName: 'Avery Chen',
    title: 'VP Partnerships',
    companyName: 'SignalWorks',
    email: 'avery@signalworks.io'
  },
  {
    externalKey: 'grip_attendee_002',
    fullName: 'Jordan Kim',
    title: 'Head of Revenue Operations',
    companyName: 'Northstar Bio',
    email: 'jordan@northstarbio.com'
  },
  {
    externalKey: 'grip_attendee_003',
    fullName: 'Priya Patel',
    title: 'Director of Data Platforms',
    companyName: 'Altitude Cloud',
    email: 'priya@altitudecloud.com'
  },
  {
    externalKey: 'grip_attendee_004',
    fullName: 'Mateo Garcia',
    title: 'Senior Solutions Architect',
    companyName: 'BluePeak Systems',
    email: 'mateo@bluepeaksystems.com'
  },
  {
    externalKey: 'grip_attendee_005',
    fullName: 'Chloe Nguyen',
    title: 'Chief Marketing Officer',
    companyName: 'LedgerLane',
    email: 'chloe@ledgerlane.co'
  },
  {
    externalKey: 'grip_attendee_006',
    fullName: 'Leo Rossi',
    title: 'Founder',
    companyName: 'VenuePilot',
    email: 'leo@venuepilot.ai'
  },
  {
    externalKey: 'grip_attendee_007',
    fullName: 'Maya Thompson',
    title: 'VP Sales',
    companyName: 'StreamForge',
    email: 'maya@streamforge.io'
  },
  {
    externalKey: 'grip_attendee_008',
    fullName: 'Owen Brooks',
    title: 'GTM Lead',
    companyName: 'Helio Health',
    email: 'owen@heliohealth.com'
  },
  {
    externalKey: 'grip_attendee_009',
    fullName: 'Sofia Martinez',
    title: 'Principal Product Marketing Manager',
    companyName: 'ApexGrid',
    email: 'sofia@apexgrid.com'
  },
  {
    externalKey: 'grip_attendee_010',
    fullName: 'Noah Davis',
    title: 'Enterprise Account Executive',
    companyName: 'CloudRoute',
    email: 'noah@cloudroute.com'
  }
];

export const DEMO_SESSIONS: DemoSession[] = [
  {
    externalKey: 'grip_session_001',
    title: 'How AI Changes Event ROI',
    description: 'Turning conference interactions into measurable pipeline faster.',
    location: 'Main Stage',
    startsAt: '2026-05-18T15:00:00.000Z',
    endsAt: '2026-05-18T15:45:00.000Z',
    speakers: [
      { fullName: 'Leo Rossi', title: 'Founder', companyName: 'VenuePilot', email: 'leo@venuepilot.ai' },
      { fullName: 'Avery Chen', title: 'VP Partnerships', companyName: 'SignalWorks', email: 'avery@signalworks.io' }
    ]
  },
  {
    externalKey: 'grip_session_002',
    title: 'RevOps at Conferences',
    description: 'Operational systems that turn event activity into clean follow-up.',
    location: 'Room 2A',
    startsAt: '2026-05-18T17:00:00.000Z',
    endsAt: '2026-05-18T17:45:00.000Z',
    speakers: [
      { fullName: 'Jordan Kim', title: 'Head of Revenue Operations', companyName: 'Northstar Bio', email: 'jordan@northstarbio.com' },
      { fullName: 'Maya Thompson', title: 'VP Sales', companyName: 'StreamForge', email: 'maya@streamforge.io' }
    ]
  },
  {
    externalKey: 'grip_session_003',
    title: 'From Booth Traffic to Pipeline',
    description: 'How reps translate high-volume event interactions into concrete next steps.',
    location: 'Room 1C',
    startsAt: '2026-05-19T14:00:00.000Z',
    endsAt: '2026-05-19T14:45:00.000Z',
    speakers: [
      { fullName: 'Chloe Nguyen', title: 'Chief Marketing Officer', companyName: 'LedgerLane', email: 'chloe@ledgerlane.co' },
      { fullName: 'Noah Davis', title: 'Enterprise Account Executive', companyName: 'CloudRoute', email: 'noah@cloudroute.com' }
    ]
  },
  {
    externalKey: 'grip_session_004',
    title: 'Modern Data Follow-up Systems',
    description: 'Data capture and note structure patterns that survive after the event ends.',
    location: 'Data Theater',
    startsAt: '2026-05-19T16:00:00.000Z',
    endsAt: '2026-05-19T16:45:00.000Z',
    speakers: [
      { fullName: 'Priya Patel', title: 'Director of Data Platforms', companyName: 'Altitude Cloud', email: 'priya@altitudecloud.com' },
      { fullName: 'Sofia Martinez', title: 'Principal Product Marketing Manager', companyName: 'ApexGrid', email: 'sofia@apexgrid.com' }
    ]
  },
  {
    externalKey: 'grip_session_005',
    title: 'Designing Better Portal Workflows',
    description: 'Design tactics for portal capture, relevance ranking, and rep focus.',
    location: 'Workshop Studio',
    startsAt: '2026-05-20T15:00:00.000Z',
    endsAt: '2026-05-20T15:45:00.000Z',
    speakers: [
      { fullName: 'Mateo Garcia', title: 'Senior Solutions Architect', companyName: 'BluePeak Systems', email: 'mateo@bluepeaksystems.com' },
      { fullName: 'Owen Brooks', title: 'GTM Lead', companyName: 'Helio Health', email: 'owen@heliohealth.com' }
    ]
  }
];

export const DEMO_HUBSPOT_DIRECTORY: HubSpotDirectoryRecord[] = [
  {
    id: 'hs_contact_1001',
    email: 'avery@signalworks.io',
    companyDomain: 'signalworks.io',
    companyName: 'SignalWorks'
  },
  {
    id: 'hs_contact_1002',
    email: 'maya@streamforge.io',
    companyDomain: 'streamforge.io',
    companyName: 'StreamForge'
  },
  {
    id: 'hs_contact_1003',
    email: 'chloe@ledgerlane.co',
    companyDomain: 'ledgerlane.co',
    companyName: 'LedgerLane'
  },
  {
    id: 'hs_contact_1004',
    email: 'jordan@northstarbio.com',
    companyDomain: 'northstarbio.com',
    companyName: 'Northstar Bio'
  }
];
