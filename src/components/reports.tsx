"use client";
import {
  addDays,
  daysBetween,
  weekday,
  scheduled,
  completed,
  streaks,
  todayIn,
  projectProgress,
  goalProgress,
  weeklyTotal,
  type Backup,
} from "@/lib/domain";
import { Meter, Summary, DateValue } from "./compact";

export default function Reports({
  data,
  today,
  period,
}: {
  data: Backup;
  today: string;
  period: string;
}) {
  const start =
    period === "month"
      ? today.slice(0, 7) + "-01"
      : addDays(today, -((weekday(today) - data.settings.weekStart + 7) % 7));
  const dates = daysBetween(start, today);
  const weeklyHabits = data.habits.filter(
    (h) => !h.archived && h.period === "weekly",
  );
  const habits = data.habits.filter(
    (h) => !h.archived && h.period !== "weekly",
  );
  const scheduledCount = habits.reduce(
    (n, h) => n + dates.filter((d) => scheduled(h, d)).length,
    0,
  );
  const count = habits.reduce(
    (n, h) =>
      n +
      dates.filter((d) => scheduled(h, d) && completed(h, data.entries, d))
        .length,
    0,
  );
  return (
    <>
      <Summary
        items={[
          {
            label: "Daily habits",
            value: `${scheduledCount ? Math.round((count / scheduledCount) * 100) : 0}% (${count}/${scheduledCount})`,
          },
          {
            label: "Completed tasks",
            value: data.tasks.filter(
              (t) =>
                t.done &&
                t.completedAt &&
                todayIn(data.settings.timezone, new Date(t.completedAt)) >=
                  start &&
                todayIn(data.settings.timezone, new Date(t.completedAt)) <=
                  today,
            ).length,
          },
          {
            label: "Overdue",
            value: data.tasks.filter((t) => !t.done && t.due && t.due < today)
              .length,
          },
        ]}
      />
      <section className="panel report-panel">
        <h2>Daily completion</h2>
        <p className="hint">
          <DateValue date={start} /> to <DateValue date={today} />
        </p>
        <div
          className="bar-chart"
          role="img"
          aria-label="Daily habit completion chart; exact values follow below"
        >
          {dates.map((d) => {
            const hs = habits.filter((h) => scheduled(h, d));
            const done = hs.filter((h) => completed(h, data.entries, d)).length;
            return (
              <div key={d} title={`${d}: ${done}/${hs.length}`}>
                <div className="bar-track">
                  <span
                    style={{
                      height: `${hs.length ? (done / hs.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                <small>{Number(d.slice(-2))}</small>
              </div>
            );
          })}
        </div>
        <details>
          <summary>Daily values</summary>
          <ul>
            {dates.map((d) => (
              <li key={d}>
                {d}:{" "}
                {
                  habits.filter(
                    (h) => scheduled(h, d) && completed(h, data.entries, d),
                  ).length
                }{" "}
                / {habits.filter((h) => scheduled(h, d)).length} habits
              </li>
            ))}
          </ul>
        </details>
      </section>
      {weeklyHabits.length > 0 && (
        <section className="panel report-panel">
          <h2>Weekly targets</h2>
          {weeklyHabits.map((h) => {
            const stats = streaks(
              h,
              data.entries,
              today,
              data.settings.weekStart,
            );
            return (
              <div className="insight" key={h.id}>
                <strong>{h.title}</strong>
                <span>
                  {weeklyTotal(h, data.entries, today, data.settings.weekStart)}{" "}
                  / {h.target} days this week
                </span>
                <span>
                  Current: {stats.current}w · Best: {stats.best}w
                </span>
              </div>
            );
          })}
        </section>
      )}
      <section className="panel report-panel">
        <h2>Habit insights</h2>
        {habits.length ? (
          habits.map((h) => {
            const s = streaks(h, data.entries, today);
            const total = data.entries
              .filter(
                (e) => e.habitId === h.id && e.date >= start && e.date <= today,
              )
              .reduce((n, e) => n + e.value, 0);
            return (
              <div className="insight" key={h.id}>
                <strong>
                  {h.icon} {h.title}
                </strong>
                <span>
                  {total} {h.kind === "quantity" ? h.unit : "check-ins"}
                </span>
                <span>
                  Current: {s.current} · Best: {s.best}
                </span>
              </div>
            );
          })
        ) : (
          <p className="hint">No daily habits</p>
        )}
      </section>
      <div className="record-grid">
        <section className="panel report-panel">
          <h2>Project progress</h2>
          {!data.projects.some((p) => p.status !== "archived") && (
            <p className="hint">No projects</p>
          )}
          {data.projects
            .filter((p) => p.status !== "archived")
            .map((p) => (
              <div className="report-item" key={p.id}>
                <p>
                  {p.title} ·{" "}
                  {Math.round(projectProgress(p.id, data.tasks, today))}%
                </p>
                <Meter
                  value={projectProgress(p.id, data.tasks, today)}
                  label={p.title}
                />
              </div>
            ))}
        </section>
        <section className="panel report-panel">
          <h2>Goal progress</h2>
          {!data.goals.some((g) => !g.archived) && (
            <p className="hint">No goals</p>
          )}
          {data.goals
            .filter((g) => !g.archived)
            .map((g) => {
              const v = goalProgress(g, data, today);
              return (
                <div className="report-item" key={g.id}>
                  <p>
                    {g.title} ·{" "}
                    {v.missing
                      ? "Source removed"
                      : `${Math.round(v.value)}/${g.target}`}
                  </p>
                  <Meter
                    value={v.missing ? 0 : (v.value / g.target) * 100}
                    label={g.title}
                  />
                </div>
              );
            })}
        </section>
      </div>
    </>
  );
}
