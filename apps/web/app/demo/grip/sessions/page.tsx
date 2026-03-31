import {
  DEMO_GRIP_SESSION_LIST_DESCRIPTION,
  DEMO_GRIP_SESSION_LIST_PAGE_TITLE,
  listDemoGripSessionCardFixtures
} from '../../../../lib/demo-grip-fixtures';

export const dynamic = 'force-dynamic';

export default function DemoGripSessionsPage() {
  const sessions = listDemoGripSessionCardFixtures();

  return (
    <div className="demo-shell">
      <div className="demo-toolbar">
        <div className="card">
          <h2>{DEMO_GRIP_SESSION_LIST_PAGE_TITLE}</h2>
          <p className="muted">{DEMO_GRIP_SESSION_LIST_DESCRIPTION}</p>
        </div>
      </div>

      <div className="portal-list">
        {sessions.map((session) => (
          <article
            key={session.key}
            className="portal-card"
            {...session.dataAttributes}
          >
            <h3 data-field="session-title">{session.title}</h3>
            <div className="portal-meta">
              <span data-field="location">{session.location}</span> ·{' '}
              <time data-field="time">{session.startsAtLabel}</time>
            </div>
            <p data-field="session-description">{session.description}</p>
            <div className="pill-list">
              {session.speakers.map((speaker) => (
                <span
                  key={speaker.key}
                  className="pill"
                  data-speaker-name={speaker.fullName}
                >
                  {speaker.fullName}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
