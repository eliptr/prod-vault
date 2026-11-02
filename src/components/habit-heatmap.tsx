"use client";
import {
  useId,
  useRef,
  useState,
  type ReactNode,
  type KeyboardEvent,
} from "react";
import {
  addDays,
  daysBetween,
  logged,
  scheduled,
  weekday,
  type Entry,
  type Habit,
} from "@/lib/domain";
import { DateValue } from "./date-value";

export default function HabitHeatmap({
  habit,
  entries,
  month,
  today,
  weekStart,
  controls,
  onDate,
}: {
  habit: Habit;
  entries: Entry[];
  month: { start: string; end: string };
  today: string;
  weekStart: number;
  controls: (date: string) => ReactNode;
  onDate: (date: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const helpId = useId();
  const [selected, setSelected] = useState("");
  const [focused, setFocused] = useState("");
  const dates = daysBetween(month.start, month.end);
  const editable = dates.filter(
    (d) => scheduled(habit, d) && d <= today && !habit.archived,
  );
  const focusDate = editable.includes(focused) ? focused : editable.at(-1);
  const selectedDate = dates.includes(selected) ? selected : "";
  const offset = (weekday(month.start) - weekStart + 7) % 7;
  const length = Math.ceil((offset + dates.length) / 7) * 7;
  const valueAt = (d: string) =>
    entries.find((e) => e.habitId === habit.id && e.date === d)?.value || 0;
  function focus(date: string) {
    setFocused(date);
    ref.current
      ?.querySelector<HTMLButtonElement>(`[data-date="${date}"]`)
      ?.focus();
  }
  function move(event: KeyboardEvent<HTMLButtonElement>, date: string) {
    const steps: Record<string, number> = {
      ArrowRight: 7,
      ArrowLeft: -7,
      ArrowUp: -1,
      ArrowDown: 1,
    };
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const next = event.key === "Home" ? editable[0] : editable.at(-1);
      if (next) focus(next);
    } else if (steps[event.key]) {
      event.preventDefault();
      const step = steps[event.key];
      let next = addDays(date, step);
      while (next >= month.start && next <= month.end) {
        if (editable.includes(next)) {
          focus(next);
          break;
        }
        next = addDays(next, step);
      }
    }
  }
  return (
    <div className="habit-month">
      <div
        ref={ref}
        className="habit-grid"
        role="group"
        aria-label={`${habit.title} monthly history`}
        aria-describedby={helpId}
      >
        <span id={helpId} className="sr-only">
          Arrow keys move by day vertically and week horizontally. Home and End
          select the first and last available day. Activate a date to edit it.
        </span>
        {Array.from({ length: 7 }, (_, i) => (
          <span className="heatmap-day" key={`day-${i}`}>
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][(i + weekStart) % 7]}
          </span>
        ))}
        {Array.from({ length }, (_, i) => {
          const d = dates[i - offset];
          if (!d)
            return (
              <span
                className="heatmap-pad"
                key={`pad-${i}`}
                aria-hidden="true"
              />
            );
          const value = valueAt(d);
          const active = scheduled(habit, d);
          const complete = logged(habit, entries, d);
          const level =
            value <= 0
              ? 0
              : habit.period === "weekly" || habit.kind === "check"
                ? Number(complete) * 3
                : Math.max(1, Math.ceil(Math.min(1, value / habit.target) * 3));
          const recorded =
            habit.period === "weekly"
              ? value > 0
                ? "Checked"
                : "Not checked"
              : `${value} / ${habit.target}${habit.unit ? " " + habit.unit : ""}`;
          const detail = [
            !active ? "Not scheduled" : d > today ? "Upcoming" : "",
            recorded,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <button
              key={d}
              data-date={d}
              data-level={level}
              disabled={!editable.includes(d)}
              tabIndex={d === focusDate ? 0 : -1}
              className={`${selectedDate === d ? "selected" : ""} ${!active ? "unscheduled" : ""}`}
              aria-label={`${habit.title} ${d}${complete ? " complete" : ""} · ${detail}`}
              title={`${d} · ${detail}`}
              aria-pressed={selectedDate === d}
              onFocus={() => setFocused(d)}
              onClick={() => {
                setSelected((current) => (current === d ? "" : d));
                setFocused(d);
              }}
              onKeyDown={(e) => move(e, d)}
            >
              <span className="heatmap-square" aria-hidden="true" />
            </button>
          );
        })}
      </div>
      {selectedDate && (
        <div
          className="history-editor"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setSelected("");
              focus(selectedDate);
            }
          }}
        >
          <DateValue date={selectedDate} />
          {controls(selectedDate)}
          <button className="text-action" onClick={() => onDate(selectedDate)}>
            Open calendar
          </button>
        </div>
      )}
    </div>
  );
}
