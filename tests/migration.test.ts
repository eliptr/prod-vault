import "fake-indexeddb/auto";
import Dexie from "dexie";
import { test } from "node:test";
import assert from "node:assert/strict";
import { db, materialize, restore, snapshot } from "../src/lib/db";
import { defaults } from "../src/lib/domain";
const stamp = "2026-10-01T12:00:00.000Z";
const raw = {
  version: 1,
  exportedAt: stamp,
  habits: [
    {
      id: "h",
      createdAt: stamp,
      updatedAt: stamp,
      title: "Gym",
      icon: "x",
      color: "#123456",
      kind: "quantity",
      target: 3,
      unit: "sessions",
      weekdays: [1],
      startDate: "2026-10-01",
      archived: false,
    },
  ],
  entries: [],
  tasks: [
    {
      id: "r:2026-10-01",
      createdAt: stamp,
      updatedAt: stamp,
      title: "Old task",
      notes: "completed",
      due: "2026-10-01",
      priority: "low",
      projectId: null,
      done: true,
      completedAt: stamp,
      subtasks: [],
      templateId: "r",
    },
    {
      id: "r:2026-10-02",
      createdAt: stamp,
      updatedAt: stamp,
      title: "Old task",
      notes: "earliest note",
      due: "2026-10-02",
      priority: "high",
      projectId: null,
      done: false,
      completedAt: null,
      subtasks: [{ id: "s", title: "Keep this", done: true }],
      templateId: "r",
    },
    {
      id: "r:2026-10-03",
      createdAt: stamp,
      updatedAt: stamp,
      title: "Changed copy",
      notes: "another note",
      due: "2026-10-03",
      priority: "low",
      projectId: null,
      done: false,
      completedAt: null,
      subtasks: [],
      templateId: "r",
    },
  ],
  templates: [
    {
      id: "r",
      createdAt: stamp,
      updatedAt: stamp,
      title: "Old task",
      notes: "",
      priority: "low",
      projectId: null,
      frequency: "daily",
      startDate: "2026-10-01",
      endDate: null,
      subtasks: [],
    },
  ],
  projects: [],
  goals: [],
  settings: defaults,
};
test("transactional v2 database upgrade, recovery snapshot, and v1/v2 restore", async () => {
  await db.delete();
  const legacy = new Dexie("productivity-vault");
  legacy.version(2).stores({
    habits: "id, archived",
    entries: "id, &[habitId+date], date",
    tasks: "id, due, projectId, templateId",
    templates: "id, projectId",
    projects: "id",
    goals: "id",
    settings: "id",
  });
  await legacy.open();
  for (const name of [
    "habits",
    "entries",
    "tasks",
    "templates",
    "projects",
    "goals",
  ] as const)
    await legacy.table(name).bulkPut(raw[name]);
  await legacy.table("settings").put(defaults);
  legacy.close();
  await db.open();
  let b = await snapshot();
  assert.equal(b.version, 2);
  assert.equal(b.tasks.length, 2);
  assert.equal(b.habits[0].period, "daily");
  assert.equal(b.tasks.find((t) => t.showDaily)?.notes, "earliest note");
  assert.equal(b.tasks.find((t) => t.done)?.completedAt, stamp);
  const recovery = await db.recoveries.toArray();
  assert.equal(recovery.length, 1);
  assert.deepEqual((recovery[0].data as typeof raw).tasks, raw.tasks);
  await materialize("2026-12-01");
  assert.equal(await db.tasks.count(), 2);
  db.close();
  await db.open();
  assert.equal(await db.recoveries.count(), 1);
  assert.equal(await db.tasks.count(), 2);
  const before = await snapshot();
  await assert.rejects(() => restore({ ...raw, entries: [{ id: "bad" }] }));
  b = await snapshot();
  assert.deepEqual(b.tasks, before.tasks);
  assert.equal(await db.recoveries.count(), 1);
  await restore(raw);
  assert.equal(await db.recoveries.count(), 2);
  assert.equal(await db.tasks.count(), 2);
  const v2 = await snapshot();
  await restore(v2);
  assert.deepEqual((await snapshot()).tasks, v2.tasks);
  assert.equal(await db.recoveries.count(), 2);
  await db.delete();
});
