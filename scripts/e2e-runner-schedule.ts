/**
 * End-to-end check of the runner auto-scheduling feature.
 * Creates its own test rows and deletes them at the end.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({ log: ["error"] });
const BASE = "http://localhost:3000";

const ADMIN = "esther@ebpublicrelations.com";

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail !== undefined && !ok ? ` -> ${JSON.stringify(detail)}` : ""}`);
  if (!ok) failures++;
}

async function api(
  path: string,
  init: { method?: string; body?: unknown; as?: string } = {}
): Promise<{ status: number; body: any; text: string }> {
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      Cookie: `ebpr_dev_user=${init.as ?? ADMIN}`,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* html */
  }
  return { status: res.status, body, text };
}

// ── Test fixtures ────────────────────────────────────────────────────────
const TEST_TITLE = "E2E — Auto-schedule probe";
const MONDAY = "2026-09-21"; // next Monday (Miami) relative to 2026-09-20
const MORNING = `${MONDAY}T10:00:00-04:00`; // Miami EDT
const AFTERNOON = `${MONDAY}T15:00:00-04:00`;

async function cleanup() {
  const dels = await db.deliverable.findMany({
    where: { title: TEST_TITLE },
    select: { id: true },
  });
  const ids = dels.map((d) => d.id);
  if (ids.length) {
    const assignments = await db.runnerAssignment.findMany({
      where: { deliverableId: { in: ids } },
      select: { id: true },
    });
    const aIds = assignments.map((a) => a.id);
    if (aIds.length) {
      await db.notification.deleteMany({
        where: { OR: aIds.map((id) => ({ link: { contains: id } })) },
      });
      await db.activityLog.deleteMany({ where: { deliverableId: { in: ids } } });
      await db.runnerAssignment.deleteMany({ where: { id: { in: aIds } } });
    }
    await db.activityLog.deleteMany({ where: { deliverableId: { in: ids } } });
    await db.comment.deleteMany({ where: { deliverableId: { in: ids } } });
    await db.deliverable.deleteMany({ where: { id: { in: ids } } });
  }
  await db.notification.deleteMany({
    where: { type: "runner_schedule_built", link: { contains: MONDAY } },
  });
}

async function main() {
  await cleanup();

  const [julieta, eliana] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { email: "julieta@ebpublicrelations.com" } }),
    db.user.findUniqueOrThrow({ where: { email: "eliana@ebpublicrelations.com" } }),
  ]);
  const client = await db.client.findFirstOrThrow({ where: { status: "ACTIVE" } });
  console.log(`\nRunners: ${julieta.name} (morning), ${eliana.name} (afternoon)`);
  console.log(`Client:  ${client.name}\n`);

  // Snapshot weekly availability so the run is non-destructive
  const before = await db.runnerWeeklyAvailability.findMany({
    where: { userId: { in: [julieta.id, eliana.id] } },
  });

  // ── 1. Two runners get weekly availability (Monday only, disjoint) ──────
  const w1 = await api("/api/runner-availability/weekly", {
    method: "PUT",
    body: { userId: julieta.id, windows: [{ dayOfWeek: 1, start: "09:00", end: "13:00" }] },
  });
  check("PUT weekly availability (Julieta, Mon 09:00–13:00)", w1.status === 200, w1.body);

  const w2 = await api("/api/runner-availability/weekly", {
    method: "PUT",
    body: { userId: eliana.id, windows: [{ dayOfWeek: 1, start: "14:00", end: "20:00" }] },
  });
  check("PUT weekly availability (Eliana, Mon 14:00–20:00)", w2.status === 200, w2.body);

  const readBack = await api(`/api/runner-availability/weekly?userId=${julieta.id}`);
  check(
    "GET weekly availability returns what was saved",
    readBack.body?.data?.windows?.[0]?.start === "09:00" &&
      readBack.body?.data?.windows?.[0]?.end === "13:00",
    readBack.body
  );

  // A runner may read their own but not someone else's
  const asRunnerSelf = await api(`/api/runner-availability/weekly`, {
    as: "julieta@ebpublicrelations.com",
  });
  check("RUNNER can read their own availability", asRunnerSelf.status === 200, asRunnerSelf.body);
  const asRunnerOther = await api(`/api/runner-availability/weekly?userId=${eliana.id}`, {
    as: "julieta@ebpublicrelations.com",
  });
  check("RUNNER cannot read another runner's availability", asRunnerOther.status === 403);

  // ── 2. Create a goal and confirm it ────────────────────────────────────
  const created = await api("/api/deliverables", {
    method: "POST",
    body: {
      clientId: client.id,
      title: TEST_TITLE,
      type: "EVENT_APPEARANCE",
      dueDate: MONDAY,
    },
  });
  check("POST /api/deliverables created the goal", created.status === 201 || created.status === 200, created.body);
  const deliverableId: string = created.body?.data?.id;
  if (!deliverableId) throw new Error("No deliverable id");

  const noAgendaYet = await db.runnerAssignment.count({ where: { deliverableId } });
  check("No agenda item before the goal is confirmed", noAgendaYet === 0, noAgendaYet);

  const confirmed = await api(`/api/deliverables/${deliverableId}/status`, {
    method: "POST",
    body: { status: "CONFIRMED" },
  });
  check("POST /api/deliverables/[id]/status -> CONFIRMED", confirmed.status === 200, confirmed.body);

  // ── 3. Part A: it appears on both agendas as one unassigned row ────────
  const assignment = await db.runnerAssignment.findFirst({ where: { deliverableId } });
  check("A RunnerAssignment was created automatically", !!assignment);
  check("…with no runner (needs a runner)", assignment?.runnerId === null, assignment?.runnerId);
  check("…with the goal's title", assignment?.eventName === TEST_TITLE, assignment?.eventName);
  check("…with itemType from the goal type (EVENT_APPEARANCE -> Event)", assignment?.itemType === "Event", assignment?.itemType);
  check("…with weekOf = Miami Monday", assignment?.weekOf.toISOString().startsWith("2026-09-21") ?? false, assignment?.weekOf);
  if (!assignment) throw new Error("no assignment");

  // Idempotent: confirming again must not create a second row
  await api(`/api/deliverables/${deliverableId}/status`, { method: "POST", body: { status: "IN_PROGRESS" } });
  const dupes = await db.runnerAssignment.count({ where: { deliverableId } });
  check("No double entry on a second transition", dupes === 1, dupes);

  const clientAgenda = await api(`/api/clients/${client.id}/agenda?year=2026`);
  const onClientAgenda = (clientAgenda.body?.data ?? []).find((i: any) => i.id === assignment.id);
  check("Visible on the CLIENT agenda", !!onClientAgenda, clientAgenda.status);
  check("…with runner null on the client agenda", onClientAgenda?.runner === null, onClientAgenda?.runner);

  const schedulePage = await api(`/runners/schedule?week=${MONDAY}`);
  check("Visible on the general RUNNER schedule page", schedulePage.text.includes(TEST_TITLE), schedulePage.status);
  check("…flagged 'Needs runner' there", schedulePage.text.includes("Needs runner"));

  // ── 4. Give the activity a morning time, then auto-assign ──────────────
  const timed = await api(`/api/runner-assignments/${assignment.id}`, {
    method: "PATCH",
    body: { eventTime: MORNING, eventDate: MONDAY },
  });
  check("PATCH set the activity to 10:00 Miami", timed.status === 200, timed.body);

  const auto = await api("/api/runner-assignments/auto-assign", {
    method: "POST",
    body: { from: MONDAY, to: MONDAY },
  });
  check("POST auto-assign succeeded", auto.status === 200, auto.body);
  const assignedEntry = (auto.body?.data?.assigned ?? []).find((a: any) => a.id === assignment.id);
  check(
    "10:00 activity went to the MORNING runner (Julieta)",
    assignedEntry?.runnerId === julieta.id,
    { report: auto.body?.data, expected: julieta.id }
  );

  const afterAuto = await db.runnerAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
  check("autoAssigned flag set", afterAuto.autoAssigned === true);
  check("assignedAt stamped", !!afterAuto.assignedAt);

  const notif = await db.notification.findFirst({
    where: { userId: julieta.id, link: { contains: assignment.id }, title: "New assignment" },
  });
  check("Runner was notified ('New assignment')", !!notif, notif);

  const log = await db.activityLog.findFirst({
    where: { action: "runner_auto_assigned", metadata: { path: ["assignmentId"], equals: assignment.id } },
  });
  check("ActivityLog row written", !!log);

  // ── 5. Move the time into the other runner's window ────────────────────
  const moved = await api(`/api/runner-assignments/${assignment.id}`, {
    method: "PATCH",
    body: { eventTime: AFTERNOON },
  });
  check("PATCH moved the activity to 15:00 Miami", moved.status === 200, moved.body);
  check("…and reported a re-assignment", moved.body?.reassigned === true, moved.body);

  const afterMove = await db.runnerAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
  check(
    "15:00 activity moved to the AFTERNOON runner (Eliana)",
    afterMove.runnerId === eliana.id,
    { got: afterMove.runnerId, expectedEliana: eliana.id, julieta: julieta.id }
  );
  const notif2 = await db.notification.findFirst({
    where: { userId: eliana.id, link: { contains: assignment.id }, title: "New assignment" },
  });
  check("New runner was notified", !!notif2);

  const schedulePage2 = await api(`/runners/schedule?week=${MONDAY}`);
  check(
    "Runner schedule page now shows the new runner",
    schedulePage2.text.includes(TEST_TITLE) && schedulePage2.text.includes(eliana.name.split(" ")[0]),
    schedulePage2.status
  );

  // ── 6. Nobody available -> stays unassigned and the team is told ───────
  const sunday = "2026-09-27"; // nobody has Sunday availability
  const movedOut = await api(`/api/runner-assignments/${assignment.id}`, {
    method: "PATCH",
    body: { eventDate: sunday, eventTime: `${sunday}T15:00:00-04:00` },
  });
  check("PATCH moved the activity to a day nobody covers", movedOut.status === 200, movedOut.body);
  const orphan = await db.runnerAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
  check("Activity is back to 'needs a runner'", orphan.runnerId === null, orphan.runnerId);
  const teamNotif = await db.notification.findFirst({
    where: { title: "Activity needs a runner", link: { contains: assignment.id } },
  });
  check("SUPER_ADMIN/STRATEGIST notified ('Activity needs a runner')", !!teamNotif);

  // Move it back into range for the cron test
  await api(`/api/runner-assignments/${assignment.id}`, {
    method: "PATCH",
    body: { eventDate: MONDAY, eventTime: MORNING },
  });

  // ── 7. Friday cron builds next week ────────────────────────────────────
  const cron = await api("/api/cron/runner-schedule");
  check("GET /api/cron/runner-schedule (as SUPER_ADMIN)", cron.status === 200, cron.body);
  check(
    "Cron summary counts the activity",
    typeof cron.body?.summary === "string" && cron.body.summary.includes("Next week"),
    cron.body?.summary
  );
  console.log(`      summary: ${cron.body?.summary}`);
  const afterCron = await db.runnerAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
  check("Cron assigned the morning activity to Julieta", afterCron.runnerId === julieta.id, afterCron.runnerId);
  const cronNotif = await db.notification.findFirst({
    where: { type: "runner_schedule_built", link: { contains: MONDAY } },
  });
  check("Team got the weekly summary notification", !!cronNotif);

  const cronUnauth = await fetch(`${BASE}/api/cron/runner-schedule`);
  check("Cron route rejects an anonymous caller", cronUnauth.status === 401, cronUnauth.status);

  // ── 8. Permissions on auto-assign ──────────────────────────────────────
  const asRunner = await api("/api/runner-assignments/auto-assign", {
    method: "POST",
    body: {},
    as: "julieta@ebpublicrelations.com",
  });
  check("RUNNER cannot trigger auto-assign", asRunner.status === 403, asRunner.status);
  const asStrategist = await api("/api/runner-assignments/auto-assign", {
    method: "POST",
    body: { from: MONDAY, to: MONDAY },
    as: "juanita@ebpublicrelations.com",
  });
  check("STRATEGIST can trigger auto-assign", asStrategist.status === 200, asStrategist.status);

  // ── 9. Availability pages render ───────────────────────────────────────
  const availPage = await api("/runners/availability");
  check("/runners/availability renders for SUPER_ADMIN", availPage.status === 200 && availPage.text.includes("Runner Availability"));
  // A RUNNER is bounced out of the dashboard group entirely (layout redirect),
  // so the page must never render its own heading for them.
  const availDenied = await api("/runners/availability", { as: "julieta@ebpublicrelations.com" });
  check(
    "/runners/availability is not reachable by a RUNNER",
    !availDenied.text.includes("Runner Availability"),
    availDenied.status
  );
  const portal = await api("/runner-portal", { as: "julieta@ebpublicrelations.com" });
  check("Runner portal shows 'My availability'", portal.status === 200 && portal.text.includes("My availability"));

  const clientAgendaPage = await api(`/clients/${client.id}/agenda`);
  check("Client agenda page renders", clientAgendaPage.status === 200, clientAgendaPage.status);

  // ── Cleanup ────────────────────────────────────────────────────────────
  await cleanup();
  await db.runnerWeeklyAvailability.deleteMany({
    where: { userId: { in: [julieta.id, eliana.id] } },
  });
  if (before.length) {
    await db.runnerWeeklyAvailability.createMany({ data: before });
  }
  const leftovers = await db.deliverable.count({ where: { title: TEST_TITLE } });
  check("Test rows cleaned up", leftovers === 0, leftovers);

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}\n`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
