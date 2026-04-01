import './pursuit-theme.css';
import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Conference Rep Copilot MVP',
  description: 'Locked MVP scaffold for a conference rep copilot.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell-frame">
          <div className="app-shell">
            <header className="app-header shell-panel-card">
              <div className="app-header-main">
                <div className="app-brand">
                  <p className="section-eyebrow shell">PursuitOS mission control</p>
                  <div className="app-title-row">
                    <h1>Conference Rep Copilot</h1>
                    <span className="badge shell">Target-first MVP</span>
                  </div>
                  <p>
                    Grip capture companion, operator workspace, and field-ready follow-up flow in one
                    tactical operating shell.
                  </p>
                </div>

                <div className="app-header-signals">
                  <span className="badge shell">Grip first</span>
                  <span className="badge shell">HubSpot tasks</span>
                  <span className="badge shell">Gmail drafts</span>
                </div>
              </div>

              <div className="app-nav-panel">
                <div className="section-header compact section-header-shell">
                  <div className="section-title-stack">
                    <p className="section-eyebrow shell">Launch surfaces</p>
                    <h2>Command routes</h2>
                  </div>
                </div>

                <nav className="app-nav-grid">
                  <a className="app-route-link" href="/">
                    <span className="app-route-label">Home</span>
                    <strong>Open command home</strong>
                    <small>Seed or reopen the first-slice workspace.</small>
                  </a>
                  <a className="app-route-link" href="/demo/grip/attendees">
                    <span className="app-route-label">Demo attendees</span>
                    <strong>Visible attendee capture</strong>
                    <small>Use the active tab fixture for attendee intake.</small>
                  </a>
                  <a className="app-route-link" href="/demo/grip/sessions">
                    <span className="app-route-label">Demo sessions</span>
                    <strong>Visible session capture</strong>
                    <small>Capture sessions and linked speaker records.</small>
                  </a>
                  <a className="app-route-link" href="/demo/grip/attendees/avery-chen">
                    <span className="app-route-label">Demo profile</span>
                    <strong>Profile provenance fixture</strong>
                    <small>Verify profile-page capture and artifact handling.</small>
                  </a>
                </nav>
              </div>
            </header>

            <main className="app-main">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
