import { getFirstSliceService } from '../lib/services/first-slice-service';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const service = getFirstSliceService();
  await service.ensureDemoWorkspace();
  const workspaces = await service.listWorkspaces();
  const featuredWorkspace = workspaces[0];
  const featuredView = featuredWorkspace
    ? await service.getWorkspaceView(featuredWorkspace.id)
    : undefined;

  const workspaceCount = workspaces.length;
  const featuredTargets = featuredView?.workspace.targets ?? [];
  const featuredTargetCount = featuredTargets.length;
  const featuredMustMeetCount = featuredTargets.filter((target) => target.priority === 'MUST_MEET').length;
  const featuredSessionCount = featuredView?.rankedSessions.length ?? 0;
  const featuredTopSession = featuredView?.rankedSessions[0];
  const featuredEncounterCount = featuredView?.workspace.encounters.length ?? 0;
  const featuredDraftCount = featuredView?.workspace.drafts.length ?? 0;
  const featuredPendingDraftCount =
    featuredView?.workspace.drafts.filter((draft) => !draft.gmailDraftId).length ?? 0;
  const featuredNeedsFollowUpCount =
    featuredTargets.filter((target) => target.status === 'MET' || target.status === 'MISSED').length ?? 0;

  return (
    <div className="home-page grid">
      <section className="card home-hero">
        <div className="home-hero-copy">
          <p className="section-eyebrow">Mission control</p>
          <h2>Run the rep workspace from visible capture to Target follow-up without leaving the locked MVP path.</h2>
          <p className="lead">
            Use the Grip capture companion to bring visible attendee and session data into one
            workspace, decide who matters, record what happened, and move the next HubSpot and
            Gmail actions fast.
          </p>

          <div className="button-row">
            <form action="/api/demo/seed" method="post">
              <button type="submit">Create or open demo workspace</button>
            </form>
            {featuredWorkspace ? (
              <a className="button-link secondary" href={`/workspaces/${featuredWorkspace.id}`}>
                Open workspace
              </a>
            ) : null}
            <a className="button-link secondary" href="/demo/grip/attendees">
              Open demo attendee page
            </a>
            <a className="button-link secondary" href="/demo/grip/sessions">
              Open demo session page
            </a>
          </div>

          <div className="pill-list">
            <span className="badge neutral">Visible-record capture only</span>
            <span className="badge insight">Session intelligence ready</span>
            <span className="badge follow-up">Follow-up path preserved</span>
          </div>
        </div>

        <aside className="home-command-board shell-panel-card">
          <div className="section-header compact section-header-shell">
            <div className="section-title-stack">
              <p className="section-eyebrow shell">Operator snapshot</p>
              <h2>Five questions, one workspace</h2>
            </div>
            {featuredWorkspace ? (
              <span className="badge shell">{featuredWorkspace.name}</span>
            ) : null}
          </div>

          <div className="question-strip home-question-strip">
            <div className="question-card shell action">
              <p className="question-label">Who should I meet?</p>
              <p className="question-value">
                {featuredMustMeetCount > 0 ? `${featuredMustMeetCount} must meet` : 'Build the Target list'}
              </p>
              <p className="question-detail">
                {featuredTargetCount > 0
                  ? `${featuredTargetCount} total Targets are already in the workspace.`
                  : 'Mark captured people as must meet, nice to meet, or backup.'}
              </p>
            </div>

            <div className="question-card shell insight">
              <p className="question-label">Where should I go?</p>
              <p className="question-value">
                {featuredTopSession ? featuredTopSession.title : 'Capture sessions to rank next stops'}
              </p>
              <p className="question-detail">
                {featuredSessionCount > 0
                  ? `${featuredSessionCount} ranked sessions are ready for session intelligence.`
                  : 'Open the demo sessions fixture to populate speaker and session recommendations.'}
              </p>
            </div>

            <div className="question-card shell neutral">
              <p className="question-label">What just happened?</p>
              <p className="question-value">
                {featuredEncounterCount > 0
                  ? `${featuredEncounterCount} encounter${featuredEncounterCount === 1 ? '' : 's'} logged`
                  : 'No encounters recorded yet'}
              </p>
              <p className="question-detail">
                Field mode and the workspace note flow preserve in-event activity for follow-up.
              </p>
            </div>

            <div className="question-card shell action">
              <p className="question-label">What should I do next?</p>
              <p className="question-value">
                {featuredNeedsFollowUpCount > 0
                  ? `${featuredNeedsFollowUpCount} Targets need follow-up`
                  : 'No open follow-up queue yet'}
              </p>
              <p className="question-detail">
                Met and missed Targets become the next-action queue for drafts and HubSpot tasks.
              </p>
            </div>

            <div className="question-card shell action">
              <p className="question-label">What should I send?</p>
              <p className="question-value">
                {featuredDraftCount > 0
                  ? `${featuredDraftCount} draft${featuredDraftCount === 1 ? '' : 's'} ready`
                  : 'No draft queue yet'}
              </p>
              <p className="question-detail">
                {featuredPendingDraftCount > 0
                  ? `${featuredPendingDraftCount} Gmail draft${featuredPendingDraftCount === 1 ? '' : 's'} still need sync.`
                  : 'Generate a draft from an encounter to populate the send queue.'}
              </p>
            </div>
          </div>
        </aside>
      </section>

      <section className="home-kpi-strip">
        <div className="card home-kpi-card">
          <p className="section-eyebrow">Capture floor</p>
          <p className="kpi">25</p>
          <p className="kpi-label">Visible records across the attendee and session fixtures</p>
        </div>
        <div className="card home-kpi-card">
          <p className="section-eyebrow">Attendee fixture</p>
          <p className="kpi">10</p>
          <p className="kpi-label">Visible attendee records on the demo attendee page</p>
        </div>
        <div className="card home-kpi-card">
          <p className="section-eyebrow">Session fixture</p>
          <p className="kpi">15</p>
          <p className="kpi-label">Session and speaker records on the demo session page</p>
        </div>
        <div className="card home-kpi-card">
          <p className="section-eyebrow">Workspaces</p>
          <p className="kpi">{workspaceCount}</p>
          <p className="kpi-label">Command surfaces available in the current environment</p>
        </div>
      </section>

      <section className="grid two home-operations-grid">
        <section className="card">
          <div className="section-header">
            <div className="section-title-stack">
              <p className="section-eyebrow">Runbook</p>
              <h2>How to run the first slice</h2>
              <p className="muted">Keep the rep flow intact from capture to draft and sync.</p>
            </div>
            <a className="inline-link" href="/demo/grip/attendees">
              Open first capture fixture
            </a>
          </div>

          <ol className="step-list">
            <li className="step-row">
              <span className="step-index">01</span>
              <p>Open the demo workspace.</p>
            </li>
            <li className="step-row">
              <span className="step-index">02</span>
              <p>
                Load the unpacked extension from <code className="inline">apps/extension/dist</code>.
              </p>
            </li>
            <li className="step-row">
              <span className="step-index">03</span>
              <p>
                In the extension side panel, use workspace id{' '}
                <code className="inline">ws_demo_summit_2026</code>.
              </p>
            </li>
            <li className="step-row">
              <span className="step-index">04</span>
              <p>Capture the attendee page, then capture the sessions page.</p>
            </li>
            <li className="step-row">
              <span className="step-index">05</span>
              <p>Mark three Targets, log one encounter, generate one draft, and sync the next actions.</p>
            </li>
          </ol>
        </section>

        <section className="card">
          <div className="section-header">
            <div className="section-title-stack">
              <p className="section-eyebrow">Command surfaces</p>
              <h2>Available workspaces</h2>
              <p className="muted">Open the current operator surface or move back into the demo fixtures.</p>
            </div>
            <span className="badge neutral">
              {workspaceCount} {workspaceCount === 1 ? 'workspace' : 'workspaces'}
            </span>
          </div>

          <div className="stack">
            {workspaces.map((workspace) => (
              <div key={workspace.id} className="list-row workspace-row">
                <div className="workspace-row-copy">
                  <div className="workspace-row-header">
                    <h3>{workspace.name}</h3>
                    <span className="badge neutral">Workspace</span>
                  </div>
                  <p className="muted">{workspace.eventName}</p>
                </div>
                <a className="button-link secondary" href={`/workspaces/${workspace.id}`}>
                  Open workspace
                </a>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
