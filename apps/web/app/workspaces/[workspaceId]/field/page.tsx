import type { Encounter, Person, Session, Target, TargetPriority, TargetStatus } from '@copilot/core';
import { getFirstSliceService } from '../../../../lib/services/first-slice-service';
import {
  FieldModeForm,
  type FieldModePersonOption,
  type FieldModeSessionOption
} from './field-mode-form';

export const dynamic = 'force-dynamic';

const targetPriorityRank: Record<TargetPriority, number> = {
  MUST_MEET: 0,
  NICE_TO_MEET: 1,
  BACKUP: 2
};

const targetStatusRank: Record<TargetStatus, number> = {
  TARGETED: 0,
  MET: 1,
  MISSED: 2
};

function priorityLabel(priority: TargetPriority) {
  return priority.toLowerCase().replaceAll('_', ' ');
}

function companyName(person: Person, companies: Array<{ id: string; name: string }>) {
  return companies.find((company) => company.id === person.companyId)?.name ?? '—';
}

function targetForPerson(targets: Target[], personId: string) {
  return targets.find((target) => target.personId === personId);
}

function personNameById(persons: Person[], id?: string) {
  if (!id) {
    return undefined;
  }

  return persons.find((person) => person.id === id)?.fullName;
}

function sessionTitleById(sessions: Session[], id?: string) {
  if (!id) {
    return undefined;
  }

  return sessions.find((session) => session.id === id)?.title;
}

function encounterOutcome(encounter: Encounter, targets: Target[]): Encounter['outcome'] {
  if (encounter.outcome) {
    return encounter.outcome;
  }

  const target = encounter.targetId ? targets.find((item) => item.id === encounter.targetId) : undefined;
  return target?.status === 'MET' || target?.status === 'MISSED' ? target.status : undefined;
}

function statusBadge(status: 'MET' | 'MISSED') {
  return <span className={status === 'MET' ? 'badge success' : 'badge danger'}>{status === 'MET' ? 'Met' : 'Missed'}</span>;
}

function readSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
): string | undefined {
  const value = searchParams[key];
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  return undefined;
}

export default async function WorkspaceFieldModePage({
  params,
  searchParams
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workspaceId } = await params;
  const query = await searchParams;
  const view = await getFirstSliceService().getWorkspaceView(workspaceId);
  const { workspace, event, persons, companies, targets, encounters, sessions } = view.workspace;
  const fieldPath = `/workspaces/${workspaceId}/field`;
  const workspacePath = `/workspaces/${workspaceId}`;
  const saved = readSearchParam(query, 'saved') === '1';
  const selectedPersonId = readSearchParam(query, 'personId');
  const selectedSessionId = readSearchParam(query, 'sessionId');

  const recentEncounterRanks = new Map<string, number>();
  encounters.forEach((encounter, index) => {
    if (!recentEncounterRanks.has(encounter.personId)) {
      recentEncounterRanks.set(encounter.personId, index);
    }
  });

  const personOptions: FieldModePersonOption[] = persons
    .map((person) => {
      const target = targetForPerson(targets, person.id);
      return {
        id: person.id,
        fullName: person.fullName,
        title: person.title,
        companyName: companyName(person, companies),
        priorityLabel: target ? priorityLabel(target.priority) : undefined,
        targetStatus: target?.status,
        isSpeaker: person.isSpeaker
      };
    })
    .sort((left, right) => {
      const leftTarget = targetForPerson(targets, left.id);
      const rightTarget = targetForPerson(targets, right.id);

      if (leftTarget && rightTarget) {
        const priorityDiff =
          targetPriorityRank[leftTarget.priority] - targetPriorityRank[rightTarget.priority];
        if (priorityDiff !== 0) {
          return priorityDiff;
        }

        const statusDiff = targetStatusRank[leftTarget.status] - targetStatusRank[rightTarget.status];
        if (statusDiff !== 0) {
          return statusDiff;
        }
      }

      if (leftTarget || rightTarget) {
        return leftTarget ? -1 : 1;
      }

      const leftEncounterRank = recentEncounterRanks.get(left.id) ?? Number.POSITIVE_INFINITY;
      const rightEncounterRank = recentEncounterRanks.get(right.id) ?? Number.POSITIVE_INFINITY;
      if (leftEncounterRank !== rightEncounterRank) {
        return leftEncounterRank - rightEncounterRank;
      }

      return left.fullName.localeCompare(right.fullName);
    });

  const sessionOptions: FieldModeSessionOption[] = sessions
    .map((session) => ({
      id: session.id,
      title: session.title,
      location: session.location,
      startsAt: session.startsAt,
      speakerPersonIds: session.speakerPersonIds
    }))
    .sort((left, right) => left.title.localeCompare(right.title));

  const quickPickPersonIds = Array.from(new Set(personOptions.map((person) => person.id))).slice(0, 8);
  const recentActivity = encounters
    .slice()
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, 8);
  const selectedPersonName = personNameById(persons, selectedPersonId);
  const selectedSessionTitle = sessionTitleById(sessions, selectedSessionId);
  const targetCount = targets.length;
  const mustMeetCount = targets.filter((target) => target.priority === 'MUST_MEET').length;
  const recentCount = recentActivity.length;

  if (persons.length === 0) {
    return (
      <div className="field-page grid">
        <section className="card shell-panel-card field-hero">
          <div className="field-hero-main">
            <div className="field-hero-copy">
              <p className="section-eyebrow shell">Field mode</p>
              <h2>Capture people first, then log the encounter on the move.</h2>
              <p>
                Field mode stays optimized for fast in-event notes, but it needs captured attendees
                or sessions before you can save anything.
              </p>
            </div>
            <div className="button-row field-hero-actions">
              <a className="button-link shell" href={workspacePath}>
                Main workspace
              </a>
              <a className="button-link shell" href="/demo/grip/attendees">
                Capture demo attendees
              </a>
              <a className="button-link shell" href="/demo/grip/sessions">
                Capture demo sessions
              </a>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="field-page grid">
      <section className="card shell-panel-card field-hero">
        <div className="field-hero-main">
          <div className="field-hero-copy">
            <p className="section-eyebrow shell">Field mode</p>
            <h2>{workspace.name} field mode</h2>
            <p>
              {event.name} · {event.city} · optimized for fast, one-handed in-event capture on
              mobile or desktop.
            </p>

            <div className="pill-list field-hero-metadata">
              <span className="badge shell">{persons.length} people</span>
              <span className="badge shell">{targetCount} Targets</span>
              <span className="badge shell">{mustMeetCount} must meet</span>
            </div>
          </div>

          <div className="button-row field-hero-actions">
            <a className="button-link shell" href={workspacePath}>
              Main workspace
            </a>
          </div>
        </div>

        <div className="question-strip field-summary-strip">
          <div className="question-card shell action">
            <p className="question-label">Who should I meet?</p>
            <p className="question-value">
              {selectedPersonName ? selectedPersonName : 'Tap a Target to start'}
            </p>
            <p className="question-detail">
              Quick picks and match results keep the person selection step in reach.
            </p>
          </div>
          <div className="question-card shell neutral">
            <p className="question-label">What just happened?</p>
            <p className="question-value">
              {saved ? 'Latest encounter saved' : 'Ready to log encounter'}
            </p>
            <p className="question-detail">
              {saved
                ? `${selectedPersonName ?? 'The selected person'} was updated and stays in field mode.`
                : 'Capture the note, outcome, tags, and optional context in one pass.'}
            </p>
          </div>
          <div className="question-card shell insight">
            <p className="question-label">Where should I be?</p>
            <p className="question-value">
              {selectedSessionTitle ? selectedSessionTitle : 'Optional session context'}
            </p>
            <p className="question-detail">
              Aqua is reserved for session and speaker context when the encounter ties back to the floor.
            </p>
          </div>
        </div>
      </section>

      {saved ? (
        <section className="card field-feedback">
          <div className="field-feedback-row">
            <div>
              <strong>Saved and still in field mode.</strong>
              <p className="muted">
                {selectedPersonName
                  ? `${selectedPersonName} was updated and the latest activity is below.`
                  : 'The encounter was saved and you are still in field mode.'}
              </p>
            </div>
            <span className="badge success">Met or missed saved</span>
          </div>
        </section>
      ) : null}

      <FieldModeForm
        workspaceId={workspaceId}
        fieldPath={fieldPath}
        workspacePath={workspacePath}
        persons={personOptions}
        quickPickPersonIds={quickPickPersonIds}
        sessions={sessionOptions}
        initialPersonId={selectedPersonId}
        initialSessionId={selectedSessionId}
      />

      <section className="card field-activity-panel">
        <div className="section-header">
          <div className="section-title-stack">
            <p className="section-eyebrow">Recent activity confirmation</p>
            <h2>Recent activity</h2>
            <p className="muted">
              Confirm the last saved encounter without leaving field mode.
            </p>
          </div>
          <span className="badge neutral">
            {recentCount} {recentCount === 1 ? 'entry' : 'entries'}
          </span>
        </div>

        <div className="field-activity-feed">
          {recentActivity.length === 0 ? (
            <div className="empty-state">No encounter activity yet.</div>
          ) : (
            recentActivity.map((encounter) => {
              const person = persons.find((item) => item.id === encounter.personId);
              const target = targetForPerson(targets, encounter.personId);
              const outcome = encounterOutcome(encounter, targets);
              const sessionTitle = sessionTitleById(sessions, encounter.sessionId);
              const speakerName = personNameById(persons, encounter.speakerPersonId);

              return (
                <div key={encounter.id} className="field-activity-card">
                  <div className="field-activity-header">
                    <div>
                      <h3>{person?.fullName ?? 'Unknown person'}</h3>
                      <p className="muted small">
                        {person?.title ?? 'Captured person'} · {person ? companyName(person, companies) : '—'}
                      </p>
                    </div>
                    <div className="pill-list">
                      {target ? <span className="pill">{priorityLabel(target.priority)}</span> : null}
                      {outcome ? statusBadge(outcome) : <span className="badge no-action">No action</span>}
                    </div>
                  </div>
                  <p>{encounter.noteText}</p>
                  <div className="pill-list">
                    {sessionTitle ? <span className="pill insight">Session: {sessionTitle}</span> : null}
                    {speakerName ? <span className="pill insight">Speaker: {speakerName}</span> : null}
                    {encounter.tags.map((tag) => (
                      <span key={`${encounter.id}-${tag}`} className="pill">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="muted small">
                    {new Date(encounter.createdAt).toLocaleString()} · summary: {encounter.structuredSummary}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
