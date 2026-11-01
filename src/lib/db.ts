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
} from "./domain";
export const db = new Dexie("productivity-vault") as Dexie & {
  habits: EntityTable<Habit, "id">;
  entries: EntityTable<Entry, "id">;
  tasks: EntityTable<Task, "id">;
  templates: EntityTable<Template, "id">;
  projects: EntityTable<Project, "id">;
  goals: EntityTable<Goal, "id">;
  settings: EntityTable<Settings, "id">;
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
    version: 1,
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
  const b = backupSchema.parse(input);
  await db.transaction("rw", db.tables, async () => {
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
