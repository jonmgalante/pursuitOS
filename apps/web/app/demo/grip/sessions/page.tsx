import { demoSessionCards } from '../../../../lib/store';

export const dynamic = 'force-dynamic';

export default function DemoGripSessionsPage() {
  const sessions = demoSessionCards();

  return (
    <div className="demo-shell">
      <div className="demo-toolbar">
        <div className="card">
          <h2>Grip demo — session list</h2>
          <p className="muted">
            Each visible session card includes speaker metadata so the extension can emit both session records and
            speaker person records.
          </p>
        </div>
      </div>

      <div className="portal-list">
        {sessions.map((session) => (
          <article
            key={session.externalKey}
            className="portal-card"
            data-grip-card-type="session"
            data-session-external-id={session.externalKey}
            data-session-title={session.title}
            data-session-description={session.description}
            data-location={session.location}
            data-starts-at={session.startsAt}
            data-ends-at={session.endsAt}
            data-speakers={session.speakers.map((speaker) => speaker.fullName).join('|')}
          >
            <h3 data-field="session-title">{session.title}</h3>
            <div className="portal-meta">
              <span data-field="location">{session.location}</span> ·{' '}
              <time data-field="time">
                {new Date(session.startsAt).toLocaleString('en-US', {
                  dateStyle: 'medium',
                  timeStyle: 'short'
                })}
              </time>
            </div>
            <p data-field="session-description">{session.description}</p>
            <div className="pill-list">
              {session.speakers.map((speaker) => (
                <span
                  key={`${session.externalKey}-${speaker.fullName}`}
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
