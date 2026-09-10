"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="shell errorPage">
      <p className="eyebrow">Timeline unavailable</p>
      <h1>Activity could not be loaded.</h1>
      <p className="intro">
        Check the database connection, then try loading the timeline again.
      </p>
      <button type="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
