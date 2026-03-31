import {
  DEMO_GRIP_ATTENDEE_LIST_DESCRIPTION,
  DEMO_GRIP_ATTENDEE_LIST_PAGE_TITLE,
  listDemoGripAttendeeCardFixtures
} from '../../../../lib/demo-grip-fixtures';

export const dynamic = 'force-dynamic';

export default function DemoGripAttendeesPage() {
  const attendees = listDemoGripAttendeeCardFixtures();

  return (
    <div className="demo-shell">
      <div className="demo-toolbar">
        <div className="card">
          <h2>{DEMO_GRIP_ATTENDEE_LIST_PAGE_TITLE}</h2>
          <p className="muted">{DEMO_GRIP_ATTENDEE_LIST_DESCRIPTION}</p>
        </div>
      </div>

      <div className="portal-list">
        {attendees.map((attendee) => (
          <article
            key={attendee.key}
            className="portal-card"
            {...attendee.dataAttributes}
          >
            <h3 data-field="name">{attendee.fullName}</h3>
            <div className="portal-meta">
              <span data-field="title">{attendee.title}</span> ·{' '}
              <span data-field="company">{attendee.companyName}</span>
            </div>
            <p>
              <a data-field="email" href={`mailto:${attendee.email}`}>
                {attendee.email}
              </a>
            </p>
            <div className="pill-list">
              {attendee.pills.map((pill) => (
                <span key={`${attendee.key}-${pill}`} className="pill">
                  {pill}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
