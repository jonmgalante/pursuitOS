import type { Person, Target, TargetPriority, TargetStatus } from '@copilot/core';
import { getFirstSliceService } from '../../../lib/services/first-slice-service';

export const dynamic = 'force-dynamic';

function statusBadge(status: TargetStatus) {
  const className =
    status === 'MET' ? 'badge success' : status === 'MISSED' ? 'badge danger' : 'badge neutral';
  return <span className={className}>{status.toLowerCase()}</span>;
}

function priorityLabel(priority: TargetPriority) {
  return priority.toLowerCase().replaceAll('_', ' ');
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

export default async function WorkspacePage({
  params
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const view = await getFirstSliceService().getWorkspaceView(workspaceId);
  const { workspace, event, persons, companies, targets, encounters, drafts, tasks, captureBatches, auditLogs } =
    view.workspace;

  const groupedTargets: Record<TargetPriority, Target[]> = {
    MUST_MEET: targets.filter((target) => target.priority === 'MUST_MEET'),
    NICE_TO_MEET: targets.filter((target) => target.priority === 'NICE_TO_MEET'),
    BACKUP: targets.filter((target) => target.priority === 'BACKUP')
  };

  return (
    <div className="grid">
      <section className="card">
        <h2>{workspace.name}</h2>
        <p className="muted">
          {event.name} · {event.city} · {workspace.portalProvider} · current mode {workspace.mode.toLowerCase()}
        </p>
        <div className="button-row">
          <a className="button-link secondary" href="/demo/grip/attendees">
            Capture demo attendees
          </a>
          <a className="button-link secondary" href="/demo/grip/sessions">
            Capture demo sessions
          </a>
          <a className="button-link secondary" href="/demo/grip/attendees/avery-chen">
            Capture attendee profile
          </a>
        </div>
      </section>

      <section className="grid three">
        <div className="card">
          <p className="kpi">{persons.length}</p>
          <p className="kpi-label">People in workspace</p>
        </div>
        <div className="card">
          <p className="kpi">{view.rankedSessions.length}</p>
          <p className="kpi-label">Sessions captured</p>
        </div>
        <div className="card">
          <p className="kpi">{targets.length}</p>
          <p className="kpi-label">Targets created</p>
        </div>
        <div className="card">
          <p className="kpi">{targets.filter((target) => target.status === 'MET').length}</p>
          <p className="kpi-label">Met</p>
        </div>
        <div className="card">
          <p className="kpi">{targets.filter((target) => target.status === 'MISSED').length}</p>
          <p className="kpi-label">Missed</p>
        </div>
        <div className="card">
          <p className="kpi">{persons.filter((person) => person.hubspotContactId).length}</p>
          <p className="kpi-label">HubSpot matches</p>
        </div>
      </section>

      <section className="card">
        <h2>Capture batches</h2>
        <div className="stack">
          {captureBatches.length === 0 ? (
            <p className="muted">No capture batches yet. Use the extension on the demo Grip pages.</p>
          ) : (
            captureBatches.map((batch) => (
              <div key={batch.id} className="card">
                <h3>{batch.pageTitle || batch.pageType}</h3>
                <p className="muted">
                  {batch.pageType} · {batch.recordCount} records · {new Date(batch.capturedAt).toLocaleString()}
                </p>
                <p className="small">{batch.pageUrl}</p>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="card">
        <h2>Captured people</h2>
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
                        {person.isAttendee ? <span className="pill">attendee</span> : null}
                        {person.isSpeaker ? <span className="pill">speaker</span> : null}
                        {target ? statusBadge(target.status) : null}
                      </div>
                    </td>
                    <td>{person.title ?? '—'}</td>
                    <td>{companyName(person, companies)}</td>
                    <td>
                      {person.hubspotContactId ? (
                        <span className="badge success">{person.matchMethod.toLowerCase()}</span>
                      ) : (
                        <span className="badge neutral">no match</span>
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

      <section className="card">
        <h2>Target board</h2>
        <div className="grid three">
          {(['MUST_MEET', 'NICE_TO_MEET', 'BACKUP'] as const).map((priority) => (
            <div key={priority} className="card">
              <h3>{priorityLabel(priority)}</h3>
              <div className="stack">
                {groupedTargets[priority].length === 0 ? (
                  <p className="muted">No targets yet.</p>
                ) : (
                  groupedTargets[priority].map((target) => {
                    const person = persons.find((item) => item.id === target.personId);
                    if (!person) {
                      return null;
                    }

                    return (
                      <div key={target.id} className="card">
                        <h3>{person.fullName}</h3>
                        <p className="muted">
                          {person.title ?? '—'} · {companyName(person, companies)}
                        </p>
                        <div className="button-row">
                          {statusBadge(target.status)}
                          <form className="inline" action="/api/targets" method="post">
                            <input type="hidden" name="workspaceId" value={workspace.id} />
                            <input type="hidden" name="personId" value={person.id} />
                            <input type="hidden" name="intent" value="status" />
                            <input type="hidden" name="status" value="TARGETED" />
                            <input type="hidden" name="redirectTo" value={`/workspaces/${workspace.id}`} />
                            <button type="submit" className="secondary">
                              targeted
                            </button>
                          </form>
                          <form className="inline" action="/api/targets" method="post">
                            <input type="hidden" name="workspaceId" value={workspace.id} />
                            <input type="hidden" name="personId" value={person.id} />
                            <input type="hidden" name="intent" value="status" />
                            <input type="hidden" name="status" value="MET" />
                            <input type="hidden" name="redirectTo" value={`/workspaces/${workspace.id}`} />
                            <button type="submit" className="success">
                              met
                            </button>
                          </form>
                          <form className="inline" action="/api/targets" method="post">
                            <input type="hidden" name="workspaceId" value={workspace.id} />
                            <input type="hidden" name="personId" value={person.id} />
                            <input type="hidden" name="intent" value="status" />
                            <input type="hidden" name="status" value="MISSED" />
                            <input type="hidden" name="redirectTo" value={`/workspaces/${workspace.id}`} />
                            <button type="submit" className="danger">
                              missed
                            </button>
                          </form>
                        </div>

                        <hr className="soft" />

                        <div className="button-row">
                          <form className="inline" action="/api/drafts/generate" method="post">
                            <input type="hidden" name="workspaceId" value={workspace.id} />
                            <input type="hidden" name="personId" value={person.id} />
                            <input type="hidden" name="redirectTo" value={`/workspaces/${workspace.id}`} />
                            <button type="submit" className="secondary">
                              generate draft
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

      <section className="grid two">
        <div className="card">
          <h2>Quick encounter note</h2>
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
                <option value="MANUAL">manual</option>
                <option value="VOICE">voice</option>
              </select>
            </div>

            <button type="submit">Log encounter</button>
          </form>
        </div>

        <div className="card">
          <h2>Recent encounters</h2>
          <div className="stack">
            {encounters.length === 0 ? (
              <p className="muted">No encounter notes yet.</p>
            ) : (
              encounters.map((encounter) => {
                const person = persons.find((item) => item.id === encounter.personId);
                return (
                  <div key={encounter.id} className="card">
                    <h3>{person?.fullName ?? 'Unknown person'}</h3>
                    <p>{encounter.noteText}</p>
                    <p className="muted small">Summary: {encounter.structuredSummary}</p>
                    <div className="pill-list">
                      {encounter.tags.map((tag) => (
                        <span key={tag} className="pill">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      <section className="grid two">
        <div className="card">
          <h2>Follow-up drafts</h2>
          <div className="stack">
            {drafts.length === 0 ? (
              <p className="muted">Generate a draft from an encounter to populate this queue.</p>
            ) : (
              drafts.map((draft) => {
                const person = persons.find((item) => item.id === draft.personId);
                return (
                  <div key={draft.id} className="card">
                    <h3>{draft.subject}</h3>
                    <p className="muted">{person?.fullName ?? 'Unknown person'}</p>
                    <p className="small">{draft.summary}</p>
                    <pre className="small" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                      {draft.body}
                    </pre>
                    <div className="button-row" style={{ marginTop: 12 }}>
                      <span className={draft.gmailDraftId ? 'badge success' : 'badge neutral'}>
                        {draft.gmailDraftId ? 'gmail synced' : 'not synced'}
                      </span>
                      <form className="inline" action="/api/sync/gmail/draft" method="post">
                        <input type="hidden" name="workspaceId" value={workspace.id} />
                        <input type="hidden" name="draftId" value={draft.id} />
                        <input type="hidden" name="redirectTo" value={`/workspaces/${workspace.id}`} />
                        <button type="submit" className="secondary">
                          sync Gmail draft
                        </button>
                      </form>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="card">
          <h2>HubSpot tasks</h2>
          <div className="stack">
            {tasks.length === 0 ? (
              <p className="muted">No HubSpot tasks synced yet.</p>
            ) : (
              tasks.map((task) => {
                const person = persons.find((item) => item.id === task.personId);
                return (
                  <div key={task.id} className="card">
                    <h3>{task.title}</h3>
                    <p className="muted">{person?.fullName ?? 'Unknown person'}</p>
                    <p className="small">{task.body}</p>
                    <span className={task.hubspotTaskId ? 'badge success' : 'badge neutral'}>
                      {task.hubspotTaskId ? `hubspot ${task.hubspotTaskId}` : 'not synced'}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Session planner scaffold</h2>
        <div className="stack">
          {view.rankedSessions.length === 0 ? (
            <p className="muted">Capture the sessions demo page to populate the planner.</p>
          ) : (
            view.rankedSessions.map((session) => (
              <div key={session.id} className="card">
                <h3>{session.title}</h3>
                <p className="muted">
                  {session.location ?? '—'} · {session.startsAt ? new Date(session.startsAt).toLocaleString() : 'TBD'}
                </p>
                <div className="pill-list">
                  {session.speakerNames.map((speaker) => (
                    <span key={`${session.id}-${speaker}`} className="pill">
                      {speaker}
                    </span>
                  ))}
                </div>
                <p className="small" style={{ marginBottom: 6 }}>
                  Relevance score: <strong>{session.score}</strong>
                </p>
                <ul>
                  {session.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="card">
        <h2>Audit log preview</h2>
        <div className="stack">
          {auditLogs.length === 0 ? (
            <p className="muted">No audit entries yet.</p>
          ) : (
            auditLogs.map((entry) => (
              <div key={entry.id} className="card">
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
  );
}
