"use client";
import { useId, useState } from "react";
import CenteredDialog from "./dialog";
import { ZodError } from "zod";
import { db, remove } from "@/lib/db";
import {
  addDays,
  habitSchema,
  taskSchema,
  templateSchema,
  projectSchema,
  goalSchema,
  type Backup,
  type Habit,
  type Task,
  type Project,
  type Goal,
} from "@/lib/domain";
export type Edit = {
  kind: "habit" | "task" | "project" | "goal";
  record?: Habit | Task | Project | Goal;
  projectId?: string;
};
export default function Editor({
  edit,
  data,
  today,
  onClose,
  onError,
}: {
  edit: Edit;
  data: Backup;
  today: string;
  onClose: () => void;
  onError: (s: string) => void;
}) {
  const formId = useId();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState(
    edit.kind === "goal" ? (edit.record as Goal)?.source || "manual" : "manual",
  );
  const [kind, setKind] = useState(
    (edit.record as Habit)?.period === "weekly"
      ? "weekly"
      : (edit.record as Habit)?.kind || "check",
  );
  const r = edit.record;
  const h = r as Habit | undefined;
  const t = r as Task | undefined;
  const p = r as Project | undefined;
  const g = r as Goal | undefined;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const f = new FormData(event.currentTarget);
    const s = (key: string) => String(f.get(key) || "");
    const stamp = new Date().toISOString();
    const base = {
      id: r?.id || crypto.randomUUID(),
      createdAt: r?.createdAt || stamp,
      updatedAt: stamp,
      title: s("title"),
    };
    try {
      if (edit.kind === "habit")
        await db.habits.put(
          habitSchema.parse({
            ...base,
            icon: s("icon") || "✦",
            color: s("color"),
            kind: kind === "weekly" ? "quantity" : kind,
            period: kind === "weekly" ? "weekly" : "daily",
            target: kind === "check" ? 1 : Number(s("target")),
            unit: s("unit"),
            weekdays:
              kind === "weekly"
                ? [0, 1, 2, 3, 4, 5, 6]
                : f.getAll("weekdays").map(Number),
            startDate: h?.startDate || today,
            archived: h?.archived || false,
          }),
        );
      if (edit.kind === "project")
        await db.projects.put(
          projectSchema.parse({
            ...base,
            description: s("description"),
            color: s("color"),
            deadline: s("deadline") || null,
            status: s("status"),
          }),
        );
      if (edit.kind === "goal")
        await db.goals.put(
          goalSchema.parse({
            ...base,
            source,
            sourceId: source === "manual" ? null : s("sourceId") || null,
            target: source === "project" ? 100 : Number(s("target")),
            value: Number(s("value") || 0),
            startDate: s("startDate"),
            deadline: s("deadline") || null,
            archived: g?.archived || false,
          }),
        );
      if (edit.kind === "task") {
        const oldTemplate = t?.templateId
          ? data.templates.find((v) => v.id === t.templateId && !v.retired)
          : undefined;
        const subtasks = s("subtasks")
          .split("\n")
          .map((v) => v.trim())
          .filter(Boolean)
          .map((title, i) => ({
            id: t?.subtasks[i]?.id || crypto.randomUUID(),
            title,
            done: t?.subtasks[i]?.done || false,
          }));
        const task = taskSchema.parse({
          ...base,
          notes: s("notes"),
          due: s("due") || null,
          priority: s("priority"),
          projectId: s("projectId") || null,
          done: t?.done || false,
          completedAt: t?.completedAt || null,
          subtasks,
          templateId: s("frequency") === "daily" ? null : t?.templateId || null,
          showDaily: s("frequency") === "daily",
        });
        const frequency = s("frequency");
        if (frequency !== "none" && !task.due)
          throw new Error("Choose a due date for a recurring task.");
        await db.transaction("rw", [db.tasks, db.templates], async () => {
          if (!r && frequency === "weekly") {
            const id = crypto.randomUUID();
            await db.templates.put(
              templateSchema.parse({
                ...task,
                id,
                frequency,
                startDate: task.due,
                endDate: null,
              }),
            );
          } else {
            if (!oldTemplate && frequency === "weekly") {
              const id = crypto.randomUUID();
              await db.templates.put(
                templateSchema.parse({
                  ...task,
                  id,
                  frequency,
                  startDate: addDays(
                    task.due && task.due > today ? task.due : today,
                    7,
                  ),
                  endDate: null,
                }),
              );
              task.templateId = id;
            }
            await db.tasks.put(task);
            if (oldTemplate) {
              await db.templates.update(oldTemplate.id, { endDate: today });
              if (frequency !== "weekly") task.templateId = null;
              await db.tasks.put(task);
              await db.tasks
                .where("templateId")
                .equals(oldTemplate.id)
                .filter((v) => !!v.due && v.due > today && !v.done)
                .delete();
              if (frequency === "weekly")
                await db.templates.put(
                  templateSchema.parse({
                    ...task,
                    id: crypto.randomUUID(),
                    frequency,
                    startDate: addDays(today, 7),
                    endDate: null,
                  }),
                );
            }
          }
        });
      }
      onClose();
    } catch (e) {
      setError(
        e instanceof ZodError
          ? e.issues.map((issue) => issue.message).join(" ")
          : e instanceof Error
            ? e.message
            : "Could not save. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function destroy() {
    if (!r) return;
    if (
      !confirm(
        `Permanently delete this ${edit.kind}? ${edit.kind === "task" && t?.templateId ? "This removes the entire recurring series." : "This cannot be undone."}`,
      )
    )
      return;
    setBusy(true);
    try {
      await remove(edit.kind, r.id);
      onClose();
    } catch {
      onError("Could not delete this item.");
    } finally {
      setBusy(false);
    }
  }
  async function archive() {
    if (!r) return;
    try {
      if (edit.kind === "habit")
        await db.habits.update(r.id, { archived: !h?.archived });
      if (edit.kind === "goal")
        await db.goals.update(r.id, { archived: !g?.archived });
      onClose();
    } catch {
      onError("Could not archive this item.");
    }
  }
  return (
    <CenteredDialog
      title={`${r ? "Edit" : "New"} ${edit.kind}`}
      onClose={onClose}
      footer={
        <>
          {r && (
            <button
              type="button"
              className="danger"
              disabled={busy}
              onClick={destroy}
            >
              Delete
            </button>
          )}
          {r && (edit.kind === "habit" || edit.kind === "goal") && (
            <button type="button" disabled={busy} onClick={archive}>
              {h?.archived || g?.archived ? "Unarchive" : "Archive"}
            </button>
          )}
          <button
            type="submit"
            form={formId}
            className="primary"
            disabled={busy}
          >
            {busy ? "Saving…" : "Save " + edit.kind}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="editor-form">
        <label>
          Name
          <input
            name="title"
            defaultValue={r?.title}
            required
            maxLength={edit.kind === "task" ? 200 : 100}
          />
        </label>
        {edit.kind === "habit" && (
          <>
            <div className="form-row">
              <label>
                Icon
                <input
                  name="icon"
                  defaultValue={h?.icon || "✦"}
                  maxLength={8}
                />
              </label>
              <label>
                Color
                <input
                  type="color"
                  name="color"
                  defaultValue={h?.color || "#87a993"}
                />
              </label>
            </div>
            <label>
              Tracking
              <select
                value={kind}
                onChange={(e) =>
                  setKind(e.target.value as "check" | "quantity")
                }
              >
                <option value="check">Daily check-off</option>
                <option value="quantity">Daily quantity target</option>
                <option value="weekly">Weekly quantity target</option>
              </select>
            </label>
            {kind !== "check" && (
              <div className="form-row">
                <label>
                  {kind === "weekly" ? "Weekly target" : "Daily target"}
                  <input
                    type="number"
                    name="target"
                    min="0.01"
                    step="any"
                    defaultValue={h?.target || 30}
                    required
                  />
                </label>
                <label>
                  Unit
                  <input
                    name="unit"
                    defaultValue={
                      h?.unit || (kind === "weekly" ? "sessions" : "minutes")
                    }
                    maxLength={30}
                  />
                </label>
              </div>
            )}
            {kind !== "weekly" && (
              <fieldset>
                <legend>Scheduled days</legend>
                <div className="weekdays">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (day, i) => (
                      <label key={day}>
                        <input
                          type="checkbox"
                          name="weekdays"
                          value={i}
                          defaultChecked={h ? h.weekdays.includes(i) : true}
                        />
                        <span>{day}</span>
                      </label>
                    ),
                  )}
                </div>
              </fieldset>
            )}
            <p className="hint">Schedule/target edits affect history.</p>
          </>
        )}
        {edit.kind === "task" && (
          <>
            <label>
              Notes
              <textarea name="notes" defaultValue={t?.notes} rows={3} />
            </label>
            <div className="form-row">
              <label>
                Due date
                <input type="date" name="due" defaultValue={t?.due || ""} />
              </label>
              <label>
                Priority
                <select name="priority" defaultValue={t?.priority || "medium"}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
            </div>
            <label>
              Project
              <select
                name="projectId"
                defaultValue={t?.projectId || edit.projectId || ""}
              >
                <option value="">No project</option>
                {data.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Schedule
              <select
                name="frequency"
                defaultValue={
                  t?.showDaily
                    ? "daily"
                    : data.templates.find(
                        (v) => v.id === t?.templateId && !v.retired,
                      )?.frequency || "none"
                }
              >
                <option value="none">One time</option>
                <option value="daily">Show daily until completed</option>
                <option value="weekly">Repeat weekly</option>
              </select>
            </label>
            {t?.templateId && (
              <p className="hint">Series changes apply after today.</p>
            )}
            <label>
              Subtasks <span className="hint">one per line</span>
              <textarea
                name="subtasks"
                defaultValue={t?.subtasks.map((s) => s.title).join("\n")}
                rows={3}
              />
            </label>
          </>
        )}
        {edit.kind === "project" && (
          <>
            <label>
              Description
              <textarea
                name="description"
                defaultValue={p?.description}
                rows={3}
              />
            </label>
            <div className="form-row">
              <label>
                Deadline
                <input
                  type="date"
                  name="deadline"
                  defaultValue={p?.deadline || ""}
                />
              </label>
              <label>
                Color
                <input
                  type="color"
                  name="color"
                  defaultValue={p?.color || "#e0b276"}
                />
              </label>
            </div>
            <label>
              Status
              <select name="status" defaultValue={p?.status || "active"}>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          </>
        )}
        {edit.kind === "goal" && (
          <>
            <label>
              Progress source
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as Goal["source"])}
              >
                <option value="manual">Manual number</option>
                <option value="project">Project completion</option>
                <option value="habit">Habit total</option>
              </select>
            </label>
            {source !== "manual" && (
              <label>
                {source === "habit" ? "Habit" : "Project"}
                <select
                  name="sourceId"
                  defaultValue={g?.sourceId || ""}
                  required
                >
                  <option value="">Choose a source</option>
                  {(source === "habit" ? data.habits : data.projects).map(
                    (v) => (
                      <option key={v.id} value={v.id}>
                        {v.title}
                      </option>
                    ),
                  )}
                </select>
              </label>
            )}
            <div className="form-row">
              {source !== "project" && (
                <label>
                  Target
                  <input
                    name="target"
                    type="number"
                    min="0.01"
                    step="any"
                    defaultValue={g?.target || 100}
                    required
                  />
                </label>
              )}
              {source === "manual" && (
                <label>
                  Current value
                  <input
                    name="value"
                    type="number"
                    min="0"
                    step="any"
                    defaultValue={g?.value || 0}
                    required
                  />
                </label>
              )}
            </div>
            <div className="form-row">
              <label>
                Start date
                <input
                  name="startDate"
                  type="date"
                  defaultValue={g?.startDate || today}
                  required
                />
              </label>
              <label>
                Deadline
                <input
                  name="deadline"
                  type="date"
                  defaultValue={g?.deadline || ""}
                />
              </label>
            </div>
          </>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </form>
    </CenteredDialog>
  );
}
