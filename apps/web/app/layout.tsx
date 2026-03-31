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
        <div className="app-shell">
          <header className="app-header">
            <div>
              <h1>Conference Rep Copilot</h1>
              <p>Target-first MVP scaffold for Grip → workspace → follow-up.</p>
            </div>
            <nav className="button-row">
              <a className="button-link secondary" href="/">
                Home
              </a>
              <a className="button-link secondary" href="/demo/grip/attendees">
                Demo attendees
              </a>
              <a className="button-link secondary" href="/demo/grip/sessions">
                Demo sessions
              </a>
              <a className="button-link secondary" href="/demo/grip/attendees/avery-chen">
                Demo profile
              </a>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
