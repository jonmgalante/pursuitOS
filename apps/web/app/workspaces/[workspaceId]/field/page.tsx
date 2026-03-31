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
  return <span className={status === 'MET' ? 'badge success' : 'badge danger'}>{status.toLowerCase()}</span>;
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

  if (persons.length === 0) {
    return (
      <div className="grid">
        <section className="card">
          <h2>Field mode</h2>
          <p className="muted">
            Capture attendees or sessions first, then use field mode to log fast in-event updates.
          </p>
          <div className="button-row">
            <a className="button-link secondary" href={workspacePath}>
              Main workspace
            </a>
            <a className="button-link secondary" href="/demo/grip/attendees">
              Capture demo attendees
            </a>
            <a className="button-link secondary" href="/demo/grip/sessions">
              Capture demo sessions
            </a>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="grid">
      <section className="card field-hero">
        <div>
          <h2>{workspace.name} field mode</h2>
          <p className="muted">
            {event.name} · {event.city} · optimized for fast in-event capture on mobile or desktop.
          </p>
        </div>
        <div className="button-row">
          <a className="button-link secondary" href={workspacePath}>
            Main workspace
          </a>
        </div>
      </section>

      {saved ? (
        <section className="card field-feedback">
          <strong>Saved.</strong>
          <p className="muted">
            {selectedPersonName ? `${selectedPersonName} was updated and the latest activity is below.` : 'The encounter was saved and you are still in field mode.'}
          </p>
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

      <section className="card">
        <div className="field-panel-header">
          <div>
            <h2>Recent activity</h2>
            <p className="muted">Confirm the latest capture without leaving field mode.</p>
          </div>
        </div>
        <div className="stack">
          {recentActivity.length === 0 ? (
            <p className="muted">No encounter activity yet.</p>
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
                      {outcome ? statusBadge(outcome) : null}
                    </div>
                  </div>
                  <p>{encounter.noteText}</p>
                  <div className="pill-list">
                    {sessionTitle ? <span className="pill">session: {sessionTitle}</span> : null}
                    {speakerName ? <span className="pill">speaker: {speakerName}</span> : null}
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
