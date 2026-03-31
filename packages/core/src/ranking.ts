import type { Person, RankedSession, Session, Target } from './types';

function titleAndDescription(session: Session): string {
  return `${session.title} ${session.description ?? ''}`.toLowerCase();
}

export function rankSessions(params: {
  sessions: Session[];
  persons: Person[];
  targets: Target[];
}): RankedSession[] {
  const { sessions, persons, targets } = params;
  const targetPersonIds = new Set(targets.map((target) => target.personId));

  return sessions
    .map<RankedSession>((session) => {
      let score = 0;
      const reasons: string[] = [];

      const speakers = session.speakerPersonIds
        .map((speakerId) => persons.find((person) => person.id === speakerId))
        .filter((person): person is Person => Boolean(person));

      const speakerNames = speakers.map((speaker) => speaker.fullName);
      const text = titleAndDescription(session);

      const targetSpeakers = speakers.filter((speaker) => targetPersonIds.has(speaker.id));
      if (targetSpeakers.length > 0) {
        score += 50;
        reasons.push(`Target speaker: ${targetSpeakers.map((speaker) => speaker.fullName).join(', ')}`);
      }

      for (const keyword of ['revenue', 'pipeline', 'follow-up', 'revops', 'conference', 'event']) {
        if (text.includes(keyword)) {
          score += 8;
          reasons.push(`Relevant keyword: ${keyword}`);
        }
      }

      if (session.location?.toLowerCase().includes('stage')) {
        score += 3;
        reasons.push('High-visibility stage session');
      }

      return {
        ...session,
        score,
        reasons: Array.from(new Set(reasons)),
        speakerNames
      };
    })
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title));
}
