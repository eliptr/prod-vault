"use client";
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
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
  due?: string;
};
const FieldErrors = createContext<Record<string, string>>({});
function Field({ children }: { children: ReactNode }) {
  const errors = useContext(FieldErrors);
  const id = useId();
  const parts = Children.toArray(children);
  const control = parts.find(
    (child) =>
      isValidElement(child) &&
      typeof child.type === "string" &&
      ["input", "select", "textarea"].includes(child.type),
  ) as ReactElement<{ name?: string; "aria-describedby"?: string }> | undefined;
  const error = control?.props.name ? errors[control.props.name] : undefined;
  return (
    <div className="form-field">
      <label htmlFor={id}>{parts.filter((child) => child !== control)}</label>
      {control &&
        cloneElement(control, {
          id,
          autoComplete: "off",
          "aria-describedby": error ? `${id}-error` : undefined,
          "aria-invalid": !!error,
        } as object)}
      {error && (
        <span className="field-error" id={`${id}-error`}>
          {error}
        </span>
      )}
    </div>
  );
}
export default function Editor({
  edit,
  data,
  today,
  onClose,
  onSaved,
}: {
  edit: Edit;
  data: Backup;
  today: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
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
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function close() {
    if (!busy && (!dirty || confirm("Discard unsaved changes?"))) onClose();
  }
  function showErrors(fields: Record<string, string>, message: string) {
    setFieldErrors(fields);
    setError(message);
    requestAnimationFrame(() => {
      const name = Object.keys(fields)[0];
      const field = name ? formRef.current?.elements.namedItem(name) : null;
      if (field instanceof HTMLElement) field.focus();
      else
        formRef.current?.querySelector<HTMLElement>(".error-summary")?.focus();
    });
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFieldErrors({});
    if (!event.currentTarget.checkValidity()) {
      const fields: Record<string, string> = {};
      for (const element of Array.from(event.currentTarget.elements)) {
        if (
          (element instanceof HTMLInputElement ||
            element instanceof HTMLSelectElement ||
            element instanceof HTMLTextAreaElement) &&
          !element.validity.valid
        )
          fields[element.name] = element.validationMessage;
      }
      showErrors(fields, "Check the highlighted fields.");
      return;
    }
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
        if (s("frequency") !== "none" && !s("due")) {
          showErrors(
            { due: "Choose a due date for this schedule." },
            "Choose a due date for this schedule.",
          );
          return;
        }
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
      onSaved();
      onClose();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Could not save. Please try again.";
      const fields =
        e instanceof ZodError
          ? Object.fromEntries(
              e.issues.map((issue) => [
                String(
                  issue.path[0] ||
                    (issue.message.startsWith("Deadline")
                      ? "deadline"
                      : issue.message.includes("progress source")
                        ? "sourceId"
                        : ""),
                ),
                issue.message,
              ]),
            )
          : message.includes("due date")
            ? { due: message }
            : {};
      showErrors(
        fields,
        e instanceof ZodError ? "Check the highlighted fields." : message,
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
      onSaved();
      onClose();
    } catch {
      showErrors({}, "Could not delete this item. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  async function archive() {
    if (!r) return;
    setBusy(true);
    try {
      if (edit.kind === "habit")
        await db.habits.update(r.id, { archived: !h?.archived });
      if (edit.kind === "goal")
        await db.goals.update(r.id, { archived: !g?.archived });
      onSaved();
      onClose();
    } catch {
      showErrors({}, "Could not archive this item. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <CenteredDialog
      title={`${r ? "Edit" : "New"} ${edit.kind}`}
      onClose={close}
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
      <FieldErrors.Provider value={fieldErrors}>
        <form
          ref={formRef}
          id={formId}
          noValidate
          onSubmit={submit}
          onChange={() => {
            setDirty(true);
            setError("");
            setFieldErrors({});
          }}
          className="editor-form"
          aria-busy={busy}
        >
          <Field>
            Name
            <input
              name="title"
              autoComplete="off"
              defaultValue={r?.title}
              required
              maxLength={edit.kind === "task" ? 200 : 100}
            />
          </Field>
          {edit.kind === "habit" && (
            <>
              <Field>
                Tracking
                <select
                  name="tracking"
                  value={kind}
                  onChange={(e) =>
                    setKind(e.target.value as "check" | "quantity")
                  }
                >
                  <option value="check">Daily check-off</option>
                  <option value="quantity">Daily quantity target</option>
                  <option value="weekly">Weekly quantity target</option>
                </select>
              </Field>
              {kind !== "check" && (
                <div className="form-row">
                  <Field>
                    {kind === "weekly" ? "Weekly target" : "Daily target"}
                    <input
                      type="number"
                      name="target"
                      min="0.01"
                      step="any"
                      defaultValue={h?.target || 30}
                      required
                    />
                  </Field>
                  <Field>
                    Unit
                    <input
                      name="unit"
                      defaultValue={
                        h?.unit || (kind === "weekly" ? "sessions" : "minutes")
                      }
                      maxLength={30}
                    />
                  </Field>
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
              <details>
                <summary>Appearance</summary>
                <div className="form-row">
                  <Field>
                    Icon
                    <input
                      name="icon"
                      defaultValue={h?.icon || "✦"}
                      maxLength={8}
                    />
                  </Field>
                  <Field>
                    Color
                    <input
                      type="color"
                      name="color"
                      defaultValue={h?.color || "#87a993"}
                    />
                  </Field>
                </div>
              </details>
              {fieldErrors.weekdays && (
                <p className="field-error">Select at least one day.</p>
              )}
              <p className="hint">Schedule/target edits affect history.</p>
            </>
          )}
          {edit.kind === "task" && (
            <>
              <div className="form-row">
                <Field>
                  Due date
                  <input
                    type="date"
                    name="due"
                    defaultValue={t?.due || edit.due || ""}
                  />
                </Field>
                <Field>
                  Priority
                  <select
                    name="priority"
                    defaultValue={t?.priority || "medium"}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </Field>
              </div>
              <Field>
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
              </Field>
              <Field>
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
              </Field>
              {t?.templateId && (
                <p className="hint">Series changes apply after today.</p>
              )}
              <details open={!!t?.notes || !!t?.subtasks.length}>
                <summary>Notes &amp; subtasks</summary>
                <Field>
                  Notes
                  <textarea name="notes" defaultValue={t?.notes} rows={3} />
                </Field>
                <Field>
                  Subtasks <span className="hint">one per line</span>
                  <textarea
                    name="subtasks"
                    defaultValue={t?.subtasks.map((s) => s.title).join("\n")}
                    rows={3}
                  />
                </Field>
              </details>
            </>
          )}
          {edit.kind === "project" && (
            <>
              <details open={!!p?.description}>
                <summary>Description</summary>
                <Field>
                  Description
                  <textarea
                    name="description"
                    defaultValue={p?.description}
                    rows={3}
                  />
                </Field>
              </details>
              <div className="form-row">
                <Field>
                  Deadline
                  <input
                    type="date"
                    name="deadline"
                    defaultValue={p?.deadline || ""}
                  />
                </Field>
                <Field>
                  Color
                  <input
                    type="color"
                    name="color"
                    defaultValue={p?.color || "#e0b276"}
                  />
                </Field>
              </div>
              <Field>
                Status
                <select name="status" defaultValue={p?.status || "active"}>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </Field>
            </>
          )}
          {edit.kind === "goal" && (
            <>
              <Field>
                Progress source
                <select
                  name="source"
                  value={source}
                  onChange={(e) => setSource(e.target.value as Goal["source"])}
                >
                  <option value="manual">Manual number</option>
                  <option value="project">Project completion</option>
                  <option value="habit">Habit total</option>
                </select>
              </Field>
              {source !== "manual" && (
                <Field>
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
                </Field>
              )}
              <div className="form-row">
                {source !== "project" && (
                  <Field>
                    Target
                    <input
                      name="target"
                      type="number"
                      min="0.01"
                      step="any"
                      defaultValue={g?.target || 100}
                      required
                    />
                  </Field>
                )}
                {source === "manual" && (
                  <Field>
                    Current value
                    <input
                      name="value"
                      type="number"
                      min="0"
                      step="any"
                      defaultValue={g?.value || 0}
                      required
                    />
                  </Field>
                )}
              </div>
              <div className="form-row">
                <Field>
                  Start date
                  <input
                    name="startDate"
                    type="date"
                    defaultValue={g?.startDate || today}
                    required
                  />
                </Field>
                <Field>
                  Deadline
                  <input
                    name="deadline"
                    type="date"
                    defaultValue={g?.deadline || ""}
                  />
                </Field>
              </div>
            </>
          )}
          {error && (
            <p role="alert" className="error error-summary" tabIndex={-1}>
              {error}
            </p>
          )}
        </form>
      </FieldErrors.Provider>
    </CenteredDialog>
  );
}
