import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { makeService, PATHS } from "../src/service.js";
import { WINDOW_MS, IntegrityError } from "../src/model.js";

if (!/^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "")) {
  throw new Error("Integration tests require a LOCAL Firestore emulator. Production access is not permitted.");
}
const app = initializeApp({ projectId: "demo-lsr-weekly" }, "weekly-leaderboard-tests");
const db = getFirestore(app);
const BASE = Date.UTC(2026, 10, 11, 10, 30);
let clock;
let service;
const raw = (songId, playedAt, title = songId) => ({
  songId, playedAt: Timestamp.fromMillis(playedAt), title, artist: "Artist", image: "",
  // Deliberately eight days: this must never define leaderboard expiry.
  expiresAt: Timestamp.fromMillis(playedAt + 8 * 86_400_000)
});
const put = (id, data) => db.collection(PATHS.source).doc(id).set(data);
const publicSummary = async () => (await db.doc(PATHS.summary).get()).data();

async function ready() {
  await service.bootstrap();
  await service.runMaintenance({ allowUnverified: true });
  await service.verify({ certify: true });
  await service.runMaintenance();
}

beforeEach(async () => {
  // The host guard and fixed demo project above make these deletes emulator-only.
  for (const collection of [PATHS.source, PATHS.plays, PATHS.songs, "_weeklyLeaderboardControl", "leaderboards"]) {
    await db.recursiveDelete(db.collection(collection));
  }
  clock = BASE;
  service = makeService(db, { now: () => clock });
});
after(async () => { await db.terminate(); await deleteApp(app); });

test("bootstrap stays unavailable until full source/ledger/counter verification succeeds", async () => {
  await put("one", raw("a", clock - 10));
  await put("two", raw("a", clock - 5));
  await put("three", raw("b", clock - 1));
  await service.bootstrap();
  assert.equal((await publicSummary()).ready, false);
  await service.runMaintenance({ allowUnverified: true });
  const result = await service.verify({ certify: true });
  assert.equal(result.sourcePlays, 3);
  assert.equal(result.distinctSongs, 2);
  await service.runMaintenance();
  assert.equal((await publicSummary()).ready, true);
  assert.deepEqual((await publicSummary()).songs.map(row => [row.songId, row.count]), [["a", 2], ["b", 1]]);
});

test("duplicate and delayed events read current source and never double-count", async () => {
  await ready();
  clock += 10;
  await put("one", raw("a", clock));
  await Promise.all(Array.from({ length: 6 }, () => service.reconcile("one")));
  await service.runMaintenance();
  assert.equal((await publicSummary()).songs[0].count, 1);
  await put("one", raw("b", clock, "Corrected"));
  // Both an old event and its newer event resolve the same latest document.
  await Promise.all([service.reconcile("one"), service.reconcile("one")]);
  await service.runMaintenance();
  assert.deepEqual((await publicSummary()).songs.map(row => [row.songId, row.count, row.title]), [["b", 1, "Corrected"]]);
  await service.verify();
});

test("source deletion/move chooses correct remaining latest metadata and cleans zero counters", async () => {
  await put("old", raw("a", clock - 100, "Older title"));
  await put("A", raw("a", clock - 5, "Latest first ID"));
  await put("z", raw("a", clock - 5, "Latest second ID"));
  await ready();
  assert.equal((await publicSummary()).songs[0].title, "Latest first ID");
  await db.collection(PATHS.source).doc("A").delete();
  await service.reconcile("A");
  await service.runMaintenance();
  assert.equal((await publicSummary()).songs[0].title, "Latest second ID");
  await put("z", raw("b", clock - 5, "Moved"));
  await service.reconcile("z");
  await service.runMaintenance();
  const result = await service.verify();
  assert.deepEqual(result.songs.map(row => [row.songId, row.count, row.title]), [["a", 1, "Older title"], ["b", 1, "Moved"]]);
});

test("168-hour expiry works without new plays and does not trust raw eight-day TTL", async () => {
  await put("expiring", raw("a", clock - WINDOW_MS + 20));
  await ready();
  assert.equal((await publicSummary()).songs[0].count, 1);
  assert.equal((await publicSummary()).nextExpiryAt.toMillis(), clock + 20);
  clock += 20;
  await service.runMaintenance();
  assert.deepEqual((await publicSummary()).songs, []);
  assert.equal((await db.collection(PATHS.plays).get()).size, 0);
  assert.equal((await db.collection(PATHS.songs).get()).size, 0);
  assert.equal((await db.collection(PATHS.source).doc("expiring").get()).exists, true);
  await service.reconcile("expiring"); // Late duplicate cannot resurrect it.
  await service.runMaintenance();
  assert.deepEqual((await publicSummary()).songs, []);
  await service.verify();
});

test("future plays activate at their actual timestamp without another source write", async () => {
  await put("future", raw("a", clock + 5000));
  await ready();
  assert.deepEqual((await publicSummary()).songs, []);
  assert.equal((await publicSummary()).nextChangeAt.toMillis(), clock + 5000);
  clock += 5000;
  await service.runMaintenance();
  assert.equal((await publicSummary()).songs[0].count, 1);
  await service.verify();
});

test("live backfill handles events before its cursor and edits to already scanned records", async () => {
  const batch = db.batch();
  for (let i = 0; i < 105; i += 1) batch.set(db.collection(PATHS.source).doc(`p${i}`), raw(`song-${i}`, clock - 10_000 + i));
  await batch.commit();
  let injected = false;
  await service.bootstrap({ onProgress: async () => {
    if (injected) return;
    injected = true;
    await put("late-before-cursor", raw("a", clock - 500_000));
    await service.reconcile("late-before-cursor");
    await db.collection(PATHS.source).doc("p0").delete();
    await service.reconcile("p0");
    await put("p1", raw("updated", clock - 9000, "Updated during bootstrap"));
    await service.reconcile("p1");
  } });
  await service.runMaintenance({ allowUnverified: true });
  const checked = await service.verify({ certify: true });
  assert.equal(checked.sourcePlays, 105);
  await service.runMaintenance();
  assert.equal((await publicSummary()).ready, true);
});

test("verification detects trigger lag instead of certifying missing plays", async () => {
  await put("first", raw("a", clock - 100));
  await service.bootstrap();
  await service.runMaintenance({ allowUnverified: true });
  await put("unprocessed", raw("b", clock - 1));
  await assert.rejects(service.verify({ certify: true }), /Ledger mismatch/);
  assert.equal((await publicSummary()).ready, false);
  await service.reconcile("unprocessed");
  await service.runMaintenance({ allowUnverified: true });
  await service.verify({ certify: true });
  await service.runMaintenance();
  assert.equal((await publicSummary()).ready, true);
});

test("overlapping scheduled/event maintenance cannot publish mixed windows", async () => {
  await put("expiring", raw("a", clock - WINDOW_MS + 2));
  await put("future", raw("b", clock + 2));
  await ready();
  clock += 2;
  const outcomes = await Promise.all([service.runMaintenance(), service.runMaintenance()]);
  assert.ok(outcomes.some(result => !result.skipped));
  assert.deepEqual((await publicSummary()).songs.map(row => row.songId), ["b"]);
  await service.verify();
});

test("nanosecond timestamps whose toMillis values tie keep original first-query metadata", async () => {
  const seconds = Math.floor(clock / 1000) - 1;
  await put("first", { ...raw("a", clock - 1000, "First precise timestamp"), playedAt: new Timestamp(seconds, 1) });
  await put("last", { ...raw("a", clock - 1000, "Later precise timestamp"), playedAt: new Timestamp(seconds, 2) });
  await put("middle", { ...raw("a", clock - 1000, "Third precise timestamp"), playedAt: new Timestamp(seconds, 3) });
  await ready();
  assert.equal((await publicSummary()).songs[0].title, "First precise timestamp");
  await service.verify();
});

test("browser sub-millisecond metadata distinctions survive Admin SDK timestamp flooring", async () => {
  const seconds = Math.floor(clock / 1000) - 1;
  await put("A", { ...raw("a", clock - 1000, "Older fraction"), playedAt: new Timestamp(seconds, 200_000) });
  await put("z", { ...raw("a", clock - 1000, "Newer fraction"), playedAt: new Timestamp(seconds, 900_000) });
  await ready();
  assert.equal((await publicSummary()).songs[0].title, "Newer fraction");
  await service.verify();
});

test("fractional expiry does not loop or expire early at the previous integer millisecond", async () => {
  const seconds = Math.floor((clock - WINDOW_MS) / 1000);
  await put("fraction", { ...raw("a", clock - WINDOW_MS), playedAt: new Timestamp(seconds, 500_000) });
  await ready();
  assert.equal((await publicSummary()).songs[0].count, 1);
  await service.runMaintenance();
  assert.equal((await publicSummary()).songs[0].count, 1);
  clock += 1;
  await service.runMaintenance();
  assert.deepEqual((await publicSummary()).songs, []);
  await service.verify();
});

test("a one-microsecond boundary survives stored-timestamp precision without early expiry", async () => {
  const seconds = Math.floor((clock - WINDOW_MS) / 1000);
  await put("microsecond", { ...raw("a", clock - WINDOW_MS), playedAt: new Timestamp(seconds, 1000) });
  await ready();
  assert.equal((await publicSummary()).songs[0].count, 1);
  assert.equal((await publicSummary()).nextExpiryAt.toMillis(), clock + 1);
  await service.runMaintenance();
  assert.equal((await publicSummary()).songs[0].count, 1);
  clock += 1;
  await service.runMaintenance();
  assert.deepEqual((await publicSummary()).songs, []);
  await service.verify();
});

test("integrity failures remain unavailable until corrected source passes explicit verification", async () => {
  await ready();
  await put("bad", { ...raw("a", clock), songId: 42 });
  let failure;
  try { await service.reconcile("bad"); } catch (error) { failure = error; }
  assert.ok(failure instanceof IntegrityError);
  await service.recordIntegrityFailure(failure);
  assert.equal((await publicSummary()).ready, false);
  assert.equal((await service.runMaintenance()).skipped, true);
  await put("bad", raw("a", clock));
  await service.reconcile("bad");
  await service.runMaintenance({ allowUnverified: true });
  assert.equal((await publicSummary()).ready, false);
  await service.verify({ certify: true });
  await service.runMaintenance();
  assert.equal((await publicSummary()).ready, true);
});
