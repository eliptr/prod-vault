"use client";
import { useState, type ReactNode } from "react";
import {
  addDays,
  completed,
  daysBetween,
  goalProgress,
  projectProgress,
  scheduled,
  streaks,
  type Backup,
  type Habit,
  type Task,
  type Project,
  type Goal,
} from "@/lib/domain";

export function Meter({ value, label }: { value: number; label: string }) {
  const percent = Math.round(Math.max(0, Math.min(100, value)));
  return (
    <div
      className="meter"
      role="progressbar"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: percent + "%" }} />
    </div>
  );
}
export function Empty({
  text,
  action,
  label = "Add",
}: {
  text: string;
  action?: () => void;
  label?: string;
}) {
  return (
    <div className="empty">
      <span>{text}</span>
      {action && <button onClick={action}>{label}</button>}
    </div>
  );
}
export function Section({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="section">
      <header className="section-title">
        <h2>
          {title}
          {count !== undefined && <span className="count">{count}</span>}
        </h2>
        {action && (
          <button
            aria-label={`Add ${title === "Habits" ? "habit" : title === "Tasks" ? "task" : title === "Projects" ? "project" : "goal"}`}
            onClick={action}
          >
            + Add
          </button>
        )}
      </header>
      <div className="panel">{children}</div>
    </section>
  );
}
export function Summary({
  items,
}: {
  items: { label: string; value: string | number }[];
}) {
  return (
    <div className="summary-strip">
      {items.map((item) => (
        <span key={item.label}>
          {item.label} <strong>{item.value}</strong>
        </span>
      ))}
    </div>
  );
}
export function TaskRow({
  task: t,
  project,
  today,
  onEdit,
  onToggle,
  onSubtask,
}: {
  task: Task;
  project?: string;
  today: string;
  onEdit: () => void;
  onToggle: () => void;
  onSubtask: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="task-row">
      <div className="task-main">
        <button
          className={"check " + (t.done ? "checked" : "")}
          aria-label={`${t.done ? "Reopen" : "Complete"} ${t.title}`}
          aria-pressed={t.done}
          onClick={onToggle}
        >
          {t.done ? "✓" : "○"}
        </button>
        <button className="task-title" onClick={onEdit}>
          <strong className={t.done ? "struck" : ""}>{t.title}</strong>
          {(project || t.templateId) && (
            <span>
              {project}
              {t.templateId ? " · Repeating" : ""}
            </span>
          )}
        </button>
        <span className="priority" title={`Priority: ${t.priority}`}>
          {t.priority}
        </span>
        {t.due && (
          <time
            dateTime={t.due}
            className={t.due < today && !t.done ? "overdue" : ""}
          >
            {t.due === today ? "Today" : t.due.slice(5)}
          </time>
        )}
        {(t.notes || t.subtasks.length > 0) && (
          <button
            className="expand"
            aria-label={`Details for ${t.title}`}
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "−" : "+"}
            {t.subtasks.length
              ? `${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length}`
              : ""}
          </button>
        )}
      </div>
      {expanded && (
        <div className="task-details">
          {t.notes && <p>{t.notes}</p>}
          {t.subtasks.map((s) => (
            <label key={s.id}>
              <input
                type="checkbox"
                checked={s.done}
                onChange={() => onSubtask(s.id)}
              />
              {s.title}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
function ink(hex: string) {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] > 0.179
    ? "#000"
    : "#fff";
}
export function HabitRow({
  habit: h,
  data,
  today,
  at = today,
  month,
  onEdit,
  onEntry,
  onDate,
}: {
  habit: Habit;
  data: Backup;
  today: string;
  at?: string;
  month?: { start: string; end: string };
  onEdit: () => void;
  onEntry: (date: string, value: number) => void;
  onDate: (date: string) => void;
}) {
  const value =
    data.entries.find((e) => e.habitId === h.id && e.date === at)?.value || 0;
  const stats = streaks(h, data.entries, today);
  const history = daysBetween(addDays(at, -6), at);
  return (
    <div
      className="habit-record"
      style={
        {
          "--accent": h.color,
          "--accent-ink": ink(h.color),
        } as React.CSSProperties
      }
    >
      <div className="habit-row">
        <button className="record-name" onClick={onEdit}>
          {h.title}
          {h.archived && <span>archived</span>}
        </button>
        <span
          className="history"
          role="img"
          aria-label={history
            .map(
              (d) =>
                `${d}: ${!scheduled(h, d) ? "not scheduled" : completed(h, data.entries, d) ? "complete" : "incomplete"}`,
            )
            .join("; ")}
        >
          {history.map((d) => (
            <i
              key={d}
              className={
                completed(h, data.entries, d)
                  ? "filled"
                  : !scheduled(h, d)
                    ? "unscheduled"
                    : ""
              }
            />
          ))}
        </span>
        <span
          className="streak"
          title={`Current streak ${stats.current}; best ${stats.best}`}
          aria-label={`Streak ${stats.current}, best ${stats.best}`}
        >
          {stats.current}d
        </span>
        {scheduled(h, at) && at <= today && !h.archived ? (
          h.kind === "check" ? (
            <button
              className={"check " + (value >= h.target ? "checked" : "")}
              aria-label={`${value >= h.target ? "Reopen" : "Complete"} ${h.title}`}
              aria-pressed={value >= h.target}
              onClick={() => onEntry(at, value >= h.target ? 0 : h.target)}
            >
              {value >= h.target ? "✓" : "○"}
            </button>
          ) : (
            <label className="quantity">
              <input
                aria-label={`${h.title} quantity for ${at}`}
                key={`${at}:${value}`}
                type="number"
                min="0"
                step="any"
                defaultValue={value}
                onBlur={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n) && n >= 0 && n !== value)
                    onEntry(at, n);
                }}
              />
              <span>
                /{h.target} {h.unit}
              </span>
            </label>
          )
        ) : (
          <span className="meta">{at > today ? "Upcoming" : "—"}</span>
        )}
      </div>
      {month && (
        <div className="habit-month">
          <div className="month-meta">
            <span>
              {h.weekdays.length === 7
                ? "Daily"
                : h.weekdays
                    .map((d) => ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][d])
                    .join(" ")}{" "}
              · best {stats.best}d
            </span>
          </div>
          <div className="habit-grid">
            {daysBetween(month.start, month.end).map((d) => (
              <button
                key={d}
                disabled={!scheduled(h, d) || d > today}
                aria-label={`${h.title} ${d}${completed(h, data.entries, d) ? " complete" : ""}`}
                className={completed(h, data.entries, d) ? "filled" : ""}
                onClick={() => onDate(d)}
              >
                {Number(d.slice(-2))}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
export function ProjectRow({
  project: p,
  data,
  today,
  onEdit,
  children,
}: {
  project: Project;
  data: Backup;
  today: string;
  onEdit: () => void;
  children?: ReactNode;
}) {
  const progress = projectProgress(p.id, data.tasks, today);
  return (
    <div className="project-record">
      <div className="progress-row">
        <button className="record-name" onClick={onEdit}>
          {p.title}
          {p.status !== "active" && <span>{p.status}</span>}
        </button>
        <Meter value={progress} label={p.title} />
        <span className="numeric">{Math.round(progress)}%</span>
        <time className="meta">{p.deadline?.slice(5) || "—"}</time>
      </div>
      {children}
    </div>
  );
}
export function GoalRow({
  goal: g,
  data,
  today,
  onEdit,
}: {
  goal: Goal;
  data: Backup;
  today: string;
  onEdit: () => void;
}) {
  const v = goalProgress(g, data, today);
  return (
    <div className="progress-row">
      <button className="record-name" onClick={onEdit}>
        {g.title}
        {g.archived && <span>archived</span>}
      </button>
      {!v.missing && (
        <Meter value={(v.value / g.target) * 100} label={g.title} />
      )}
      <span className="numeric">
        {v.missing
          ? "Source removed"
          : `${Math.round(v.value * 100) / 100} / ${g.target}${g.source === "project" ? "%" : ""}`}
      </span>
      <time className="meta">{g.deadline?.slice(5) || "—"}</time>
    </div>
  );
}
