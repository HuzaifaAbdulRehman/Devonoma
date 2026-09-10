import { listRecentActivities } from "@/lib/activities";
import { firstCommitLine, formatTimestamp, shortCommitSha } from "@/lib/presentation";

export const dynamic = "force-dynamic";

function EmptyTimeline() {
  return (
    <div className="emptyState">
      <svg className="emptyIcon" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="15" cy="12" r="4" />
        <circle cx="33" cy="36" r="4" />
        <path d="M15 16v8c0 6.6 5.4 12 12 12h2" />
        <path d="M15 24h9c5 0 9-4 9-9v-3" />
      </svg>
      <h3>No GitHub activity yet</h3>
      <p>
        Send a GitHub push through HookRelay and its verified delivery will appear here.
      </p>
    </div>
  );
}

export default async function Home() {
  const activities = await listRecentActivities();

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Devonoma home">
          <span className="brandMark" aria-hidden="true">
            D
          </span>
          Devonoma
        </a>
        <span className="status">
          <span className="statusDot" aria-hidden="true" />
          Receiver online
        </span>
      </header>

      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">GitHub activity</p>
        <h1 id="page-title">A living trail of every push.</h1>
        <p className="intro">
          Devonoma turns reliable HookRelay deliveries into a readable record of
          repositories, branches, commits, and people.
        </p>
      </section>

      <section className="activityPanel" aria-labelledby="activity-title">
        <div className="panelHeading">
          <div>
            <p className="eyebrow">Timeline</p>
            <h2 id="activity-title">Recent activity</h2>
          </div>
          <span className="eventCount">
            {activities.length} {activities.length === 1 ? "event" : "events"} shown
          </span>
        </div>

        {activities.length === 0 ? (
          <EmptyTimeline />
        ) : (
          <ol className="activityList">
            {activities.map((activity) => (
              <li className="activityItem" key={activity.relayEventId}>
                <span className="timelineMark" aria-hidden="true" />
                <article>
                  <div className="activityMeta">
                    <p>
                      <a href={activity.actorUrl} rel="noreferrer">
                        {activity.actorLogin}
                      </a>{" "}
                      pushed to <span className="branch">{activity.branch}</span>
                    </p>
                    <time dateTime={activity.eventAt.toISOString()}>
                      {formatTimestamp(activity.eventAt)}
                    </time>
                  </div>
                  <a className="repositoryLink" href={activity.repositoryUrl} rel="noreferrer">
                    {activity.repositoryFullName}
                  </a>
                  {activity.headCommitSha &&
                  activity.headCommitMessage &&
                  activity.headCommitUrl ? (
                    <a className="commit" href={activity.headCommitUrl} rel="noreferrer">
                      <code>{shortCommitSha(activity.headCommitSha)}</code>
                      <span>{firstCommitLine(activity.headCommitMessage)}</span>
                    </a>
                  ) : (
                    <p className="branchDeletion">Branch deleted; no head commit was provided.</p>
                  )}
                </article>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
