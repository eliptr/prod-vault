"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="loading">
      <h1>Your vault couldn’t open</h1>
      <p>
        Check that browser storage is available, then try again. Avoid clearing
        site data unless you have a backup.
      </p>
      <button className="primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
