import { z } from "zod";
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
  );
const base = {
  id: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
};
export const habitSchema = z.object({
  ...base,
  title: z.string().trim().min(1).max(100),
  icon: z.string().max(8),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  kind: z.enum(["check", "quantity"]),
  target: z.number().positive(),
  unit: z.string().max(30),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1),
  startDate: dateSchema,
  archived: z.boolean(),
});
export const entrySchema = z
  .object({
    id: z.string(),
    habitId: z.string(),
    date: dateSchema,
    value: z.number().min(0),
    updatedAt: z.string().datetime(),
  })
  .refine((e) => e.id === `${e.habitId}:${e.date}`, "Invalid habit entry ID");
const subtask = z.object({
  id: z.string(),
  title: z.string().trim().min(1),
  done: z.boolean(),
});
export const taskSchema = z.object({
  ...base,
  title: z.string().trim().min(1).max(200),
  notes: z.string(),
  due: dateSchema.nullable(),
  priority: z.enum(["low", "medium", "high"]),
  projectId: z.string().nullable(),
  done: z.boolean(),
  completedAt: z.string().datetime().nullable(),
  subtasks: z.array(subtask),
  templateId: z.string().nullable(),
});
export const templateSchema = z.object({
  ...base,
  title: z.string().min(1),
  notes: z.string(),
  priority: z.enum(["low", "medium", "high"]),
  projectId: z.string().nullable(),
  frequency: z.enum(["daily", "weekly"]),
  startDate: dateSchema,
  endDate: dateSchema.nullable(),
  subtasks: z.array(subtask),
});
export const projectSchema = z.object({
  ...base,
  title: z.string().trim().min(1).max(100),
  description: z.string(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  deadline: dateSchema.nullable(),
  status: z.enum(["active", "completed", "archived"]),
});
export const goalSchema = z
  .object({
    ...base,
    title: z.string().trim().min(1).max(100),
    source: z.enum(["manual", "project", "habit"]),
    sourceId: z.string().nullable(),
    target: z.number().positive(),
    value: z.number().min(0),
    startDate: dateSchema,
    deadline: dateSchema.nullable(),
    archived: z.boolean(),
  })
  .refine(
    (g) => !g.deadline || g.deadline >= g.startDate,
    "Deadline must be on or after the start date",
  )
  .refine(
    (g) => g.source === "manual" || !!g.sourceId,
    "Choose a progress source",
  );
export const settingsSchema = z.object({
  id: z.literal("settings"),
  theme: z.enum(["light", "dark", "system"]),
  timezone: z.string().refine((v) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }),
  weekStart: z.union([z.literal(0), z.literal(1)]),
  lastExport: z.string().datetime().nullable(),
  reminderDismissed: z.string().datetime().nullable(),
});
export const backupSchema = z
  .object({
    version: z.literal(1),
    exportedAt: z.string().datetime(),
    habits: z.array(habitSchema),
    entries: z.array(entrySchema),
    tasks: z.array(taskSchema),
    templates: z.array(templateSchema),
    projects: z.array(projectSchema),
    goals: z.array(goalSchema),
    settings: settingsSchema,
  })
  .superRefine((v, ctx) => {
    for (const key of [
      "habits",
      "entries",
      "tasks",
      "templates",
      "projects",
      "goals",
    ] as const)
      if (new Set(v[key].map((x) => x.id)).size !== v[key].length)
        ctx.addIssue({ code: "custom", message: `Duplicate ${key} IDs` });
    if (
      new Set(v.entries.map((x) => `${x.habitId}:${x.date}`)).size !==
      v.entries.length
    )
      ctx.addIssue({ code: "custom", message: "Duplicate habit dates" });
    if (v.entries.some((e) => !v.habits.some((h) => h.id === e.habitId)))
      ctx.addIssue({ code: "custom", message: "Unknown habit in entry" });
    if (
      v.tasks.some(
        (t) => t.projectId && !v.projects.some((p) => p.id === t.projectId),
      ) ||
      v.templates.some(
        (t) => t.projectId && !v.projects.some((p) => p.id === t.projectId),
      )
    )
      ctx.addIssue({ code: "custom", message: "Unknown project" });
    if (
      v.tasks.some(
        (t) => t.templateId && !v.templates.some((r) => r.id === t.templateId),
      )
    )
      ctx.addIssue({ code: "custom", message: "Unknown recurring template" });
  });
export type Habit = z.infer<typeof habitSchema>;
export type Entry = z.infer<typeof entrySchema>;
export type Task = z.infer<typeof taskSchema>;
export type Template = z.infer<typeof templateSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type Backup = z.infer<typeof backupSchema>;
export const defaults: Settings = {
  id: "settings",
  theme: "system",
  timezone: "Europe/Athens",
  weekStart: 1,
  lastExport: null,
  reminderDismissed: null,
};
export function todayIn(timezone: string, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function addDays(date: string, amount: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}
export function daysBetween(start: string, end: string) {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}
export function weekday(date: string) {
  return new Date(date + "T12:00:00Z").getUTCDay();
}
export function scheduled(h: Habit, date: string) {
  return date >= h.startDate && h.weekdays.includes(weekday(date));
}
export function completed(h: Habit, entries: Entry[], date: string) {
  return (
    (entries.find((e) => e.habitId === h.id && e.date === date)?.value ?? 0) >=
    h.target
  );
}
export function streaks(h: Habit, entries: Entry[], today: string) {
  let best = 0,
    run = 0,
    current = 0;
  for (const d of daysBetween(h.startDate, today)) {
    if (!scheduled(h, d)) continue;
    if (completed(h, entries, d)) {
      run++;
      best = Math.max(best, run);
    } else if (d !== today) run = 0;
  }
  current = run;
  return { current, best };
}
export function occurrences(t: Template, through: string): Task[] {
  return daysBetween(
    t.startDate,
    t.endDate && t.endDate < through ? t.endDate : through,
  )
    .filter(
      (d) => t.frequency === "daily" || weekday(d) === weekday(t.startDate),
    )
    .map((d) => ({
      id: `${t.id}:${d}`,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      title: t.title,
      notes: t.notes,
      due: d,
      priority: t.priority,
      projectId: t.projectId,
      done: false,
      completedAt: null,
      subtasks: t.subtasks.map((s) => ({ ...s, done: false })),
      templateId: t.id,
    }));
}
export function projectProgress(id: string, tasks: Task[], today: string) {
  const items = tasks.filter(
    (t) =>
      t.projectId === id &&
      (!t.templateId || (t.due !== null && t.due <= today)),
  );
  return items.length
    ? (items.filter((t) => t.done).length / items.length) * 100
    : 0;
}
export function goalProgress(
  g: Goal,
  data: Pick<Backup, "projects" | "tasks" | "habits" | "entries">,
  today: string,
) {
  if (g.source === "manual") return { value: g.value, missing: false };
  if (g.source === "project")
    return {
      value: projectProgress(g.sourceId!, data.tasks, today),
      missing: !data.projects.some((p) => p.id === g.sourceId),
    };
  const h = data.habits.find((h) => h.id === g.sourceId);
  return {
    missing: !h,
    value: h
      ? data.entries
          .filter(
            (e) =>
              e.habitId === h.id &&
              e.date >= g.startDate &&
              e.date <= (g.deadline || today) &&
              e.date <= today,
          )
          .reduce(
            (s, e) =>
              s + (h.kind === "check" ? Number(e.value >= h.target) : e.value),
            0,
          )
      : 0,
  };
}
