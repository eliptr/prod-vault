import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  todayIn,
  streaks,
  scheduled,
  completed,
  occurrences,
  projectProgress,
  goalProgress,
  goalSchema,
  backupSchema,
  defaults,
  weeklyTotal,
  weekStartFor,
  isTodayTask,
  normalizeBackup,
  type Habit,
  type Template,
  type Backup,
} from "../src/lib/domain";
const stamp = "2026-10-01T12:00:00.000Z";
test("one-time goal validation preserves legacy goals and requires binary manual progress", () => {
  const legacy = {
    id: "once",
    createdAt: stamp,
    updatedAt: stamp,
    title: "Appointment",
    source: "manual",
    sourceId: null,
    target: 1,
    value: 0,
    startDate: "2026-11-01",
    deadline: null,
    archived: false,
  };
  assert.equal(goalSchema.parse(legacy).oneTime, undefined);
  assert.equal(
    goalSchema.parse({ ...legacy, oneTime: true, value: 1 }).value,
    1,
  );
  assert.equal(
    goalSchema.safeParse({ ...legacy, oneTime: true, value: 2 }).success,
    false,
  );
  assert.equal(
    goalSchema.safeParse({
      ...legacy,
      oneTime: true,
      source: "habit",
      sourceId: "h",
    }).success,
    false,
  );
});
const habit: Habit = {
  id: "h",
  createdAt: stamp,
  updatedAt: stamp,
  title: "Read",
  icon: "✦",
  color: "#123456",
  kind: "quantity",
  period: "daily",
  unit: "pages",
  target: 10,
  weekdays: [1, 2, 3, 4, 5],
  startDate: "2026-10-26",
  archived: false,
};
const entry = (date: string, value = 10) => ({
  id: "h:" + date,
  habitId: "h",
  date,
  value,
  updatedAt: stamp,
});
test("scheduled weekdays, quantity thresholds, and editable history", () => {
  assert.equal(scheduled(habit, "2026-10-25"), false);
  assert.equal(scheduled(habit, "2026-10-31"), false);
  assert.equal(completed(habit, [entry("2026-10-26", 9)], "2026-10-26"), false);
  assert.equal(completed(habit, [entry("2026-10-26", 10)], "2026-10-26"), true);
});
test("today does not break streak; unscheduled weekends are ignored", () => {
  const entries = [
    "2026-10-26",
    "2026-10-27",
    "2026-10-28",
    "2026-10-29",
    "2026-10-30",
  ].map((d) => entry(d));
  assert.deepEqual(streaks(habit, entries, "2026-11-02"), {
    current: 5,
    best: 5,
  });
  assert.deepEqual(streaks(habit, entries, "2026-11-03"), {
    current: 0,
    best: 5,
  });
  assert.equal(
    streaks(
      habit,
      entries.filter((e) => e.date !== "2026-10-28"),
      "2026-11-02",
    ).current,
    2,
  );
});
test("calendar arithmetic survives DST and timezone midnight", () => {
  assert.equal(addDays("2026-10-25", 1), "2026-10-26");
  assert.equal(
    todayIn("Europe/Athens", new Date("2026-10-31T22:30:00Z")),
    "2026-11-01",
  );
  assert.equal(
    todayIn("Europe/Athens", new Date("2026-10-25T01:30:00Z")),
    "2026-10-25",
  );
});
const template: Template = {
  id: "r",
  createdAt: stamp,
  updatedAt: stamp,
  title: "Water plants",
  notes: "",
  priority: "low",
  projectId: "p",
  frequency: "daily",
  retired: false,
  startDate: "2026-10-26",
  endDate: null,
  subtasks: [],
};
test("daily and weekly recurrence preserves dated overdue occurrences", () => {
  const tasks = occurrences(template, "2026-10-29");
  assert.equal(tasks.length, 4);
  assert.equal(tasks[0].due, "2026-10-26");
  assert.equal(tasks[0].done, false);
  assert.equal(
    occurrences({ ...template, frequency: "weekly" }, "2026-11-09").length,
    3,
  );
  assert.equal(
    occurrences({ ...template, endDate: "2026-10-27" }, "2026-11-01").length,
    2,
  );
  assert.equal(new Set(tasks.map((t) => t.id)).size, 4);
});
test("project progress excludes future recurring instances", () => {
  const tasks = occurrences(template, "2026-10-30");
  tasks[0].done = true;
  assert.equal(projectProgress("p", tasks, "2026-10-27"), 50);
});
const backup: Backup = {
  version: 1,
  exportedAt: stamp,
  habits: [habit],
  entries: [],
  tasks: [],
  templates: [],
  projects: [],
  goals: [],
  settings: defaults,
};
test("goal progress uses date range, manual totals, and missing sources", () => {
  const g = {
    id: "g",
    createdAt: stamp,
    updatedAt: stamp,
    title: "Read 100",
    source: "habit" as const,
    sourceId: "h",
    target: 100,
    value: 0,
    startDate: "2026-10-27",
    deadline: null,
    archived: false,
  };
  assert.equal(
    goalProgress(
      g,
      { ...backup, entries: [entry("2026-10-26"), entry("2026-10-27")] },
      "2026-11-01",
    ).value,
    10,
  );
  assert.equal(
    goalProgress({ ...g, sourceId: "missing" }, backup, "2026-11-01").missing,
    true,
  );
  assert.equal(
    goalProgress({ ...g, source: "manual", value: 35 }, backup, "2026-11-01")
      .value,
    35,
  );
});
test("backup rejects invalid dates, duplicate entries, bad timezone, and dangling references", () => {
  assert.equal(backupSchema.safeParse(backup).success, true);
  assert.equal(
    backupSchema.safeParse({ ...backup, version: 3 }).success,
    false,
  );
  assert.equal(
    backupSchema.safeParse({ ...backup, entries: [entry("2026-02-30")] })
      .success,
    false,
  );
  assert.equal(
    backupSchema.safeParse({
      ...backup,
      entries: [entry("2026-10-26"), entry("2026-10-26")],
    }).success,
    false,
  );
  assert.equal(
    backupSchema.safeParse({
      ...backup,
      settings: { ...defaults, timezone: "Invalid/Zone" },
    }).success,
    false,
  );
  assert.equal(
    backupSchema.safeParse({
      ...backup,
      habits: [],
      entries: [entry("2026-10-26")],
    }).success,
    false,
  );
});
test("weekly targets count distinct days, cross DST, and respect week starts", () => {
  const h = {
    ...habit,
    period: "weekly" as const,
    target: 3,
    startDate: "2026-10-19",
  };
  const entries = [
    entry("2026-10-23", 5),
    entry("2026-10-24", 2),
    entry("2026-10-25", 1),
    entry("2026-10-26", 1),
  ];
  assert.equal(weeklyTotal(h, entries, "2026-10-25", 1), 3);
  assert.equal(weeklyTotal(h, entries, "2026-10-26", 1), 1);
  assert.equal(weeklyTotal(h, entries, "2026-10-26", 0), 2);
  assert.equal(weekStartFor("2026-10-25", 1), "2026-10-19");
  assert.deepEqual(streaks(h, entries, "2026-10-28", 1), {
    current: 1,
    best: 1,
  });
  assert.deepEqual(streaks(h, entries, "2026-11-02", 1), {
    current: 0,
    best: 1,
  });
  assert.equal(completed(h, entries, "2026-10-25", 1), true);
  assert.equal(
    completed(
      h,
      entries.filter((e) => e.date !== "2026-10-25"),
      "2026-10-25",
      1,
    ),
    false,
  );
  assert.equal(
    goalProgress(
      {
        ...backup.goals[0],
        id: "g",
        createdAt: stamp,
        updatedAt: stamp,
        title: "Sessions",
        source: "habit",
        sourceId: h.id,
        target: 10,
        value: 0,
        startDate: h.startDate,
        deadline: null,
        archived: false,
      },
      { ...backup, habits: [h], entries },
      "2026-10-26",
    ).value,
    4,
  );
});
test("daily display has a single completion before, on, and after its deadline", () => {
  const t = {
    ...occurrences(template, "2026-10-26")[0],
    templateId: null,
    showDaily: true,
    due: "2026-11-01",
  };
  for (const day of ["2026-10-26", "2026-11-01", "2026-11-05"])
    assert.equal(isTodayTask(t, day), true);
  assert.equal(isTodayTask({ ...t, done: true }, "2026-11-05"), false);
  assert.equal(isTodayTask({ ...t, showDaily: false }, "2026-10-26"), false);
});
test("normalization combines unfinished copies without mutating the input", () => {
  const tasks = occurrences(template, "2026-10-28");
  tasks[0].done = true;
  tasks[0].completedAt = stamp;
  tasks[1].notes = "Keep my note";
  const input = {
    ...backup,
    tasks,
    templates: [template],
    projects: [
      {
        id: "p",
        createdAt: stamp,
        updatedAt: stamp,
        title: "P",
        description: "",
        color: "#123456",
        deadline: null,
        status: "active" as const,
      },
    ],
  };
  const b = normalizeBackup(input);
  assert.equal(b.version, 2);
  assert.equal(b.tasks.length, 2);
  assert.equal(input.tasks.length, 3);
  assert.equal(b.tasks.find((t) => t.showDaily)?.id, tasks[1].id);
  assert.equal(b.tasks.find((t) => t.showDaily)?.notes, "Keep my note");
  assert.equal(b.tasks.find((t) => t.done)?.completedAt, stamp);
  assert.equal(b.templates[0].retired, true);
  assert.deepEqual(normalizeBackup(b), b);
});

test("weekly day counting preserves raw quantities and updates history and linked goals", () => {
  const h = {
    ...habit,
    period: "weekly" as const,
    target: 2,
    startDate: "2026-10-19",
  };
  const entries = [
    entry("2026-10-19", 3),
    entry("2026-10-20", 7),
    entry("2026-10-21", 0),
  ];
  const original = JSON.stringify(entries);
  const g = {
    id: "weekly-goal",
    createdAt: stamp,
    updatedAt: stamp,
    title: "Days",
    source: "habit" as const,
    sourceId: h.id,
    target: 10,
    value: 0,
    startDate: h.startDate,
    deadline: "2026-10-20",
    archived: false,
  };
  assert.equal(weeklyTotal(h, entries, "2026-10-21"), 2);
  assert.equal(weeklyTotal(h, [...entries, entries[0]], "2026-10-21"), 2);
  assert.equal(
    goalProgress(g, { ...backup, habits: [h], entries }, "2026-10-21").value,
    2,
  );
  assert.equal(
    goalProgress(
      { ...g, startDate: "2026-10-20" },
      { ...backup, habits: [h], entries },
      "2026-10-21",
    ).value,
    1,
  );
  assert.deepEqual(streaks(h, entries, "2026-10-28"), { current: 1, best: 1 });
  const corrected = entries.map((e) =>
    e.date === "2026-10-20" ? { ...e, value: 0 } : e,
  );
  assert.equal(weeklyTotal(h, corrected, "2026-10-21"), 1);
  assert.equal(
    goalProgress(
      g,
      { ...backup, habits: [h], entries: corrected },
      "2026-10-21",
    ).value,
    1,
  );
  assert.deepEqual(streaks(h, corrected, "2026-10-28"), {
    current: 0,
    best: 0,
  });
  assert.equal(JSON.stringify(entries), original);
  assert.equal(
    goalProgress(
      g,
      { ...backup, habits: [{ ...h, period: "daily" }], entries },
      "2026-10-21",
    ).value,
    10,
  );
  for (const version of [1, 2])
    for (const target of [30, 1.5]) {
      const restored = backupSchema.parse({
        ...backup,
        version,
        habits: [{ ...h, target }],
        entries,
      });
      assert.equal(restored.entries[0].value, 3);
      assert.equal(restored.habits[0].target, target);
    }
});
