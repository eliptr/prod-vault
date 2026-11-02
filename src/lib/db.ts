import Dexie, { type EntityTable } from "dexie";
import {
  type Habit,
  type Entry,
  type Task,
  type Template,
  type Project,
  type Goal,
  type Settings,
  type Backup,
  backupSchema,
  defaults,
  occurrences,
  normalizeBackup,
} from "./domain";
export const db = new Dexie("productivity-vault") as Dexie & {
  habits: EntityTable<Habit, "id">;
  entries: EntityTable<Entry, "id">;
  tasks: EntityTable<Task, "id">;
  templates: EntityTable<Template, "id">;
  projects: EntityTable<Project, "id">;
  goals: EntityTable<Goal, "id">;
  settings: EntityTable<Settings, "id">;
  recoveries: EntityTable<
    { id: string; createdAt: string; data: unknown },
    "id"
  >;
};
db.version(1).stores({
  habits: "id, archived",
  entries: "id, &[habitId+date], date",
  tasks: "id, due, projectId, templateId",
  templates: "id",
  projects: "id",
  goals: "id",
  settings: "id",
});
db.version(2).stores({ templates: "id, projectId" });
db.version(3)
  .stores({ recoveries: "id, createdAt" })
  .upgrade(async (tx) => {
    const raw = {
      version: 1,
      exportedAt: new Date().toISOString(),
      habits: await tx.table("habits").toArray(),
      entries: await tx.table("entries").toArray(),
      tasks: await tx.table("tasks").toArray(),
      templates: await tx.table("templates").toArray(),
      projects: await tx.table("projects").toArray(),
      goals: await tx.table("goals").toArray(),
      settings: (await tx.table("settings").get("settings")) || defaults,
    };
    if (raw.templates.some((t) => t.frequency === "daily" && !t.retired))
      await tx
        .table("recoveries")
        .add({ id: crypto.randomUUID(), createdAt: raw.exportedAt, data: raw });
    const b = normalizeBackup(raw);
    for (const name of ["habits", "tasks", "templates"] as const) {
      await tx.table(name).clear();
      await tx.table(name).bulkPut(b[name]);
    }
  });
export async function snapshot(): Promise<Backup> {
  const [habits, entries, tasks, templates, projects, goals, settings] =
    await Promise.all([
      db.habits.toArray(),
      db.entries.toArray(),
      db.tasks.toArray(),
      db.templates.toArray(),
      db.projects.toArray(),
      db.goals.toArray(),
      db.settings.get("settings"),
    ]);
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    habits,
    entries,
    tasks,
    templates,
    projects,
    goals,
    settings: settings || defaults,
  };
}
export async function restore(input: unknown) {
  const parsed = backupSchema.parse(input);
  const b = normalizeBackup(parsed);
  await db.transaction("rw", db.tables, async () => {
    if (parsed.templates.some((t) => t.frequency === "daily" && !t.retired))
      await db.recoveries.add({
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        data: structuredClone(input),
      });
    for (const name of [
      "habits",
      "entries",
      "tasks",
      "templates",
      "projects",
      "goals",
    ] as const) {
      await db[name].clear();
      await db.table(name).bulkPut(b[name]);
    }
    await db.settings.put(b.settings);
  });
}
export async function materialize(through: string) {
  await db.transaction("rw", [db.templates, db.tasks], async () => {
    const templates = await db.templates.toArray();
    const existing = new Set(await db.tasks.toCollection().primaryKeys());
    const items = templates
      .flatMap((t) =>
        occurrences(t, t.startDate > through ? t.startDate : through),
      )
      .filter((t) => !existing.has(t.id));
    await db.tasks.bulkPut(items);
  });
}
export async function remove(
  kind: "habit" | "task" | "project" | "goal",
  id: string,
) {
  await db.transaction("rw", db.tables, async () => {
    if (kind === "habit") {
      await db.entries.where("habitId").equals(id).delete();
      await db.habits.delete(id);
    }
    if (kind === "task") {
      const t = await db.tasks.get(id);
      if (t?.templateId) {
        await db.tasks.where("templateId").equals(t.templateId).delete();
        await db.templates.delete(t.templateId);
      } else await db.tasks.delete(id);
    }
    if (kind === "project") {
      await db.tasks.where("projectId").equals(id).modify({ projectId: null });
      await db.templates
        .where("projectId")
        .equals(id)
        .modify({ projectId: null });
      await db.projects.delete(id);
    }
    if (kind === "goal") await db.goals.delete(id);
  });
}
