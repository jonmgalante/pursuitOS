import { demoAttendeeCards } from '../../../../../lib/store';

export const dynamic = 'force-dynamic';

export default function DemoGripAttendeeProfilePage() {
  const attendee = demoAttendeeCards()[0];

  if (!attendee) {
    return (
      <div className="demo-shell">
        <div className="card">
          <h2>Grip demo — attendee profile</h2>
          <p className="muted">No demo attendee was found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="demo-shell">
      <div className="demo-toolbar">
        <div className="card" data-grip-page="attendee-profile">
          <h2>Grip demo — attendee profile</h2>
          <p className="muted">Profile page example for page snapshot + provenance handling.</p>
        </div>
      </div>

      <article
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
        <hr className="soft" />
        <p>
          This profile page exists to show that the page-level artifact and provenance model also applies to profile
          pages, not just list pages.
        </p>
      </article>
    </div>
  );
}