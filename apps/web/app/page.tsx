import { getFirstSliceService } from '../lib/services/first-slice-service';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const service = getFirstSliceService();
  await service.ensureDemoWorkspace();
  const workspaces = await service.listWorkspaces();

  return (
    <div className="grid">
      <section className="card">
        <h2>What this scaffold proves</h2>
        <p>
          A rep can capture visible Grip attendee and session data into one workspace, mark targets,
          log encounters, generate follow-up drafts, and sync a HubSpot task plus Gmail draft.
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
      </section>

      <section className="grid three">
        <div className="card">
          <p className="kpi">10</p>
          <p className="kpi-label">Demo attendee records on the attendee page</p>
        </div>
        <div className="card">
          <p className="kpi">15</p>
          <p className="kpi-label">Demo session + speaker records on the sessions page</p>
        </div>
        <div className="card">
          <p className="kpi">25</p>
          <p className="kpi-label">Total visible records across both demo Grip pages</p>
        </div>
      </section>

      <section className="card">
        <h2>How to run the first slice</h2>
        <div className="stack small">
          <p>1. Open the demo workspace.</p>
          <p>2. Load the unpacked extension from <code className="inline">apps/extension/dist</code>.</p>
          <p>
            3. In the extension side panel, use workspace id{' '}
            <code className="inline">ws_demo_summit_2026</code>.
          </p>
          <p>4. Capture the attendee page, then capture the sessions page.</p>
          <p>5. Back in the workspace, mark three targets, log one encounter, generate one draft, and sync.</p>
        </div>
      </section>

      <section className="card">
        <h2>Available workspaces</h2>
        <div className="stack">
          {workspaces.map((workspace) => (
            <div key={workspace.id} className="card">
              <h3>{workspace.name}</h3>
              <p className="muted">{workspace.eventName}</p>
              <a className="button-link secondary" href={`/workspaces/${workspace.id}`}>
                Open workspace
              </a>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
