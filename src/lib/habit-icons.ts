import type { Habit } from "./domain";

export const habitIcons = [
  { icon: "✦", label: "Star" },
  { icon: "🌿", label: "Leaf" },
  { icon: "🏃", label: "Run" },
  { icon: "🏋️", label: "Weights" },
  { icon: "💧", label: "Water" },
  { icon: "☕", label: "Coffee" },
  { icon: "📖", label: "Book" },
  { icon: "✍️", label: "Write" },
  { icon: "🏠", label: "Home" },
  { icon: "🌙", label: "Moon" },
] as const;

const presetOrder = new Map<string, number>(
  habitIcons.map(({ icon }, index) => [icon, index]),
);
const customIconRank = habitIcons.length;
const titleOrder = new Intl.Collator("en", { sensitivity: "base" });

function iconRank(icon: string) {
  return icon ? (presetOrder.get(icon) ?? customIconRank) : customIconRank + 1;
}

export function compareHabitIcons(a: Habit, b: Habit) {
  const left = a.icon.trim(),
    right = b.icon.trim();
  return (
    iconRank(left) - iconRank(right) ||
    (left < right ? -1 : left > right ? 1 : 0) ||
    titleOrder.compare(a.title, b.title) ||
    a.id.localeCompare(b.id)
  );
}
