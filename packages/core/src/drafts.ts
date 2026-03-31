import type { Encounter, Event, Person } from './types';

function firstName(fullName: string): string {
  return fullName.split(/\s+/).filter(Boolean)[0] ?? fullName;
}

function extractSummary(noteText: string): string {
  const sentences = noteText
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length === 0) {
    return noteText.trim();
  }

  return sentences.slice(0, 2).join(' ');
}

function inferNextSteps(noteText: string): string[] {
  const lower = noteText.toLowerCase();
  const steps: string[] = [];

  if (lower.includes('demo')) {
    steps.push('Propose a short product demo after the event.');
  }

  if (lower.includes('intro') || lower.includes('introduce')) {
    steps.push('Send the promised introduction.');
  }

  if (lower.includes('follow up') || lower.includes('follow-up')) {
    steps.push('Send the recap and promised follow-up assets.');
  }

  if (lower.includes('pricing') || lower.includes('budget')) {
    steps.push('Share pricing context or the right pricing follow-up path.');
  }

  if (steps.length === 0) {
    steps.push('Send a short recap and propose one concrete next step.');
  }

  return steps;
}

export interface GeneratedDraft {
  subject: string;
  body: string;
  summary: string;
  nextSteps: string[];
}

export interface NormalizedEncounterSummary {
  summary: string;
  nextSteps: string[];
}

export function normalizeEncounterNote(noteText: string): NormalizedEncounterSummary {
  return {
    summary: extractSummary(noteText),
    nextSteps: inferNextSteps(noteText)
  };
}

export function generatePreEventFollowUpDraft(params: {
  event: Event;
  person: Person;
  senderName?: string;
}): GeneratedDraft {
  const { event, person, senderName = 'Your Name' } = params;
  const name = firstName(person.fullName);

  return {
    subject: `Nice to connect before ${event.name}, ${name}`,
    body: [
      `Hi ${name},`,
      '',
      `I noticed you in the attendee list for ${event.name}.`,
      `I would love to connect briefly during the event if it is relevant for ${person.title ?? 'your role'}.`,
      '',
      `If helpful, I can send over a short agenda or suggest a time to meet on-site.`,
      '',
      'Best,',
      senderName
    ].join('\n'),
    summary: 'Pre-event outreach draft generated because no encounter note exists yet.',
    nextSteps: ['Propose a short event meeting or exchange a quick agenda.']
  };
}

export function generateFollowUpDraft(params: {
  event: Event;
  person: Person;
  encounter: Encounter;
  senderName?: string;
}): GeneratedDraft {
  const { event, person, encounter, senderName = 'Your Name' } = params;
  const structuredEncounter = normalizeEncounterNote(encounter.noteText);
  const summary = structuredEncounter.summary;
  const nextSteps = structuredEncounter.nextSteps;
  const name = firstName(person.fullName);
  const bullets = nextSteps.map((step) => `- ${step}`).join('\n');

  const subject = `Great meeting at ${event.name}, ${name}`;

  const body = [
    `Hi ${name},`,
    '',
    `Great meeting you at ${event.name}.`,
    '',
    `I wanted to send a quick recap while the conversation is still fresh:`,
    summary,
    '',
    `Suggested next steps:`,
    bullets,
    '',
    `If useful, I can also send over a tighter follow-up specific to ${person.title ?? 'your role'}.`,
    '',
    `Best,`,
    senderName
  ].join('\n');

  return {
    subject,
    body,
    summary,
    nextSteps
  };
}
