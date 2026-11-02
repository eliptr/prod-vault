export function dateLabel(date: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year:
      date.slice(0, 4) === String(new Date().getFullYear())
        ? undefined
        : "numeric",
  }).format(new Date(date + "T12:00:00"));
}
export function DateValue({
  date,
  overdue = false,
}: {
  date?: string | null;
  overdue?: boolean;
}) {
  return date ? (
    <time
      dateTime={date}
      aria-label={`${overdue ? "Overdue, " : ""}${new Date(date + "T12:00:00").toLocaleDateString("en", { dateStyle: "full" })}`}
      title={new Date(date + "T12:00:00").toLocaleDateString("en", {
        dateStyle: "full",
      })}
      className={overdue ? "overdue" : "meta"}
    >
      {overdue && "Overdue · "}
      {dateLabel(date)}
    </time>
  ) : null;
}
