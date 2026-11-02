"use client";
import { useEffect, useId, useState, type ReactNode } from "react";
import { Check, ChevronDown, Minus, Pencil, Plus } from "lucide-react";
import HabitHeatmap from "./habit-heatmap";
import {
  addDays,
  daysBetween,
  goalProgress,
  projectProgress,
  scheduled,
  streaks,
  weeklyTotal,
  logged,
  type Backup,
  type Habit,
  type Task,
  type Project,
  type Goal,
} from "@/lib/domain";

import { DateValue, dateLabel } from "./date-value";
export { DateValue, dateLabel } from "./date-value";
function RecordName({
  children,
  onClick,
  icon,
  color,
}: {
  children: ReactNode;
  onClick: () => void;
  icon?: string;
  color?: string;
}) {
  return (
    <button className="record-name" title="Edit" onClick={onClick}>
      {icon && (
        <span className="habit-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      {color && (
        <span
          className="color-dot"
          style={{ background: color }}
          aria-hidden="true"
        />
      )}
      <span className="name-text">{children}</span>
      <Pencil size={12} aria-hidden="true" className="edit-mark" />
    </button>
  );
}
export function ValueControl({
  value,
  label,
  onSet,
  onStep,
}: {
  value: number;
  label: string;
  onSet: (value: number) => void;
  onStep: (delta: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [invalid, setInvalid] = useState(false);
  const id = useId();
  useEffect(() => {
    setDraft(String(value));
    setInvalid(false);
  }, [value]);
  function save() {
    const n = Number(draft);
    if (draft.trim() && Number.isFinite(n) && n >= 0) {
      setInvalid(false);
      if (n !== value) onSet(n);
    } else setInvalid(true);
  }
  return (
    <span className="value-field">
      <span className="value-control">
        <button
          aria-label={`Decrease ${label}`}
          disabled={value <= 0}
          onClick={() => onStep(-1)}
        >
          <Minus size={14} aria-hidden="true" />
        </button>
        <input
          aria-label={label}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? id : undefined}
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          style={{ width: `${Math.min(9, Math.max(3, draft.length + 1))}ch` }}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setInvalid(false);
          }}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
            if (e.key === "Escape") {
              setDraft(String(value));
              setInvalid(false);
              e.stopPropagation();
            }
          }}
        />
        <button aria-label={`Increase ${label}`} onClick={() => onStep(1)}>
          <Plus size={14} aria-hidden="true" />
        </button>
      </span>
      {invalid && (
        <span className="field-error" id={id} role="alert">
          Enter 0 or more
        </span>
      )}
    </span>
  );
}
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
    <section className={`section section-${title.toLowerCase()}`}>
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
            <Plus size={14} aria-hidden="true" />
            Add
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
          {item.label}
          <strong>{item.value}</strong>
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
  showPriority = true,
}: {
  task: Task;
  project?: string;
  today: string;
  onEdit: () => void;
  onToggle: () => void;
  onSubtask: (id: string) => void;
  showPriority?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  return (
    <div className="task-row">
      <div className="task-main">
        <button
          className={"check " + (t.done ? "checked" : "")}
          aria-label={`${t.done ? "Reopen" : "Complete"} ${t.title}`}
          aria-pressed={t.done}
          onClick={onToggle}
        >
          {t.done ? (
            <Check size={16} aria-hidden="true" />
          ) : (
            <span className="check-ring" aria-hidden="true" />
          )}
        </button>
        <div className="task-content">
          <button
            className="task-title"
            title="Edit task"
            aria-label={`${t.title}${t.templateId ? " · Repeating" : ""}`}
            onClick={onEdit}
          >
            <strong className={t.done ? "struck" : ""}>{t.title}</strong>
            <Pencil size={12} aria-hidden="true" className="edit-mark" />
          </button>
          <div className="task-meta">
            {t.templateId && <span>Repeating</span>}
            {project && <span>{project}</span>}
            {showPriority && (
              <span className="priority" title={`Priority: ${t.priority}`}>
                {t.priority}
              </span>
            )}
            {t.showDaily && <span>Daily</span>}
            {t.due &&
              (t.due === today ? (
                <time dateTime={t.due}>Today</time>
              ) : (
                <DateValue date={t.due} overdue={t.due < today && !t.done} />
              ))}
          </div>
        </div>
        {(t.notes || t.subtasks.length > 0) && (
          <button
            className="expand"
            aria-label={`Details for ${t.title}`}
            aria-expanded={expanded}
            aria-controls={detailsId}
            onClick={() => setExpanded(!expanded)}
          >
            {t.subtasks.length > 0 && (
              <span>
                {t.subtasks.filter((s) => s.done).length}/{t.subtasks.length}
              </span>
            )}
            <ChevronDown
              size={14}
              aria-hidden="true"
              className={expanded ? "rotated" : ""}
            />
          </button>
        )}
      </div>
      {expanded && (
        <div className="task-details" id={detailsId}>
          {t.notes && <p>{t.notes}</p>}
          {t.subtasks.map((s) => (
            <label key={s.id}>
              <input
                type="checkbox"
                checked={s.done}
                onChange={() => onSubtask(s.id)}
              />
              <span className={s.done ? "struck" : ""}>{s.title}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
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
  onAdjust,
}: {
  habit: Habit;
  data: Backup;
  today: string;
  at?: string;
  month?: { start: string; end: string };
  onEdit: () => void;
  onEntry: (date: string, value: number) => void;
  onDate: (date: string) => void;
  onAdjust: (date: string, delta: number) => void;
}) {
  const valueAt = (date: string) =>
    data.entries.find((e) => e.habitId === h.id && e.date === date)?.value || 0;
  const value = valueAt(at);
  const stats = streaks(h, data.entries, today, data.settings.weekStart);
  const weekly = h.period === "weekly";
  const inlineCheck = !!month && (weekly || h.kind === "check");
  const total = weekly
    ? weeklyTotal(h, data.entries, at, data.settings.weekStart)
    : value;
  const history = daysBetween(addDays(at, -6), at);
  function controls(date: string) {
    const v = valueAt(date);
    if (h.archived || date > today || !scheduled(h, date))
      return (
        <span className="meta">
          {date > today
            ? "Upcoming"
            : h.archived
              ? "Archived"
              : "Not scheduled"}
        </span>
      );
    if (h.kind === "check" || weekly)
      return (
        <button
          className={
            "check " + ((weekly ? v > 0 : v >= h.target) ? "checked" : "")
          }
          aria-label={`${(weekly ? v > 0 : v >= h.target) ? "Reopen" : "Complete"} ${h.title}`}
          aria-pressed={weekly ? v > 0 : v >= h.target}
          onClick={() =>
            onEntry(
              date,
              (weekly ? v > 0 : v >= h.target) ? 0 : weekly ? 1 : h.target,
            )
          }
        >
          {(weekly ? v > 0 : v >= h.target) ? (
            <Check size={16} aria-hidden="true" />
          ) : (
            <span className="check-ring" aria-hidden="true" />
          )}
        </button>
      );
    return (
      <ValueControl
        value={v}
        label={`${h.title} quantity for ${date}`}
        onSet={(n) => onEntry(date, n)}
        onStep={(delta) => onAdjust(date, delta)}
      />
    );
  }
  return (
    <div
      className={
        "habit-record" +
        (month ? " has-month" : "") +
        (inlineCheck ? " inline-check" : "")
      }
    >
      <div className="habit-row">
        <div className="habit-identity">
          <RecordName onClick={onEdit} icon={h.icon}>
            {h.title}
            {h.archived && <span className="meta"> · archived</span>}
          </RecordName>
          <div className="habit-meta">
            {h.kind !== "check" && (
              <span className={weekly ? "weekly-progress" : ""}>
                {weekly
                  ? `${total} / ${h.target}${month ? "" : " this week"}`
                  : `${value} / ${h.target} ${h.unit}`}
              </span>
            )}
            {!month && (
              <span
                className="history"
                role="img"
                aria-label={history
                  .map(
                    (d) =>
                      `${d}: ${!scheduled(h, d) ? "not scheduled" : logged(h, data.entries, d) ? "complete" : "incomplete"}`,
                  )
                  .join("; ")}
              >
                {history.map((d) => (
                  <i
                    key={d}
                    className={
                      logged(h, data.entries, d)
                        ? "filled"
                        : !scheduled(h, d)
                          ? "unscheduled"
                          : ""
                    }
                  />
                ))}
              </span>
            )}
            <span
              className="streak"
              title={`Current streak ${stats.current}; best ${stats.best}`}
              aria-label={`Streak ${stats.current}, best ${stats.best}`}
            >
              {month
                ? `Streak ${stats.current} / ${stats.best}${weekly ? "w" : "d"}`
                : `${stats.current}${weekly ? "w" : "d"}`}
            </span>
            {inlineCheck && <div className="habit-control">{controls(at)}</div>}
          </div>
          {weekly &&
            (!Number.isInteger(h.target) || h.target < 1 || h.target > 7) && (
              <span className="field-error">Set target to 1–7 days</span>
            )}
        </div>
        {!inlineCheck && (
          <div
            className={
              weekly ? "habit-control weekly-quantity" : "habit-control"
            }
          >
            {controls(at)}
          </div>
        )}
      </div>
      {month && (
        <HabitHeatmap
          habit={h}
          entries={data.entries}
          month={month}
          today={today}
          weekStart={data.settings.weekStart}
          controls={controls}
          onDate={onDate}
        />
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
        <div className="record-identity">
          <RecordName onClick={onEdit} color={p.color}>
            {p.title}
          </RecordName>
          <div className="record-meta">
            {p.status !== "active" && <span>{p.status}</span>}
            <DateValue date={p.deadline} />
          </div>
        </div>
        <div className="progress-value">
          <span className="numeric">{Math.round(progress)}%</span>
          <Meter value={progress} label={p.title} />
        </div>
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
  onSet,
  onStep,
  sourceControl,
}: {
  goal: Goal;
  onSet: (value: number) => void;
  onStep: (delta: number) => void;
  sourceControl?: { label: string; content: ReactNode };
  data: Backup;
  today: string;
  onEdit: () => void;
}) {
  const [sourceExpanded, setSourceExpanded] = useState(false);
  const sourceId = useId();
  const v = goalProgress(g, data, today);
  return (
    <div className="goal-record">
      <div className="progress-row">
        <div className="record-identity">
          <RecordName onClick={onEdit}>{g.title}</RecordName>
          <div className="record-meta">
            {g.archived && <span>Archived</span>}
            <DateValue date={g.deadline} />
            <span>
              {g.source === "manual"
                ? `Target ${g.target}`
                : g.source === "habit"
                  ? "Habit total"
                  : "Project completion"}
            </span>
          </div>
        </div>
        <div className="goal-actions">
          {!v.missing && sourceControl && (
            <button
              className="goal-source-toggle"
              aria-expanded={sourceExpanded}
              aria-controls={sourceId}
              onClick={() => setSourceExpanded(!sourceExpanded)}
            >
              <ChevronDown
                size={12}
                className={sourceExpanded ? "rotated" : ""}
                aria-hidden="true"
              />
              {sourceControl.label}
            </button>
          )}
          <div className="goal-value">
            {g.source === "manual" && !g.archived ? (
              <ValueControl
                value={g.value}
                label={`Progress for ${g.title}`}
                onSet={onSet}
                onStep={onStep}
              />
            ) : (
              <span className="numeric">
                {v.missing
                  ? "Source removed"
                  : `${Math.round(v.value * 100) / 100} / ${g.target}${g.source === "project" ? "%" : ""}`}
              </span>
            )}
            {!v.missing && (
              <Meter value={(v.value / g.target) * 100} label={g.title} />
            )}
          </div>
        </div>
      </div>
      {!v.missing && sourceControl && (
        <div className="goal-source" id={sourceId} hidden={!sourceExpanded}>
          {sourceControl.content}
        </div>
      )}
    </div>
  );
}
