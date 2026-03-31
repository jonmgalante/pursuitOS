import { demoAttendeeCards } from '../../../../lib/store';

export const dynamic = 'force-dynamic';

export default function DemoGripAttendeesPage() {
  const attendees = demoAttendeeCards();

  return (
    <div className="demo-shell">
      <div className="demo-toolbar">
        <div className="card">
          <h2>Grip demo — attendee search results</h2>
          <p className="muted">
            This page is intentionally instrumented with stable DOM attributes so the extension can capture visible
            attendee records in the first MVP slice.
          </p>
        </div>
      </div>

      <div className="portal-list">
        {attendees.map((attendee) => (
          <article
            key={attendee.externalKey}
            className="portal-card"
            data-grip-card-type="attendee"
            data-person-external-id={attendee.externalKey}
            data-attendee-name={attendee.fullName}
            data-attendee-title={attendee.title}
            data-company={attendee.companyName}
            data-email={attendee.email}
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
              <span className="pill">attendee</span>
              <span className="pill">visible</span>
              <span className="pill">search result card</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
