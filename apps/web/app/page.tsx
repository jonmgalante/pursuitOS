import { getFirstSliceService } from '../lib/services/first-slice-service';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const service = getFirstSliceService();
  await service.ensureDemoWorkspace();
  const workspaces = await service.listWorkspaces();
  const workspaceCount = workspaces.length;

  return (
    <div className="home-page grid">
      <section className="card home-hero">
        <div className="home-hero-copy">
          <p className="section-eyebrow">Mission control</p>
          <h2>Capture visible Grip context, rank Targets, and move follow-up before the conference floor shifts.</h2>
          <p className="lead">
            A rep can capture visible Grip attendee and session data into one workspace, mark
            Targets, log encounters, generate follow-up drafts, and sync a HubSpot task plus Gmail
            draft without leaving the locked MVP path.
          </p>

          <div className="button-row">
            <form action="/api/demo/seed" method="post">
              <button type="submit">Create or open demo workspace</button>
            </form>
            <a className="button-link secondary" href="/demo/grip/attendees">
              Open demo attendee page
            </a>
            <a className="button-link secondary" href="/demo/grip/sessions">
              Open demo session page
            </a>
            <a className="button-link secondary" href="/demo/grip/attendees/avery-chen">
              Open attendee profile page
            </a>
          </div>

          <div className="pill-list">
            <span className="badge neutral">Visible-record capture only</span>
            <span className="badge insight">Session intelligence ready</span>
            <span className="badge warning">Follow-up path preserved</span>
          </div>
        </div>

        <aside className="home-hero-rail">
          <p className="section-eyebrow shell">Operating loop</p>
          <div className="home-command-list">
            <div className="home-command-row">
              <span className="home-command-index">01</span>
              <div>
                <strong>Capture visible attendees and sessions</strong>
                <p className="muted">Use the extension inside the active logged-in Grip tab.</p>
              </div>
            </div>
            <div className="home-command-row">
              <span className="home-command-index">02</span>
              <div>
                <strong>Turn people into Targets</strong>
                <p className="muted">Promote the must-meet list before the event gets noisy.</p>
              </div>
            </div>
            <div className="home-command-row">
              <span className="home-command-index">03</span>
              <div>
                <strong>Log encounters and draft follow-up</strong>
                <p className="muted">Keep the HubSpot and Gmail draft path intact from the same workspace.</p>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section className="grid three home-kpi-grid">
        <div className="card home-kpi-card">
          <p className="section-eyebrow">Attendees</p>
          <p className="kpi">10</p>
          <p className="kpi-label">Visible attendee records on the attendee capture page</p>
        </div>
        <div className="card home-kpi-card">
          <p className="section-eyebrow">Sessions</p>
          <p className="kpi">15</p>
          <p className="kpi-label">Session and speaker records on the sessions capture page</p>
        </div>
        <div className="card home-kpi-card">
          <p className="section-eyebrow">Capture floor</p>
          <p className="kpi">25</p>
          <p className="kpi-label">Visible records across both Grip demo pages</p>
        </div>
      </section>

      <section className="grid two home-operations-grid">
        <section className="card">
          <div className="section-header">
            <div className="section-title-stack">
              <p className="section-eyebrow">Runbook</p>
              <h2>How to run the first slice</h2>
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
              <p>Back in the workspace, mark three Targets, log one encounter, generate one draft, and sync.</p>
            </li>
          </ol>
        </section>

        <section className="card">
          <div className="section-header">
            <div className="section-title-stack">
              <p className="section-eyebrow">Workspaces</p>
              <h2>Available command surfaces</h2>
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
