"use client";
import { useEffect, useState } from "react";

const pages = new Set([
  "today",
  "habits",
  "tasks",
  "calendar",
  "more",
  "projects",
  "goals",
  "reports",
  "settings",
]);
const filters = new Set(["Inbox", "Today", "Upcoming", "Overdue", "Completed"]);
const initial = {
  page: "today",
  filter: "Today",
  selected: "",
  month: "",
  showArchive: false,
  period: "week",
};
type View = typeof initial;
function read(): View {
  const [page, query] = location.hash.slice(1).split("?");
  const p = new URLSearchParams(query);
  const date = p.get("date") || "";
  const month = p.get("month") || "";
  return {
    page: pages.has(page) ? page : "today",
    filter: filters.has(p.get("filter") || "") ? p.get("filter")! : "Today",
    selected:
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      !Number.isNaN(Date.parse(date)) &&
      new Date(date).toISOString().slice(0, 10) === date &&
      date >= "0001-01-01"
        ? date
        : "",
    month:
      /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && month >= "0001-01" ? month : "",
    showArchive: p.get("archived") === "1",
    period: p.get("period") === "month" ? "month" : "week",
  };
}
function href(view: View) {
  const p = new URLSearchParams();
  if (view.filter !== "Today") p.set("filter", view.filter);
  if (view.selected) p.set("date", view.selected);
  if (view.month) p.set("month", view.month);
  if (view.showArchive) p.set("archived", "1");
  if (view.period !== "week") p.set("period", view.period);
  return `#${view.page}${p.size ? "?" + p.toString() : ""}`;
}
export default function useWorkspaceView() {
  const [view, setView] = useState(initial);
  useEffect(() => {
    const sync = () => setView(read());
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);
  function update(patch: Partial<View>, push = false) {
    const next = { ...read(), ...patch };
    setView(next);
    history[push ? "pushState" : "replaceState"](null, "", href(next));
  }
  return {
    ...view,
    update,
    hrefFor: (page: string) => href({ ...view, page }),
  };
}
