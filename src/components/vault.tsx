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
} from "lucide-react";
import { db, snapshot, materialize, restore } from "@/lib/db";
import {
  addDays,
  daysBetween,
  weekday,
  scheduled,
  completed,
  streaks,
  defaults,
  todayIn,
  projectProgress,
  goalProgress,
  backupSchema,
  type Backup,
  type Habit,
  type Task,
} from "@/lib/domain";
import Editor, { type Edit } from "./editor";
import {
  Empty,
  Meter,
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
  const [page, setPage] = useState("today");
  const [edit, setEdit] = useState<Edit | null>(null);
  const [error, setError] = useState("");
  const [clock, setClock] = useState(new Date());
  const [selected, setSelected] = useState("");
  const [month, setMonth] = useState("");
  const [filter, setFilter] = useState("Today");
  const [showArchive, setShowArchive] = useState(false);
  const [period, setPeriod] = useState("week");
  const [online, setOnline] = useState(true);
  const [worker, setWorker] = useState<ServiceWorker | null>(null);
  const [install, setInstall] = useState<Event | null>(null);
  const [importData, setImportData] = useState<Backup | null>(null);
  const restoreDialog = useRef<HTMLDialogElement>(null);
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
    const hash = location.hash.slice(1);
    if ([...navigation, ...extra].some((n) => n.id === hash)) setPage(hash);
    const change = () => setPage(location.hash.slice(1) || "today");
    addEventListener("hashchange", change);
    return () => removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    if (importData) restoreDialog.current?.showModal();
  }, [importData]);
  async function run(action: () => Promise<unknown>) {
    setPending((p) => p + 1);
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save. Please retry.",
      );
    } finally {
      setPending((p) => p - 1);
    }
  }
  function navigate(id: string) {
    setPage(id);
    location.hash = id;
    window.scrollTo({ top: 0 });
  }
  if (!data)
    return (
      <div className="loading">
        <h1>Loading…</h1>
      </div>
    );
  const activeHabits = data.habits.filter((h) => !h.archived);
  const habits = data.habits.filter((h) => showArchive || !h.archived);
  const todayHabits = activeHabits.filter((h) => scheduled(h, today));
  const doneHabits = todayHabits.filter((h) =>
    completed(h, data.entries, today),
  ).length;
  const visibleTasks = data.tasks
    .filter((t) =>
      filter === "Completed"
        ? t.done
        : !t.done &&
          (filter === "Inbox"
            ? !t.due
            : filter === "Today"
              ? t.due === today
              : filter === "Upcoming"
                ? !!t.due && t.due > today
                : !!t.due && t.due < today),
    )
    .sort((a, b) => (a.due || "").localeCompare(b.due || ""));
  const overdue = data.tasks.filter((t) => !t.done && t.due && t.due < today);
  const dueTasks = data.tasks.filter((t) => t.due === today);
  const newItem = (kind: Edit["kind"]) => setEdit({ kind });
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
  const todayTasks = [...overdue, ...dueTasks];
  const projects = data.projects.filter(
    (p) => showArchive || p.status !== "archived",
  );
  const goals = data.goals.filter((g) => showArchive || !g.archived);
  const projectRow = (p: Backup["projects"][number], details = false) => (
    <ProjectRow
      key={p.id}
      project={p}
      data={data}
      today={today}
      onEdit={() => setEdit({ kind: "project", record: p })}
    >
      {details && (
        <details className="project-tasks">
          <summary>Tasks</summary>
          {data.tasks
            .filter(
              (t) =>
                t.projectId === p.id &&
                (!t.templateId || (!!t.due && t.due <= today)),
            )
            .map(taskRow)}
        </details>
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
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#today" onClick={() => navigate("today")}>
          Productivity Vault
        </a>
        <nav aria-label="Workspace">
          {[...navigation.filter((n) => n.id !== "more"), ...extra].map((n) => (
            <button
              key={n.id}
              className={page === n.id ? "active" : ""}
              aria-current={page === n.id ? "page" : undefined}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={14} />
              {n.label}
            </button>
          ))}
        </nav>
      </aside>
      <main>
        <div className="content">
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
                className="primary"
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
          {error && (
            <div role="alert" className="alert error">
              {error}
              <button onClick={() => setError("")}>Dismiss</button>
            </div>
          )}
          {worker && (
            <div className="alert">
              <button
                disabled={pending > 0 || !!edit}
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
                    value: `${dueTasks.filter((t) => t.done).length}/${dueTasks.length}`,
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
                    <Empty text="No habits" />
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
                    <Empty text="No tasks" />
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
                    <Empty text="No projects" />
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
                    <Empty text="No goals" />
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
              <div className="panel habit-list">
                {habits.length ? (
                  habits.map((h) => habitRow(h, today, true))
                ) : (
                  <Empty text="No habits" />
                )}
              </div>
            </>
          )}
          {page === "tasks" && (
            <>
              <div className="tabs">
                {["Inbox", "Today", "Upcoming", "Overdue", "Completed"].map(
                  (v) => (
                    <button
                      className={filter === v ? "active" : ""}
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
                  visibleTasks.map(taskRow)
                ) : (
                  <Empty text={`No ${filter.toLowerCase()} tasks`} />
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
                    setSelected(today);
                    setMonth(today.slice(0, 7));
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
                <h2>{day}</h2>
              </div>
              <div className="panel">
                {activeHabits
                  .filter((h) => scheduled(h, day))
                  .map((h) => habitRow(h, day))}
              </div>
              <Section title="Tasks" action={() => newItem("task")}>
                {data.tasks.some((t) => t.due === day) ? (
                  data.tasks.filter((t) => t.due === day).map(taskRow)
                ) : (
                  <Empty text="No tasks" />
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
                  <Empty text="No projects" />
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
                {goals.length ? goals.map(goalRow) : <Empty text="No goals" />}
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
                <button key={n.id} onClick={() => navigate(n.id)}>
                  <n.icon size={14} />
                  {n.label}
                </button>
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
                <p>Device-only data. Clearing browser storage deletes it.</p>
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
                        setError(
                          "Persistent storage not granted. Keep JSON backups.",
                        );
                    })
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
      <nav className="bottom-nav" aria-label="Main navigation">
        {navigation.map((n) => (
          <button
            key={n.id}
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
            onClick={() => navigate(n.id)}
          >
            <n.icon size={14} />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
      {edit && (
        <Editor
          key={`${edit.kind}:${edit.record?.id || "new"}`}
          edit={edit}
          data={data}
          today={today}
          onClose={() => setEdit(null)}
          onError={setError}
        />
      )}
      {importData && (
        <dialog
          aria-label="Restore backup"
          ref={restoreDialog}
          className="editor"
          onCancel={() => setImportData(null)}
        >
          <div className="restore-body">
            <h2>Replace local data?</h2>
            <p>
              {importData.habits.length} habits, {importData.entries.length}{" "}
              check-ins, {importData.tasks.length} tasks,{" "}
              {importData.templates.length} templates,{" "}
              {importData.projects.length} projects, {importData.goals.length}{" "}
              goals.
            </p>
            <p>Current records will be replaced. Export first to keep them.</p>
            <footer>
              <button onClick={() => setImportData(null)}>Cancel</button>
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
            </footer>
          </div>
        </dialog>
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
function Reports({
  data,
  today,
  period,
}: {
  data: Backup;
  today: string;
  period: string;
}) {
  const start =
    period === "month"
      ? today.slice(0, 7) + "-01"
      : addDays(today, -((weekday(today) - data.settings.weekStart + 7) % 7));
  const dates = daysBetween(start, today);
  const habits = data.habits.filter((h) => !h.archived);
  const scheduledCount = habits.reduce(
    (n, h) => n + dates.filter((d) => scheduled(h, d)).length,
    0,
  );
  const count = habits.reduce(
    (n, h) =>
      n +
      dates.filter((d) => scheduled(h, d) && completed(h, data.entries, d))
        .length,
    0,
  );
  return (
    <>
      <Summary
        items={[
          {
            label: "Habits",
            value: `${scheduledCount ? Math.round((count / scheduledCount) * 100) : 0}% (${count}/${scheduledCount})`,
          },
          {
            label: "Completed tasks",
            value: data.tasks.filter(
              (t) =>
                t.done &&
                t.completedAt &&
                todayIn(data.settings.timezone, new Date(t.completedAt)) >=
                  start &&
                todayIn(data.settings.timezone, new Date(t.completedAt)) <=
                  today,
            ).length,
          },
          {
            label: "Overdue",
            value: data.tasks.filter((t) => !t.done && t.due && t.due < today)
              .length,
          },
        ]}
      />
      <section className="panel report-panel">
        <h2>Daily completion</h2>
        <p className="hint">
          {start} to {today}
        </p>
        <div
          className="bar-chart"
          role="img"
          aria-label="Daily habit completion chart; exact values follow below"
        >
          {dates.map((d) => {
            const hs = habits.filter((h) => scheduled(h, d));
            const done = hs.filter((h) => completed(h, data.entries, d)).length;
            return (
              <div key={d} title={`${d}: ${done}/${hs.length}`}>
                <div className="bar-track">
                  <span
                    style={{
                      height: `${hs.length ? (done / hs.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                <small>{Number(d.slice(-2))}</small>
              </div>
            );
          })}
        </div>
        <details>
          <summary>Daily values</summary>
          <ul>
            {dates.map((d) => (
              <li key={d}>
                {d}:{" "}
                {
                  habits.filter(
                    (h) => scheduled(h, d) && completed(h, data.entries, d),
                  ).length
                }{" "}
                / {habits.filter((h) => scheduled(h, d)).length} habits
              </li>
            ))}
          </ul>
        </details>
      </section>
      <section className="panel report-panel">
        <h2>Habit insights</h2>
        {habits.length ? (
          habits.map((h) => {
            const s = streaks(h, data.entries, today);
            const total = data.entries
              .filter(
                (e) => e.habitId === h.id && e.date >= start && e.date <= today,
              )
              .reduce((n, e) => n + e.value, 0);
            return (
              <div className="insight" key={h.id}>
                <strong>
                  {h.icon} {h.title}
                </strong>
                <span>
                  {total} {h.kind === "quantity" ? h.unit : "check-ins"}
                </span>
                <span>
                  Current: {s.current} · Best: {s.best}
                </span>
              </div>
            );
          })
        ) : (
          <p className="hint">No habits</p>
        )}
      </section>
      <div className="record-grid">
        <section className="panel report-panel">
          <h2>Project progress</h2>
          {data.projects
            .filter((p) => p.status !== "archived")
            .map((p) => (
              <div className="report-item" key={p.id}>
                <p>
                  {p.title} ·{" "}
                  {Math.round(projectProgress(p.id, data.tasks, today))}%
                </p>
                <Meter
                  value={projectProgress(p.id, data.tasks, today)}
                  label={p.title}
                />
              </div>
            ))}
        </section>
        <section className="panel report-panel">
          <h2>Goal progress</h2>
          {data.goals
            .filter((g) => !g.archived)
            .map((g) => {
              const v = goalProgress(g, data, today);
              return (
                <div className="report-item" key={g.id}>
                  <p>
                    {g.title} ·{" "}
                    {v.missing
                      ? "Source removed"
                      : `${Math.round(v.value)}/${g.target}`}
                  </p>
                  <Meter
                    value={v.missing ? 0 : (v.value / g.target) * 100}
                    label={g.title}
                  />
                </div>
              );
            })}
        </section>
      </div>
    </>
  );
}
