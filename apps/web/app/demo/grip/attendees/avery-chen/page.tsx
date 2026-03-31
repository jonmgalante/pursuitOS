import {
  DEMO_GRIP_ATTENDEE_PROFILE_DESCRIPTION,
  DEMO_GRIP_ATTENDEE_PROFILE_PAGE_TITLE,
  getDemoGripAttendeeProfileFixture
} from '../../../../../lib/demo-grip-fixtures';

export const dynamic = 'force-dynamic';

export default function DemoGripAttendeeProfilePage() {
  const attendee = getDemoGripAttendeeProfileFixture();

  if (!attendee) {
    return (
      <div className="demo-shell">
        <div className="card">
          <h2>{DEMO_GRIP_ATTENDEE_PROFILE_PAGE_TITLE}</h2>
          <p className="muted">No demo attendee was found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="demo-shell">
      <div className="demo-toolbar">
        <div className="card" data-grip-page="attendee-profile">
          <h2>{DEMO_GRIP_ATTENDEE_PROFILE_PAGE_TITLE}</h2>
          <p className="muted">{DEMO_GRIP_ATTENDEE_PROFILE_DESCRIPTION}</p>
        </div>
      </div>

      <article
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
        <hr className="soft" />
        <p>
          This profile page exists to show that the page-level artifact and provenance model also applies to profile
          pages, not just list pages.
        </p>
      </article>
    </div>
  );
}
