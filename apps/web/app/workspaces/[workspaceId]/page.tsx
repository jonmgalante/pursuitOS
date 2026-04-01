import type { Encounter, Person, Target, TargetPriority, TargetStatus } from '@copilot/core';
import { getFirstSliceService } from '../../../lib/services/first-slice-service';

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

function targetStatusMeta(status: TargetStatus) {
  if (status === 'MET') {
    return { className: 'badge success', label: 'Met' };
  }

  if (status === 'MISSED') {
    return { className: 'badge danger', label: 'Missed' };
  }

  return { className: 'badge no-action', label: 'Targeted' };
}

function statusBadge(status: TargetStatus) {
  const meta = targetStatusMeta(status);
  return <span className={meta.className}>{meta.label}</span>;
}

function followUpMeta(options: {
  status: TargetStatus;
  hasDraft: boolean;
  hasTask: boolean;
  gmailSynced: boolean;
  hubspotSynced: boolean;
}) {
  if (options.status === 'TARGETED') {
    return { className: 'badge no-action', label: 'No action' };
  }

  if (!options.hasDraft || !options.hasTask || !options.gmailSynced || !options.hubspotSynced) {
    return { className: 'badge follow-up', label: 'Needs follow-up' };
  }

  return { className: 'badge success', label: 'Queue ready' };
}

function priorityLabel(priority: TargetPriority) {
  return priority.toLowerCase().replaceAll('_', ' ');
}

function priorityCardClass(priority: TargetPriority) {
  if (priority === 'MUST_MEET') {
    return 'must-meet';
  }

  if (priority === 'NICE_TO_MEET') {
    return 'nice-to-meet';
  }

  return 'backup';
}

function priorityPillClass(priority: TargetPriority) {
  if (priority === 'MUST_MEET') {
    return 'pill must-meet';
  }

  return 'pill';
}

function targetForPerson(targets: Target[], personId: string) {
  return targets.find((target) => target.personId === personId);
}

function companyName(person: Person, companies: Array<{ id: string; name: string }>) {
  return companies.find((company) => company.id === person.companyId)?.name ?? '—';
}

function personNameById(persons: Person[], id: string) {
  return persons.find((person) => person.id === id)?.fullName ?? 'Unknown speaker';
}

function sessionTitleById(sessions: Array<{ id: string; title: string }>, id?: string) {
  return id ? sessions.find((session) => session.id === id)?.title : undefined;
}

function encounterOutcome(encounter: Encounter, targets: Target[]): Encounter['outcome'] {
  if (encounter.outcome) {
    return encounter.outcome;
  }

  const target = encounter.targetId ? targets.find((item) => item.id === encounter.targetId) : undefined;
  return target?.status === 'MET' || target?.status === 'MISSED' ? target.status : undefined;
}

export default async function WorkspacePage({
  params
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const view = await getFirstSliceService().getWorkspaceView(workspaceId);
  const {
    workspace,
    event,
    persons,
    companies,
    sessions,
    targets,
    encounters,
    drafts,
    tasks,
    captureBatches,
    auditLogs
  } = view.workspace;

  const hubspotMatches = persons.filter((person) => person.hubspotContactId).length;
  const recentEncounterFeed = encounters
    .slice()
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  const sortedCaptureBatches = captureBatches
    .slice()
    .sort((left, right) => Date.parse(right.capturedAt) - Date.parse(left.capturedAt));
  const recentAuditEntries = auditLogs
    .slice()
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, 6);
  const draftByPersonId = new Map(drafts.map((draft) => [draft.personId, draft] as const));
  const taskByPersonId = new Map(tasks.map((task) => [task.personId, task] as const));

  const groupedTargets: Record<TargetPriority, Target[]> = {
    MUST_MEET: targets
      .filter((target) => target.priority === 'MUST_MEET')
      .sort((left, right) => {
        const statusDiff = targetStatusRank[left.status] - targetStatusRank[right.status];
        if (statusDiff !== 0) {
          return statusDiff;
        }

        const leftPerson = persons.find((person) => person.id === left.personId)?.fullName ?? '';
        const rightPerson = persons.find((person) => person.id === right.personId)?.fullName ?? '';
        return leftPerson.localeCompare(rightPerson);
      }),
    NICE_TO_MEET: targets
      .filter((target) => target.priority === 'NICE_TO_MEET')
      .sort((left, right) => {
        const statusDiff = targetStatusRank[left.status] - targetStatusRank[right.status];
        if (statusDiff !== 0) {
          return statusDiff;
        }

        const leftPerson = persons.find((person) => person.id === left.personId)?.fullName ?? '';
        const rightPerson = persons.find((person) => person.id === right.personId)?.fullName ?? '';
        return leftPerson.localeCompare(rightPerson);
      }),
    BACKUP: targets
      .filter((target) => target.priority === 'BACKUP')
      .sort((left, right) => {
        const statusDiff = targetStatusRank[left.status] - targetStatusRank[right.status];
        if (statusDiff !== 0) {
          return statusDiff;
        }

        const leftPerson = persons.find((person) => person.id === left.personId)?.fullName ?? '';
        const rightPerson = persons.find((person) => person.id === right.personId)?.fullName ?? '';
        return leftPerson.localeCompare(rightPerson);
      })
  };

  const mustMeetOpen = groupedTargets.MUST_MEET.filter((target) => target.status === 'TARGETED').length;
  const latestEncounter = recentEncounterFeed[0];
  const latestEncounterPerson = latestEncounter
    ? persons.find((person) => person.id === latestEncounter.personId)
    : undefined;
  const topSession = view.rankedSessions[0];
  const pendingDrafts = drafts.filter((draft) => !draft.gmailDraftId).length;
  const pendingTasks = tasks.filter((task) => !task.hubspotTaskId).length;

  const followUpTargets = targets
    .filter((target) => target.status === 'MET' || target.status === 'MISSED')
    .sort((left, right) => {
      const priorityDiff = targetPriorityRank[left.priority] - targetPriorityRank[right.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return targetStatusRank[left.status] - targetStatusRank[right.status];
    })
    .map((target) => {
      const person = persons.find((item) => item.id === target.personId);
      if (!person) {
        return null;
      }

      const draft = draftByPersonId.get(person.id);
      const task = taskByPersonId.get(person.id);

      return {
        target,
        person,
        draft,
        task,
        followUp: followUpMeta({
          status: target.status,
          hasDraft: Boolean(draft),
          hasTask: Boolean(task),
          gmailSynced: Boolean(draft?.gmailDraftId),
          hubspotSynced: Boolean(task?.hubspotTaskId)
        })
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const nextActionItems = followUpTargets.filter(
    (item) => !item.draft || !item.task || !item.draft.gmailDraftId || !item.task.hubspotTaskId
  );

  return (
    <div className="workspace-page grid">
      <section className="card shell-panel-card workspace-hero">
        <div className="workspace-hero-main">
          <div className="workspace-hero-copy">
            <p className="section-eyebrow shell">Event overview</p>
            <h2>{workspace.name}</h2>
            <p>
              {event.name} · {event.city} · {workspace.portalProvider} · current mode{' '}
              {workspace.mode.toLowerCase()}
            </p>

            <div className="pill-list workspace-hero-metadata">
              <span className="badge shell">{persons.length} people</span>
              <span className="badge shell">{view.rankedSessions.length} sessions</span>
              <span className="badge shell">{hubspotMatches} HubSpot matches</span>
            </div>
          </div>

          <div className="button-row workspace-hero-actions">
            <a className="button-link" href={`/workspaces/${workspace.id}/field`}>
              Open field mode
            </a>
            <a className="button-link shell" href="/demo/grip/attendees">
              Capture demo attendees
            </a>
            <a className="button-link shell" href="/demo/grip/sessions">
              Capture demo sessions
            </a>
            <a className="button-link shell" href="/demo/grip/attendees/avery-chen">
              Capture attendee profile
            </a>
          </div>
        </div>

        <div className="question-strip workspace-summary-strip">
          <div className="question-card shell action">
            <p className="question-label">Who should I meet?</p>
            <p className="question-value">
              {mustMeetOpen > 0 ? `${mustMeetOpen} must meet open` : 'Target board ready'}
            </p>
            <p className="question-detail">
              {targets.length > 0
                ? `${targets.length} total Targets across must meet, nice to meet, and backup.`
                : 'Mark captured people as Targets to start the board.'}
            </p>
          </div>

          <div className="question-card shell insight">
            <p className="question-label">Where should I go?</p>
            <p className="question-value">
              {topSession ? topSession.title : 'Capture sessions to rank the floor'}
            </p>
            <p className="question-detail">
              {view.rankedSessions.length > 0
                ? `${view.rankedSessions.length} session recommendations are available.`
                : 'Session intelligence activates after the sessions fixture is captured.'}
            </p>
          </div>

          <div className="question-card shell neutral">
            <p className="question-label">What just happened?</p>
            <p className="question-value">
              {latestEncounterPerson ? latestEncounterPerson.fullName : 'No encounter activity yet'}
            </p>
            <p className="question-detail">
              {latestEncounter
                ? `Latest note: ${new Date(latestEncounter.createdAt).toLocaleString()}`
                : 'Use the quick encounter note or field mode to record the latest interaction.'}
            </p>
          </div>

          <div className="question-card shell action">
            <p className="question-label">What should I do next?</p>
            <p className="question-value">
              {nextActionItems.length > 0
                ? `${nextActionItems.length} follow-up actions open`
                : 'No open next actions'}
            </p>
            <p className="question-detail">
              {nextActionItems.length > 0
                ? 'Generate drafts and sync tasks for met or missed Targets.'
                : 'The follow-up queue is clear for the current workspace.'}
            </p>
          </div>

          <div className="question-card shell action">
            <p className="question-label">What should I send?</p>
            <p className="question-value">
              {drafts.length > 0 ? `${drafts.length} draft${drafts.length === 1 ? '' : 's'} ready` : 'No draft queue yet'}
            </p>
            <p className="question-detail">
              {pendingDrafts > 0
                ? `${pendingDrafts} Gmail draft${pendingDrafts === 1 ? '' : 's'} still need sync.`
                : 'Generate a draft from an encounter or Target to populate the send queue.'}
            </p>
          </div>
        </div>
      </section>

      <div className="workspace-dashboard">
        <div className="workspace-primary-column">
          <section className="card workspace-section">
            <div className="section-header">
              <div className="section-title-stack">
                <p className="section-eyebrow">Who should I meet?</p>
                <h2>Target board</h2>
                <p className="muted">
                  Keep must meet, nice to meet, and backup Targets visible with status and follow-up
                  state attached.
                </p>
              </div>
              <span className={mustMeetOpen > 0 ? 'badge must-meet' : 'badge no-action'}>
                {mustMeetOpen > 0 ? `${mustMeetOpen} must meet open` : 'No urgent Target gap'}
              </span>
            </div>

            <div className="workspace-target-columns">
              {(['MUST_MEET', 'NICE_TO_MEET', 'BACKUP'] as const).map((priority) => (
                <div
                  key={priority}
                  className={`target-lane ${priorityCardClass(priority)}`}
                >
                  <div className="target-lane-header">
                    <div className="section-title-stack">
                      <span className={priorityPillClass(priority)}>{priorityLabel(priority)}</span>
                      <h3>{priorityLabel(priority)} Targets</h3>
                    </div>
                    <span className="badge neutral">
                      {groupedTargets[priority].length}{' '}
                      {groupedTargets[priority].length === 1 ? 'Target' : 'Targets'}
                    </span>
                  </div>

                  <div className="stack">
                    {groupedTargets[priority].length === 0 ? (
                      <div className="empty-state">No Targets in this lane yet.</div>
                    ) : (
                      groupedTargets[priority].map((target) => {
                        const person = persons.find((item) => item.id === target.personId);
                        if (!person) {
                          return null;
                        }

                        const draft = draftByPersonId.get(person.id);
                        const task = taskByPersonId.get(person.id);
                        const followUp = followUpMeta({
                          status: target.status,
                          hasDraft: Boolean(draft),
                          hasTask: Boolean(task),
                          gmailSynced: Boolean(draft?.gmailDraftId),
                          hubspotSynced: Boolean(task?.hubspotTaskId)
                        });

                        return (
                          <div
                            key={target.id}
                            className={`target-card ${priorityCardClass(target.priority)}`}
                          >
                            <div className="target-card-header">
                              <div className="target-card-copy">
                                <h3>{person.fullName}</h3>
                                <p className="muted">
                                  {person.title ?? '—'} · {companyName(person, companies)}
                                </p>
                              </div>
                              <div className="target-status-row">
                                {statusBadge(target.status)}
                                <span className={followUp.className}>{followUp.label}</span>
                              </div>
                            </div>

                            <div className="pill-list">
                              <span className={priorityPillClass(target.priority)}>{priorityLabel(target.priority)}</span>
                              {person.isAttendee ? <span className="pill">Attendee</span> : null}
                              {person.isSpeaker ? <span className="pill insight">Speaker</span> : null}
                            </div>

                            <div className="target-card-actions">
                              <form className="inline" action="/api/targets" method="post">
                                <input type="hidden" name="workspaceId" value={workspace.id} />
                                <input type="hidden" name="personId" value={person.id} />
                                <input type="hidden" name="intent" value="status" />
                                <input type="hidden" name="status" value="TARGETED" />
                                <input type="hidden" name="redirectTo" value={`/workspaces/${workspace.id}`} />
                                <button type="submit" className="secondary">
                                  Targeted
                                </button>
                              </form>
                              <form className="inline" action="/api/targets" method="post">
                                <input type="hidden" name="workspaceId" value={workspace.id} />
                                <input type="hidden" name="personId" value={person.id} />
                                <input type="hidden" name="intent" value="status" />
                                <input type="hidden" name="status" value="MET" />
                                <input type="hidden" name="redirectTo" value={`/workspaces/${workspace.id}`} />
                                <button type="submit" className="success">
                                  Met
                                </button>
                              </form>
                              <form className="inline" action="/api/targets" method="post">
                                <input type="hidden" name="workspaceId" value={workspace.id} />
                                <input type="hidden" name="personId" value={person.id} />
                                <input type="hidden" name="intent" value="status" />
                                <input type="hidden" name="status" value="MISSED" />
                                <input type="hidden" name="redirectTo" value={`/workspaces/${workspace.id}`} />
                                <button type="submit" className="danger">
                                  Missed
                                </button>
                              </form>
                            </div>

                            <div className="target-secondary-actions">
                              <form className="inline" action="/api/drafts/generate" method="post">
                                <input type="hidden" name="workspaceId" value={workspace.id} />
                                <input type="hidden" name="personId" value={person.id} />
                                <input type="hidden" name="redirectTo" value={`/workspaces/${workspace.id}`} />
                                <button type="submit" className="secondary">
                                  Generate draft
                                </button>
                              </form>
                              <form className="inline" action="/api/sync/hubspot/task" method="post">
                                <input type="hidden" name="workspaceId" value={workspace.id} />
                                <input type="hidden" name="personId" value={person.id} />
                                <input type="hidden" name="redirectTo" value={`/workspaces/${workspace.id}`} />
                                <button type="submit" className="secondary">
                                  sync HubSpot task
                                </button>
                              </form>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card workspace-section">
            <div className="section-header">
              <div className="section-title-stack">
                <p className="section-eyebrow">Target intake</p>
                <h2>Captured people</h2>
                <p className="muted">
                  Promote captured attendees and speakers into the Target board while keeping
                  deterministic match visibility.
                </p>
              </div>
              <span className="badge neutral">{persons.length} people</span>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Company</th>
                    <th>HubSpot</th>
                    <th>Target actions</th>
                  </tr>
                </thead>
                <tbody>
                  {persons.map((person) => {
                    const target = targetForPerson(targets, person.id);
                    return (
                      <tr key={person.id}>
                        <td>
                          <strong>{person.fullName}</strong>
                          <div className="pill-list">
                            {person.isAttendee ? <span className="pill">Attendee</span> : null}
                            {person.isSpeaker ? <span className="pill insight">Speaker</span> : null}
                            {target ? statusBadge(target.status) : <span className="badge no-action">No action</span>}
                          </div>
                        </td>
                        <td>{person.title ?? '—'}</td>
                        <td>{companyName(person, companies)}</td>
                        <td>
                          {person.hubspotContactId ? (
                            <span className="badge success">{person.matchMethod.toLowerCase()}</span>
                          ) : (
                            <span className="badge no-action">No deterministic match</span>
                          )}
                        </td>
                        <td>
                          <div className="inline-actions">
                            {(['MUST_MEET', 'NICE_TO_MEET', 'BACKUP'] as const).map((priority) => (
                              <form key={priority} className="inline" action="/api/targets" method="post">
                                <input type="hidden" name="workspaceId" value={workspace.id} />
                                <input type="hidden" name="personId" value={person.id} />
                                <input type="hidden" name="priority" value={priority} />
                                <input type="hidden" name="redirectTo" value={`/workspaces/${workspace.id}`} />
                                <button type="submit" className="secondary">
                                  {priorityLabel(priority)}
                                </button>
                              </form>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card workspace-section">
            <div className="section-header">
              <div className="section-title-stack">
                <p className="section-eyebrow">What just happened?</p>
                <h2>Recent encounters</h2>
                <p className="muted">
                  Log a quick note in place or confirm the latest interaction before moving into
                  the follow-up queue.
                </p>
              </div>
              <a className="inline-link" href={`/workspaces/${workspace.id}/field`}>
                Open field mode
              </a>
            </div>

            <div className="encounter-section-grid">
              <div className="queue-card">
                <div className="section-header compact">
                  <div className="section-title-stack">
                    <h3>Quick encounter note</h3>
                    <p className="muted small">
                      Need the faster in-event flow? Field mode stays available, but this keeps the
                      note flow on the main workspace.
                    </p>
                  </div>
                </div>

                <form action="/api/encounters" method="post" className="stack">
                  <input type="hidden" name="workspaceId" value={workspace.id} />
                  <input type="hidden" name="redirectTo" value={`/workspaces/${workspace.id}`} />

                  <div>
                    <label htmlFor="personId">Target</label>
                    <select id="personId" name="personId" required>
                      <option value="">Select a target</option>
                      {targets.map((target) => {
                        const person = persons.find((item) => item.id === target.personId);
                        if (!person) {
                          return null;
                        }
                        return (
                          <option key={target.id} value={person.id}>
                            {person.fullName} — {priorityLabel(target.priority)}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="noteText">What happened?</label>
                    <textarea
                      id="noteText"
                      name="noteText"
                      defaultValue="Met at the AI ROI session. Interested in a short demo next week and asked for a pricing overview."
                      required
                    />
                  </div>

                  <div>
                    <label>One-tap tags</label>
                    <div className="tag-row">
                      {['demo', 'pricing', 'speaker', 'integration', 'follow-up'].map((tag) => (
                        <label key={tag} className="pill">
                          <input type="checkbox" name="tags" value={tag} /> {tag}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="capturedVia">Captured via</label>
                    <select id="capturedVia" name="capturedVia" defaultValue="MANUAL">
                      <option value="MANUAL">Manual</option>
                      <option value="VOICE">Voice</option>
                    </select>
                  </div>

                  <button type="submit">Log encounter</button>
                </form>
              </div>

              <div className="workspace-feed">
                {recentEncounterFeed.length === 0 ? (
                  <div className="empty-state">No encounter notes yet.</div>
                ) : (
                  recentEncounterFeed.map((encounter) => {
                    const person = persons.find((item) => item.id === encounter.personId);
                    const outcome = encounterOutcome(encounter, targets);
                    return (
                      <div key={encounter.id} className="encounter-card">
                        <div className="queue-card-header">
                          <div>
                            <h3>{person?.fullName ?? 'Unknown person'}</h3>
                            <p className="muted small">
                              {new Date(encounter.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="target-status-row">
                            {outcome ? (
                              <span
                                className={
                                  outcome === 'MET' ? 'badge success' : 'badge danger'
                                }
                              >
                                {outcome === 'MET' ? 'Met' : 'Missed'}
                              </span>
                            ) : (
                              <span className="badge no-action">No action</span>
                            )}
                          </div>
                        </div>

                        <p>{encounter.noteText}</p>
                        <div className="pill-list">
                          {encounter.sessionId ? (
                            <span className="pill insight">
                              Session: {sessionTitleById(sessions, encounter.sessionId) ?? 'Unknown session'}
                            </span>
                          ) : null}
                          {encounter.speakerPersonId ? (
                            <span className="pill insight">
                              Speaker: {personNameById(persons, encounter.speakerPersonId)}
                            </span>
                          ) : null}
                          {encounter.tags.map((tag) => (
                            <span key={tag} className="pill">
                              {tag}
                            </span>
                          ))}
                        </div>
                        <p className="muted small">Summary: {encounter.structuredSummary}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        </div>

        <div className="workspace-side-column">
          <section className="card workspace-section">
            <div className="section-header">
              <div className="section-title-stack">
                <p className="section-eyebrow">Event overview</p>
                <h2>Workspace intake</h2>
                <p className="muted">
                  Keep the current event context, capture volume, and deterministic matching in one
                  place.
                </p>
              </div>
              <span className="badge neutral">
                {captureBatches.length} {captureBatches.length === 1 ? 'batch' : 'batches'}
              </span>
            </div>

            <div className="question-strip workspace-meta-grid">
              <div className="question-card neutral">
                <p className="question-label">Event</p>
                <p className="question-value">{event.name}</p>
                <p className="question-detail">
                  {event.city} · {workspace.portalProvider}
                </p>
              </div>
              <div className="question-card neutral">
                <p className="question-label">People and sessions</p>
                <p className="question-value">
                  {persons.length} people · {sessions.length} sessions
                </p>
                <p className="question-detail">Capture batches preserve page-level provenance and artifacts.</p>
              </div>
              <div className="question-card neutral">
                <p className="question-label">Matching</p>
                <p className="question-value">{hubspotMatches} HubSpot matches</p>
                <p className="question-detail">Deterministic matching remains visible inside the workspace.</p>
              </div>
            </div>

            <div className="capture-batch-list">
              {sortedCaptureBatches.length === 0 ? (
                <div className="empty-state">No capture batches yet. Use the extension on the demo Grip pages.</div>
              ) : (
                sortedCaptureBatches.map((batch) => (
                  <div key={batch.id} className="capture-batch-card">
                    <h3>{batch.pageTitle || batch.pageType}</h3>
                    <p className="muted small">
                      {batch.pageType} · {batch.recordCount} records ·{' '}
                      {new Date(batch.capturedAt).toLocaleString()}
                    </p>
                    <p className="small">{batch.pageUrl}</p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="card workspace-section workspace-session-section">
            <div className="section-header">
              <div className="section-title-stack">
                <p className="section-eyebrow">Where should I go?</p>
                <h2>Session intelligence</h2>
                <p className="muted">
                  Use speaker and reason signals to decide which session matters next.
                </p>
              </div>
              <span className={view.rankedSessions.length > 0 ? 'badge insight' : 'badge no-action'}>
                {view.rankedSessions.length > 0 ? `${view.rankedSessions.length} sessions ranked` : 'Awaiting sessions'}
              </span>
            </div>

            <div className="session-stack">
              {view.rankedSessions.length === 0 ? (
                <div className="empty-state">Capture the sessions demo page to populate session intelligence.</div>
              ) : (
                view.rankedSessions.map((session) => (
                  <div key={session.id} className="session-card">
                    <div className="session-card-header">
                      <div>
                        <h3>{session.title}</h3>
                        <p className="muted small">
                          {session.location ?? '—'} ·{' '}
                          {session.startsAt ? new Date(session.startsAt).toLocaleString() : 'TBD'}
                        </p>
                      </div>
                      <span className="session-score">Score {session.score}</span>
                    </div>

                    <div className="pill-list">
                      {session.speakerNames.map((speaker) => (
                        <span key={`${session.id}-${speaker}`} className="pill insight">
                          {speaker}
                        </span>
                      ))}
                    </div>

                    <ul className="session-reasons">
                      {session.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="card workspace-section">
            <div className="section-header">
              <div className="section-title-stack">
                <p className="section-eyebrow">What should I do next?</p>
                <h2>Follow-up queue</h2>
                <p className="muted">
                  Promote the next draft, Gmail sync, and HubSpot task from one queue.
                </p>
              </div>
              <span className={nextActionItems.length > 0 ? 'badge follow-up' : 'badge no-action'}>
                {nextActionItems.length > 0
                  ? `${nextActionItems.length} actions open`
                  : 'No open queue'}
              </span>
            </div>

            <div className="queue-stack">
              <div className="queue-group">
                <div className="section-header compact">
                  <div className="section-title-stack">
                    <h3>Open next actions</h3>
                    <p className="muted small">Generate the draft, then sync Gmail and HubSpot where needed.</p>
                  </div>
                </div>

                {nextActionItems.length === 0 ? (
                  <div className="empty-state">No open follow-up actions yet.</div>
                ) : (
                  nextActionItems.map((item) => (
                    <div key={item.target.id} className="queue-card needs-follow-up">
                      <div className="queue-card-header">
                        <div>
                          <h3>{item.person.fullName}</h3>
                          <p className="muted small">
                            {item.person.title ?? '—'} · {companyName(item.person, companies)}
                          </p>
                        </div>
                        <div className="target-status-row">
                          <span className={priorityPillClass(item.target.priority)}>
                            {priorityLabel(item.target.priority)}
                          </span>
                          {statusBadge(item.target.status)}
                          <span className={item.followUp.className}>{item.followUp.label}</span>
                        </div>
                      </div>

                      <p className="small">
                        Draft:{' '}
                        {item.draft
                          ? item.draft.gmailDraftId
                            ? 'Gmail synced'
                            : 'Draft ready to sync'
                          : 'Draft not generated'}{' '}
                        · HubSpot:{' '}
                        {item.task
                          ? item.task.hubspotTaskId
                            ? 'Task synced'
                            : 'Task ready to sync'
                          : 'Task not created'}
                      </p>

                      <div className="queue-card-actions">
                        {!item.draft ? (
                          <form className="inline" action="/api/drafts/generate" method="post">
                            <input type="hidden" name="workspaceId" value={workspace.id} />
                            <input type="hidden" name="personId" value={item.person.id} />
                            <input type="hidden" name="redirectTo" value={`/workspaces/${workspace.id}`} />
                            <button type="submit">Generate draft</button>
                          </form>
                        ) : !item.draft.gmailDraftId ? (
                          <form className="inline" action="/api/sync/gmail/draft" method="post">
                            <input type="hidden" name="workspaceId" value={workspace.id} />
                            <input type="hidden" name="draftId" value={item.draft.id} />
                            <input type="hidden" name="redirectTo" value={`/workspaces/${workspace.id}`} />
                            <button type="submit">Sync Gmail draft</button>
                          </form>
                        ) : null}

                        {!item.task || !item.task.hubspotTaskId ? (
                          <form className="inline" action="/api/sync/hubspot/task" method="post">
                            <input type="hidden" name="workspaceId" value={workspace.id} />
                            <input type="hidden" name="personId" value={item.person.id} />
                            <input type="hidden" name="redirectTo" value={`/workspaces/${workspace.id}`} />
                            <button type="submit" className="secondary">
                              Sync HubSpot task
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="queue-group">
                <div className="section-header compact">
                  <div className="section-title-stack">
                    <h3>What should I send?</h3>
                    <p className="muted small">Draft queue ready for Gmail sync when follow-up copy is available.</p>
                  </div>
                  <span className={pendingDrafts > 0 ? 'badge follow-up' : 'badge neutral'}>
                    {drafts.length} {drafts.length === 1 ? 'draft' : 'drafts'}
                  </span>
                </div>

                {drafts.length === 0 ? (
                  <div className="empty-state">Generate a draft from an encounter to populate this queue.</div>
                ) : (
                  drafts.map((draft) => {
                    const person = persons.find((item) => item.id === draft.personId);
                    return (
                      <div
                        key={draft.id}
                        className={`queue-card ${draft.gmailDraftId ? 'complete' : 'needs-follow-up'}`}
                      >
                        <div className="queue-card-header">
                          <div>
                            <h3>{draft.subject}</h3>
                            <p className="muted small">{person?.fullName ?? 'Unknown person'}</p>
                          </div>
                          <div className="target-status-row">
                            <span className={draft.gmailDraftId ? 'badge success' : 'badge follow-up'}>
                              {draft.gmailDraftId ? 'Gmail synced' : 'Needs follow-up'}
                            </span>
                          </div>
                        </div>

                        <p className="small">{draft.summary}</p>
                        <pre className="small">{draft.body}</pre>

                        {!draft.gmailDraftId ? (
                          <div className="queue-card-actions">
                            <form className="inline" action="/api/sync/gmail/draft" method="post">
                              <input type="hidden" name="workspaceId" value={workspace.id} />
                              <input type="hidden" name="draftId" value={draft.id} />
                              <input type="hidden" name="redirectTo" value={`/workspaces/${workspace.id}`} />
                              <button type="submit">Sync Gmail draft</button>
                            </form>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="queue-group">
                <div className="section-header compact">
                  <div className="section-title-stack">
                    <h3>HubSpot task queue</h3>
                    <p className="muted small">Keep task sync visible next to the same person-level follow-up path.</p>
                  </div>
                  <span className={pendingTasks > 0 ? 'badge follow-up' : 'badge neutral'}>
                    {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
                  </span>
                </div>

                {tasks.length === 0 ? (
                  <div className="empty-state">No HubSpot tasks synced yet.</div>
                ) : (
                  tasks.map((task) => {
                    const person = persons.find((item) => item.id === task.personId);
                    return (
                      <div
                        key={task.id}
                        className={`queue-card ${task.hubspotTaskId ? 'complete' : 'needs-follow-up'}`}
                      >
                        <div className="queue-card-header">
                          <div>
                            <h3>{task.title}</h3>
                            <p className="muted small">{person?.fullName ?? 'Unknown person'}</p>
                          </div>
                          <span className={task.hubspotTaskId ? 'badge success' : 'badge follow-up'}>
                            {task.hubspotTaskId ? 'HubSpot synced' : 'Needs follow-up'}
                          </span>
                        </div>
                        <p className="small">{task.body}</p>
                        {!task.hubspotTaskId ? (
                          <div className="queue-card-actions">
                            <form className="inline" action="/api/sync/hubspot/task" method="post">
                              <input type="hidden" name="workspaceId" value={workspace.id} />
                              <input type="hidden" name="personId" value={task.personId} />
                              <input type="hidden" name="redirectTo" value={`/workspaces/${workspace.id}`} />
                              <button type="submit" className="secondary">
                                Sync HubSpot task
                              </button>
                            </form>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>

          <section className="card workspace-section">
            <div className="section-header">
              <div className="section-title-stack">
                <p className="section-eyebrow">Audit log</p>
                <h2>Recent audit activity</h2>
                <p className="muted">
                  Preserve a visible trail of capture and sync actions tied to the workspace.
                </p>
              </div>
            </div>

            <div className="compact-feed">
              {recentAuditEntries.length === 0 ? (
                <div className="empty-state">No audit entries yet.</div>
              ) : (
                recentAuditEntries.map((entry) => (
                  <div key={entry.id} className="compact-feed-row">
                    <strong>{entry.action}</strong>
                    <p className="muted small">
                      {entry.entityType} · {entry.entityId} · {new Date(entry.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
