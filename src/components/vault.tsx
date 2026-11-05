"use client";
import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Sun,
  Sprout,
  CheckCheck,
  CalendarDays,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Target,
  BarChart3,
  Settings as SettingsIcon,
  WifiOff,
  Plus,
} from "lucide-react";
import { db, snapshot, materialize, restore } from "@/lib/db";
import {
  addDays,
  daysBetween,
  weekday,
  scheduled,
  completed,
  defaults,
  todayIn,
  backupSchema,
  isTodayTask,
  sortTaskList,
  type Backup,
  type Habit,
  type Task,
} from "@/lib/domain";
import Editor, { type Edit } from "./editor";
import CenteredDialog from "./dialog";
import useWorkspaceView from "./use-workspace-view";
import Reports from "./reports";
import {
  Empty,
  Section,
  Summary,
  TaskRow,
  HabitRow,
  ProjectRow,
  GoalRow,
} from "./compact";
const navigation = [
  { id: "today", label: "Today", icon: Sun },
  { id: "habits", label: "Habits", icon: Sprout },
  { id: "tasks", label: "Tasks", icon: CheckCheck },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "more", label: "More", icon: MoreHorizontal },
];
const extra = [
  { id: "projects", label: "Projects", icon: FolderOpen },
  { id: "goals", label: "Goals", icon: Target },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];
const titles: Record<string, string> = Object.fromEntries(
  [...navigation, ...extra].map((n) => [n.id, n.label]),
);
export default function Vault() {
  const data = useLiveQuery(snapshot, []);
  const {
    page,
    selected,
    month,
    filter,
    showArchive,
    period,
    update,
    hrefFor,
  } = useWorkspaceView();
  const setSelected = (selected: string) => update({ selected });
  const setMonth = (month: string) => update({ month });
  const setFilter = (filter: string) => update({ filter });
  const setShowArchive = (showArchive: boolean) => update({ showArchive });
  const setPeriod = (period: string) => update({ period });
  const [edit, setEdit] = useState<Edit | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [quickAdd, setQuickAdd] = useState(false);
  const [lowExpanded, setLowExpanded] = useState(false);
  const quickRef = useRef<HTMLDivElement>(null);
  const [clock, setClock] = useState(new Date());
  const [online, setOnline] = useState(true);
  const [worker, setWorker] = useState<ServiceWorker | null>(null);
  const [install, setInstall] = useState<Event | null>(null);
  const [importData, setImportData] = useState<Backup | null>(null);
  const recoveries = useLiveQuery(() => db.recoveries.toArray(), []);
  const [pending, setPending] = useState(0);
  const settings = data?.settings || defaults;
  const today = todayIn(settings.timezone, clock);
  const day = selected || today;
  const currentMonth = month || today.slice(0, 7);
  const monthStart = currentMonth + "-01";
  const monthEnd = addDays(
    currentMonth === "9999-12"
      ? "9999-12-31"
      : new Date(
          Date.UTC(
            Number(currentMonth.slice(0, 4)),
            Number(currentMonth.slice(5, 7)),
            1,
          ),
        )
          .toISOString()
          .slice(0, 10),
    -1,
  );
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 30000);
    const go = () => setOnline(navigator.onLine);
    go();
    window.addEventListener("online", go);
    window.addEventListener("offline", go);
    const prompt = (e: Event) => {
      e.preventDefault();
      setInstall(e);
    };
    window.addEventListener("beforeinstallprompt", prompt);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .then((r) => {
          if (r.waiting) setWorker(r.waiting);
          r.addEventListener("updatefound", () => {
            const w = r.installing;
            w?.addEventListener("statechange", () => {
              if (w.state === "installed" && navigator.serviceWorker.controller)
                setWorker(w);
            });
          });
        })
        .catch(() =>
          setError("Offline setup failed. Reconnect and reload to retry."),
        );
    }
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", go);
      window.removeEventListener("offline", go);
      window.removeEventListener("beforeinstallprompt", prompt);
    };
  }, []);
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const theme =
        settings.theme === "system"
          ? mq.matches
            ? "dark"
            : "light"
          : settings.theme;
      document.documentElement.dataset.theme = theme;
      const color = theme === "dark" ? "#191e1b" : "#f5f6f4";
      document
        .querySelectorAll('meta[name="theme-color"]')
        .forEach((meta) => meta.setAttribute("content", color));
      document
        .querySelector('meta[name="color-scheme"]')
        ?.setAttribute("content", theme);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [settings.theme]);
  useEffect(() => {
    materialize(
      monthEnd > addDays(today, 90) ? monthEnd : addDays(today, 90),
    ).catch(() =>
      setError(
        "Could not prepare recurring tasks. Your records remain on this device.",
      ),
    );
  }, [
    today,
    monthEnd,
    data?.templates.map((t) => t.updatedAt + t.id).join(","),
  ]);
  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(""), 2400);
    return () => clearTimeout(timer);
  }, [status]);
  useEffect(() => {
    if (!quickAdd) return;
    quickRef.current
      ?.querySelector<HTMLButtonElement>(".quick-menu button")
      ?.focus();
    const outside = (event: PointerEvent) => {
      if (!quickRef.current?.contains(event.target as Node)) setQuickAdd(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [quickAdd]);
  async function run(action: () => Promise<unknown>, success = "") {
    setPending((p) => p + 1);
    try {
      await action();
      setStatus(success);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save. Please retry.",
      );
    } finally {
      setPending((p) => p - 1);
    }
  }
  function navigate(id: string) {
    update({ page: id }, true);
    setQuickAdd(false);
    window.scrollTo({ top: 0 });
  }
  if (!data)
    return (
      <div
        className="loading"
        role="status"
        aria-label="Loading vault"
        aria-busy="true"
      >
        <h1>Productivity Vault</h1>
        <div className="loading-grid" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              {[0, 1, 2].map((n) => (
                <div className="skeleton-row" key={n} />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  const activeHabits = data.habits.filter((h) => !h.archived);
  const habits = data.habits.filter((h) => showArchive || !h.archived);
  const todayHabits = activeHabits.filter((h) => scheduled(h, today));
  const doneHabits = todayHabits.filter((h) =>
    completed(h, data.entries, today, settings.weekStart),
  ).length;
  const visibleTasks = sortTaskList(
    data.tasks.filter((t) =>
      filter === "Completed"
        ? t.done
        : !t.done &&
          (filter === "Inbox"
            ? !t.due
            : filter === "Today"
              ? t.showDaily || t.due === today
              : filter === "Upcoming"
                ? !!t.due && t.due > today
                : !!t.due && t.due < today),
    ),
    data.projects,
  );
  const lowTasks =
    filter === "Inbox" ? visibleTasks.filter((t) => t.priority === "low") : [];
  const mainTasks =
    filter === "Inbox"
      ? visibleTasks.filter((t) => t.priority !== "low")
      : visibleTasks;
  const overdue = data.tasks.filter((t) => !t.done && t.due && t.due < today);
  const newItem = (kind: Edit["kind"], projectId?: string) => {
    setQuickAdd(false);
    setEdit({ kind, projectId, due: page === "calendar" ? day : undefined });
  };
  async function entry(h: Habit, date: string, value: number) {
    await run(() =>
      db.entries.put({
        id: `${h.id}:${date}`,
        habitId: h.id,
        date,
        value,
        updatedAt: new Date().toISOString(),
      }),
    );
  }
  async function adjustEntry(h: Habit, date: string, delta: number) {
    await run(() =>
      db.transaction("rw", db.entries, async () => {
        const id = `${h.id}:${date}`;
        const current = await db.entries.get(id);
        await db.entries.put({
          id,
          habitId: h.id,
          date,
          value: Math.max(0, (current?.value || 0) + delta),
          updatedAt: new Date().toISOString(),
        });
      }),
    );
  }
  async function setGoal(id: string, value: number) {
    if (Number.isFinite(value) && value >= 0)
      await run(() =>
        db.goals.update(id, { value, updatedAt: new Date().toISOString() }),
      );
  }
  async function adjustGoal(id: string, delta: number) {
    await run(() =>
      db.transaction("rw", db.goals, async () => {
        const goal = await db.goals.get(id);
        if (goal?.source === "manual")
          await db.goals.update(id, {
            value: Math.max(0, goal.value + delta),
            updatedAt: new Date().toISOString(),
          });
      }),
    );
  }
  async function toggleTask(t: Task) {
    await run(() =>
      db.tasks.update(t.id, {
        done: !t.done,
        completedAt: t.done ? null : new Date().toISOString(),
        subtasks: t.done
          ? t.subtasks
          : t.subtasks.map((s) => ({ ...s, done: true })),
        updatedAt: new Date().toISOString(),
      }),
    );
  }
  function taskRow(t: Task) {
    return (
      <TaskRow
        key={t.id}
        task={t}
        showPriority={page !== "today"}
        inlineDetails={page === "today"}
        showOverdueLabel={page !== "today"}
        project={data!.projects.find((p) => p.id === t.projectId)?.title}
        today={today}
        onEdit={() => setEdit({ kind: "task", record: t })}
        onToggle={() => toggleTask(t)}
        onSubtask={(id) =>
          run(() =>
            db.tasks.update(t.id, {
              subtasks: t.subtasks.map((s) =>
                s.id === id ? { ...s, done: !s.done } : s,
              ),
            }),
          )
        }
      />
    );
  }
  function habitRow(h: Habit, at = today, grid = false) {
    return (
      <HabitRow
        key={h.id}
        habit={h}
        data={data!}
        today={today}
        at={at}
        month={grid ? { start: monthStart, end: monthEnd } : undefined}
        onEdit={() => setEdit({ kind: "habit", record: h })}
        onEntry={(date, value) => entry(h, date, value)}
        onAdjust={(date, delta) => adjustEntry(h, date, delta)}
        onDate={(date) => {
          setSelected(date);
          navigate("calendar");
        }}
      />
    );
  }
  async function exportBackup() {
    await run(async () => {
      const exported = new Date().toISOString();
      const b = await snapshot();
      b.settings.lastExport = exported;
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(b, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `productivity-vault-${today}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      await db.settings.put({ ...settings, lastExport: exported });
    });
  }
  async function readBackup(file?: File) {
    if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024)
        throw new Error("Backup exceeds 20 MB.");
      setImportData(backupSchema.parse(JSON.parse(await file.text())));
      setError("");
    } catch {
      setError(
        "Invalid backup. Choose a valid Productivity Vault JSON export. Your current data has not changed.",
      );
    }
  }
  async function sample() {
    await run(async () => {
      if (
        data!.habits.length ||
        data!.tasks.length ||
        data!.projects.length ||
        data!.goals.length
      )
        throw new Error("Sample data is available only in an empty vault.");
      const stamp = new Date().toISOString();
      const base = { createdAt: stamp, updatedAt: stamp };
      await db.transaction("rw", db.tables, async () => {
        await db.habits.bulkAdd([
          {
            ...base,
            id: "sample-read",
            title: "Read a little",
            icon: "📖",
            color: "#8aa3bb",
            kind: "quantity",
            period: "daily",
            target: 10,
            unit: "pages",
            weekdays: [0, 1, 2, 3, 4, 5, 6],
            startDate: addDays(today, -14),
            archived: false,
          },
          {
            ...base,
            id: "sample-move",
            title: "Move your body",
            icon: "🌿",
            color: "#8baa93",
            kind: "check",
            period: "daily",
            target: 1,
            unit: "",
            weekdays: [1, 2, 3, 4, 5],
            startDate: addDays(today, -14),
            archived: false,
          },
          {
            ...base,
            id: "sample-focus",
            title: "A moment of focus",
            icon: "☕",
            color: "#d5ad78",
            kind: "quantity",
            period: "daily",
            target: 30,
            unit: "minutes",
            weekdays: [0, 1, 2, 3, 4, 5, 6],
            startDate: addDays(today, -14),
            archived: false,
          },
        ]);
        await db.projects.add({
          ...base,
          id: "sample-project",
          title: "A calmer home",
          description:
            "Little improvements to make everyday life feel lighter.",
          color: "#d5ad78",
          deadline: addDays(today, 14),
          status: "active",
        });
        await db.tasks.bulkAdd(
          [
            "Clear a small corner",
            "Plan something to look forward to",
            "Write down your top three priorities",
          ].map((title, i) => ({
            ...base,
            id: `sample-task-${i}`,
            title,
            notes: "",
            due: today,
            priority: i === 0 ? ("high" as const) : ("medium" as const),
            projectId: i === 0 ? "sample-project" : null,
            done: false,
            completedAt: null,
            subtasks: [],
            templateId: null,
            showDaily: false,
          })),
        );
        await db.goals.add({
          ...base,
          id: "sample-goal",
          title: "Read 100 pages",
          source: "habit",
          sourceId: "sample-read",
          target: 100,
          value: 0,
          startDate: addDays(today, -14),
          deadline: addDays(today, 14),
          archived: false,
        });
        for (let i = 1; i <= 12; i++)
          if (i % 4 !== 0)
            await db.entries.add({
              id: `sample-read:${addDays(today, -i)}`,
              habitId: "sample-read",
              date: addDays(today, -i),
              value: 10,
              updatedAt: stamp,
            });
      });
    });
  }
  const reminder =
    Date.now() -
      Date.parse(
        settings.lastExport ||
          data.habits[0]?.createdAt ||
          data.tasks[0]?.createdAt ||
          data.projects[0]?.createdAt ||
          data.goals[0]?.createdAt ||
          new Date().toISOString(),
      ) >
      7 * 86400000 &&
    (!settings.reminderDismissed ||
      Date.now() - Date.parse(settings.reminderDismissed) > 7 * 86400000);
  const activeProjects = data.projects.filter((p) => p.status === "active");
  const activeGoals = data.goals.filter((g) => !g.archived);
  const todayTasks = data.tasks
    .filter((t) => isTodayTask(t, today) || (!t.showDaily && t.due === today))
    .sort((a, b) => {
      const rank = (t: Task) =>
        t.due && t.due < today ? 0 : t.due === today ? 1 : 2;
      return (
        rank(a) - rank(b) || (a.due || "9999").localeCompare(b.due || "9999")
      );
    });
  const projects = data.projects.filter(
    (p) => showArchive || p.status !== "archived",
  );
  const goals = data.goals.filter((g) => showArchive || !g.archived);
  const projectRow = (p: Backup["projects"][number], details = true) => (
    <ProjectRow
      key={p.id}
      project={p}
      data={data}
      today={today}
      onEdit={() => setEdit({ kind: "project", record: p })}
    >
      {details && (
        <div className="project-tasks">
          <button
            onClick={() => newItem("task", p.id)}
            aria-label={`Add task to ${p.title}`}
          >
            + Add task
          </button>
          {data.tasks
            .filter((t) => t.projectId === p.id && !t.done)
            .map(taskRow)}
          {data.tasks.some((t) => t.projectId === p.id && t.done) && (
            <details>
              <summary>Completed</summary>
              {data.tasks
                .filter((t) => t.projectId === p.id && t.done)
                .map(taskRow)}
            </details>
          )}
        </div>
      )}
    </ProjectRow>
  );
  const goalRow = (g: Backup["goals"][number]) => (
    <GoalRow
      key={g.id}
      goal={g}
      data={data}
      today={today}
      onEdit={() => setEdit({ kind: "goal", record: g })}
      onSet={(value) => setGoal(g.id, value)}
      onStep={(delta) => adjustGoal(g.id, delta)}
      sourceControl={
        g.source === "habit"
          ? (() => {
              const h = data.habits.find((h) => h.id === g.sourceId);
              return h
                ? { label: "Log habit", content: habitRow(h) }
                : undefined;
            })()
          : g.source === "project"
            ? (() => {
                const p = data.projects.find((p) => p.id === g.sourceId);
                return p
                  ? { label: "Project tasks", content: projectRow(p) }
                  : undefined;
              })()
            : undefined
      }
    />
  );
  const addKind =
    page === "habits"
      ? "habit"
      : page === "projects"
        ? "project"
        : page === "goals"
          ? "goal"
          : "task";
  return (
    <div
      className="app-shell"
      onClickCapture={(event) => {
        const button = (event.target as Element).closest("button");
        if (button && !event.currentTarget.querySelector("dialog[open]"))
          button.focus({ preventScroll: true });
      }}
    >
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className="sidebar">
        <a
          className="brand"
          href={hrefFor("today")}
          onClick={(event) => {
            if (
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey
            )
              return;
            event.preventDefault();
            navigate("today");
          }}
        >
          Productivity Vault
        </a>
        <nav aria-label="Workspace">
          {[...navigation.filter((n) => n.id !== "more"), ...extra].map((n) => (
            <a
              key={n.id}
              href={hrefFor(n.id)}
              className={page === n.id ? "active" : ""}
              aria-current={page === n.id ? "page" : undefined}
              onClick={(event) => {
                if (
                  !event.metaKey &&
                  !event.ctrlKey &&
                  !event.shiftKey &&
                  !event.altKey
                ) {
                  event.preventDefault();
                  navigate(n.id);
                }
              }}
            >
              <n.icon size={16} aria-hidden="true" />
              {n.label}
            </a>
          ))}
        </nav>
      </aside>
      <main id="main-content" tabIndex={-1}>
        <div
          className={
            "content" +
            (page === "today"
              ? " today-content"
              : page === "habits"
                ? " habits-content"
                : "")
          }
        >
          <header className="section-heading">
            <h1>{titles[page] || "Today"}</h1>
            {page === "today" && (
              <time dateTime={today}>
                {new Date(today + "T12:00:00").toLocaleDateString("en", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </time>
            )}
            {["habits", "tasks", "projects", "goals"].includes(page) && (
              <button
                className={
                  "primary" +
                  (["habits", "tasks"].includes(page) ? " phone-hidden" : "")
                }
                aria-label={`Add ${addKind}`}
                onClick={() => newItem(addKind)}
              >
                + Add {addKind}
              </button>
            )}
          </header>
          {!online && (
            <div className="alert" role="status">
              <WifiOff size={12} />
              Offline · saved locally
            </div>
          )}
          {error && !importData && (
            <div role="alert" className="alert error">
              {error}
              <button onClick={() => setError("")}>Dismiss</button>
            </div>
          )}
          {worker && (
            <div className="alert">
              <button
                disabled={pending > 0 || !!edit || !!importData}
                onClick={() => {
                  navigator.serviceWorker.addEventListener(
                    "controllerchange",
                    () => location.reload(),
                    { once: true },
                  );
                  worker.postMessage({ type: "SKIP_WAITING" });
                }}
              >
                Update available
              </button>
            </div>
          )}
          {reminder && (
            <div className="alert">
              <span>Backup due</span>
              <button onClick={exportBackup}>Export backup</button>
              <button
                aria-label="Dismiss backup reminder"
                onClick={() =>
                  run(() =>
                    db.settings.put({
                      ...settings,
                      reminderDismissed: new Date().toISOString(),
                    }),
                  )
                }
              >
                Later
              </button>
            </div>
          )}
          {page === "today" && (
            <>
              <Summary
                items={[
                  {
                    label: "Habits",
                    value: `${doneHabits}/${todayHabits.length}`,
                  },
                  {
                    label: "Tasks",
                    value: `${todayTasks.filter((t) => t.done).length}/${todayTasks.length}`,
                  },
                  { label: "Overdue", value: overdue.length },
                  { label: "Projects", value: activeProjects.length },
                ]}
              />
              <div className="overview">
                <Section
                  title="Habits"
                  count={todayHabits.length}
                  action={() => newItem("habit")}
                >
                  {todayHabits.length ? (
                    todayHabits.map((h) => habitRow(h))
                  ) : (
                    <Empty
                      text="No habits"
                      action={() => newItem("habit")}
                      label="Create habit"
                    />
                  )}
                </Section>
                <Section
                  title="Goals"
                  count={activeGoals.length}
                  action={() => newItem("goal")}
                >
                  {activeGoals.length ? (
                    activeGoals.map(goalRow)
                  ) : (
                    <Empty
                      text="No goals"
                      action={() => newItem("goal")}
                      label="Create goal"
                    />
                  )}
                </Section>
                <Section
                  title="Tasks"
                  count={todayTasks.length}
                  action={() => newItem("task")}
                >
                  {todayTasks.length ? (
                    todayTasks.map(taskRow)
                  ) : (
                    <Empty
                      text="No tasks"
                      action={() => newItem("task")}
                      label="Create task"
                    />
                  )}
                </Section>
                <Section
                  title="Projects"
                  count={activeProjects.length}
                  action={() => newItem("project")}
                >
                  {activeProjects.length ? (
                    activeProjects.map((p) => projectRow(p))
                  ) : (
                    <Empty
                      text="No projects"
                      action={() => newItem("project")}
                      label="Create project"
                    />
                  )}
                </Section>
              </div>
            </>
          )}
          {page === "habits" && (
            <>
              <div className="toolbar">
                <MonthPicker month={currentMonth} onChange={setMonth} />
                <button onClick={() => setShowArchive(!showArchive)}>
                  {showArchive ? "Hide archived" : "Show archived"}
                </button>
              </div>
              <div className="habit-list">
                {habits.length ? (
                  habits.map((h) => habitRow(h, today, true))
                ) : (
                  <Empty
                    text="No habits"
                    action={() => newItem("habit")}
                    label="Create habit"
                  />
                )}
              </div>
            </>
          )}
          {page === "tasks" && (
            <>
              <div className="tabs" aria-label="Task filters">
                {["Inbox", "Today", "Upcoming", "Overdue", "Completed"].map(
                  (v) => (
                    <button
                      className={filter === v ? "active" : ""}
                      aria-pressed={filter === v}
                      key={v}
                      onClick={() => setFilter(v)}
                    >
                      {v}
                      {v === "Overdue" && overdue.length > 0 ? (
                        <span>{overdue.length}</span>
                      ) : null}
                    </button>
                  ),
                )}
              </div>
              <div className="panel">
                {visibleTasks.length ? (
                  <>
                    {mainTasks.map(taskRow)}
                    {lowTasks.length > 0 && (
                      <div className="low-priority-section">
                        <button
                          className="low-priority-toggle"
                          aria-expanded={lowExpanded}
                          aria-controls="inbox-low-tasks"
                          onClick={() => setLowExpanded(!lowExpanded)}
                        >
                          <ChevronRight
                            size={12}
                            className={lowExpanded ? "low-expanded" : ""}
                            aria-hidden="true"
                          />
                          Low priority · {lowTasks.length}
                        </button>
                        <div id="inbox-low-tasks" hidden={!lowExpanded}>
                          {lowTasks.map(taskRow)}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <Empty
                    text={`No ${filter.toLowerCase()} tasks`}
                    action={() => newItem("task")}
                    label="Create task"
                  />
                )}
              </div>
            </>
          )}
          {page === "calendar" && (
            <>
              <div className="toolbar">
                <MonthPicker month={currentMonth} onChange={setMonth} />
                <button
                  onClick={() => {
                    update({ selected: today, month: today.slice(0, 7) });
                  }}
                >
                  Today
                </button>
              </div>
              <section className="panel calendar">
                <div className="calendar-grid">
                  {Array.from(
                    { length: 7 },
                    (_, i) =>
                      ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
                        (i + settings.weekStart) % 7
                      ],
                  ).map((d) => (
                    <span className="day-name" key={d}>
                      {d}
                    </span>
                  ))}
                  {Array.from(
                    {
                      length:
                        (weekday(monthStart) - settings.weekStart + 7) % 7,
                    },
                    (_, i) => (
                      <span key={"pad" + i} />
                    ),
                  )}
                  {daysBetween(monthStart, monthEnd).map((d) => (
                    <button
                      key={d}
                      className={`${day === d ? "selected" : ""} ${d === today ? "is-today" : ""}`}
                      aria-label={d}
                      aria-pressed={day === d}
                      onClick={() => setSelected(d)}
                    >
                      <span>{Number(d.slice(-2))}</span>
                      <span className="date-dots">
                        {data.tasks.some((t) => t.due === d) && <i />}
                        {activeHabits.some((h) => scheduled(h, d)) && <i />}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
              <div className="section-title">
                <h2>
                  <time dateTime={day}>
                    {new Date(day + "T12:00:00").toLocaleDateString("en", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </time>
                </h2>
              </div>
              <Section title="Tasks" action={() => newItem("task")}>
                {data.tasks.some((t) => t.due === day) ? (
                  data.tasks.filter((t) => t.due === day).map(taskRow)
                ) : (
                  <Empty text="No tasks" />
                )}
              </Section>
              <Section
                title="Habits"
                count={activeHabits.filter((h) => scheduled(h, day)).length}
              >
                {activeHabits.some((h) => scheduled(h, day)) ? (
                  activeHabits
                    .filter((h) => scheduled(h, day))
                    .map((h) => habitRow(h, day))
                ) : (
                  <Empty text="No habits" />
                )}
              </Section>
            </>
          )}
          {page === "projects" && (
            <>
              <div className="toolbar">
                <span className="meta">{projects.length} projects</span>
                <button onClick={() => setShowArchive(!showArchive)}>
                  {showArchive ? "Hide archived" : "Show archived"}
                </button>
              </div>
              <div className="panel">
                {projects.length ? (
                  projects.map((p) => projectRow(p, true))
                ) : (
                  <Empty
                    text="No projects"
                    action={() => newItem("project")}
                    label="Create project"
                  />
                )}
              </div>
            </>
          )}
          {page === "goals" && (
            <>
              <div className="toolbar">
                <span className="meta">{goals.length} goals</span>
                <button onClick={() => setShowArchive(!showArchive)}>
                  {showArchive ? "Hide archived" : "Show archived"}
                </button>
              </div>
              <div className="panel">
                {goals.length ? (
                  goals.map(goalRow)
                ) : (
                  <Empty
                    text="No goals"
                    action={() => newItem("goal")}
                    label="Create goal"
                  />
                )}
              </div>
            </>
          )}
          {page === "reports" && (
            <>
              <div className="tabs">
                {["week", "month"].map((v) => (
                  <button
                    key={v}
                    className={period === v ? "active" : ""}
                    aria-pressed={period === v}
                    onClick={() => setPeriod(v)}
                  >
                    This {v}
                  </button>
                ))}
              </div>
              <Reports data={data} today={today} period={period} />
            </>
          )}
          {page === "more" && (
            <nav className="more-links" aria-label="More">
              {extra.map((n) => (
                <a
                  key={n.id}
                  href={hrefFor(n.id)}
                  onClick={(event) => {
                    if (
                      !event.metaKey &&
                      !event.ctrlKey &&
                      !event.shiftKey &&
                      !event.altKey
                    ) {
                      event.preventDefault();
                      navigate(n.id);
                    }
                  }}
                >
                  <n.icon size={18} aria-hidden="true" />
                  {n.label}
                  <ChevronRight
                    size={16}
                    className="chevron"
                    aria-hidden="true"
                  />
                </a>
              ))}
            </nav>
          )}
          {page === "settings" && (
            <div className="settings-grid">
              <section className="panel settings-panel">
                <h2>Preferences</h2>
                <label>
                  Appearance
                  <select
                    value={settings.theme}
                    onChange={(e) =>
                      run(() =>
                        db.settings.put({
                          ...settings,
                          theme: e.target.value as typeof settings.theme,
                        }),
                      )
                    }
                  >
                    <option value="system">System</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </label>
                <label>
                  Timezone
                  <select
                    value={settings.timezone}
                    onChange={(e) =>
                      run(() =>
                        db.settings.put({
                          ...settings,
                          timezone: e.target.value,
                        }),
                      )
                    }
                  >
                    {Array.from(
                      new Set([
                        settings.timezone,
                        ...Intl.supportedValuesOf("timeZone"),
                      ]),
                    ).map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Week starts on
                  <select
                    value={settings.weekStart}
                    onChange={(e) =>
                      run(() =>
                        db.settings.put({
                          ...settings,
                          weekStart: Number(e.target.value) as 0 | 1,
                        }),
                      )
                    }
                  >
                    <option value={1}>Monday</option>
                    <option value={0}>Sunday</option>
                  </select>
                </label>
              </section>
              <section className="panel settings-panel">
                <h2>Backups</h2>
                {recoveries?.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      const url = URL.createObjectURL(
                        new Blob([JSON.stringify(r.data, null, 2)], {
                          type: "application/json",
                        }),
                      );
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `prod-vault-recovery-${r.createdAt.slice(0, 10)}.json`;
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }}
                  >
                    Download pre-update backup · {r.createdAt.slice(0, 10)}
                  </button>
                ))}
                <p>
                  Records stay in this browser. Each device is separate.
                  Clearing browser storage deletes them.
                </p>
                <div className="button-row">
                  <button onClick={exportBackup}>Export backup</button>
                  <label className="file-label">
                    Restore from backup
                    <input
                      aria-label="Restore from backup"
                      type="file"
                      accept=".json,application/json"
                      onChange={(e) => {
                        readBackup(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                <p className="meta">
                  Last export:{" "}
                  {settings.lastExport
                    ? new Date(settings.lastExport).toLocaleString("en")
                    : "Never"}
                </p>
              </section>
              <section className="panel settings-panel">
                <h2>App</h2>
                {install ? (
                  <button
                    onClick={async () => {
                      await (
                        install as Event & { prompt: () => Promise<void> }
                      ).prompt();
                      setInstall(null);
                    }}
                  >
                    Install Productivity Vault
                  </button>
                ) : (
                  <details>
                    <summary>Install</summary>
                    <p>
                      iPhone: Share → Add to Home Screen. Android/desktop:
                      browser Install menu.
                    </p>
                  </details>
                )}
                <button
                  onClick={() =>
                    run(async () => {
                      if (!(await navigator.storage?.persist?.()))
                        throw new Error(
                          "Persistent storage not granted. Keep JSON backups.",
                        );
                    }, "Persistent storage granted")
                  }
                >
                  Request persistent storage
                </button>
                {!data.habits.length &&
                  !data.tasks.length &&
                  !data.projects.length &&
                  !data.goals.length && (
                    <button onClick={sample}>Load sample data</button>
                  )}
              </section>
            </div>
          )}
        </div>
      </main>
      <div className="save-status" role="status" aria-live="polite">
        {status}
      </div>
      {["today", "habits", "tasks", "calendar", "projects", "goals"].includes(
        page,
      ) &&
        !edit &&
        !importData && (
          <div
            className="quick-add"
            ref={quickRef}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setQuickAdd(false);
                event.currentTarget
                  .querySelector<HTMLButtonElement>(".quick-trigger")
                  ?.focus();
              }
            }}
          >
            {quickAdd && (
              <div
                className="quick-menu"
                id="quick-add-menu"
                role="group"
                aria-label="Create record"
              >
                {(["habit", "task", "project", "goal"] as const).map((kind) => (
                  <button key={kind} onClick={() => newItem(kind)}>
                    <Plus size={16} aria-hidden="true" />
                    New {kind}
                  </button>
                ))}
              </div>
            )}
            <button
              className="quick-trigger"
              aria-label={
                page === "today"
                  ? "Quick add"
                  : ["habits", "tasks"].includes(page)
                    ? `Add ${addKind}`
                    : `Quick add ${addKind}`
              }
              aria-expanded={page === "today" ? quickAdd : undefined}
              aria-controls={
                page === "today" && quickAdd ? "quick-add-menu" : undefined
              }
              onClick={() =>
                page === "today" ? setQuickAdd(!quickAdd) : newItem(addKind)
              }
            >
              <Plus size={20} aria-hidden="true" />
            </button>
          </div>
        )}
      <nav className="bottom-nav" aria-label="Main navigation">
        {navigation.map((n) => (
          <a
            key={n.id}
            href={hrefFor(n.id)}
            aria-current={
              page === n.id ||
              (n.id === "more" && extra.some((e) => e.id === page))
                ? "page"
                : undefined
            }
            className={
              page === n.id ||
              (n.id === "more" && extra.some((e) => e.id === page))
                ? "active"
                : ""
            }
            onClick={(event) => {
              if (
                !event.metaKey &&
                !event.ctrlKey &&
                !event.shiftKey &&
                !event.altKey
              ) {
                event.preventDefault();
                navigate(n.id);
              }
            }}
          >
            <n.icon size={18} aria-hidden="true" />
            <span>{n.label}</span>
          </a>
        ))}
      </nav>
      {edit && (
        <Editor
          key={`${edit.kind}:${edit.record?.id || "new"}`}
          edit={edit}
          data={data}
          today={today}
          onClose={() => setEdit(null)}
          onSaved={() => setStatus("")}
        />
      )}
      {importData && (
        <CenteredDialog
          title="Replace local data?"
          onClose={() => {
            if (!pending) setImportData(null);
          }}
          footer={
            <>
              <button
                disabled={pending > 0}
                onClick={() => setImportData(null)}
              >
                Cancel
              </button>
              <button
                className="primary"
                disabled={pending > 0}
                onClick={() =>
                  run(async () => {
                    await restore(importData);
                    setImportData(null);
                  })
                }
              >
                Replace local data
              </button>
            </>
          }
        >
          <div className="restore-body">
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <p>
              {importData.habits.length} habits, {importData.entries.length}{" "}
              check-ins, {importData.tasks.length} tasks,{" "}
              {importData.templates.length} templates,{" "}
              {importData.projects.length} projects, {importData.goals.length}{" "}
              goals.
            </p>
            <p>Current records will be replaced. Export first to keep them.</p>
          </div>
        </CenteredDialog>
      )}
    </div>
  );
}

function MonthPicker({
  month,
  onChange,
}: {
  month: string;
  onChange: (s: string) => void;
}) {
  function shift(n: number) {
    const d = new Date(month + "-15T12:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + n);
    onChange(d.toISOString().slice(0, 7));
  }
  return (
    <div className="month-picker">
      <button aria-label="Previous month" onClick={() => shift(-1)}>
        <ChevronLeft size={18} />
      </button>
      <span>
        {new Date(month + "-15T12:00:00").toLocaleDateString("en", {
          month: "long",
          year: "numeric",
        })}
      </span>
      <button aria-label="Next month" onClick={() => shift(1)}>
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
