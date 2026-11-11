import test from "node:test";
import assert from "node:assert/strict";
import {
  WINDOW_MS, RANK_CACHE_SIZE, IntegrityError, normaliseSource, contributionAt,
  sameContribution, compareDocumentIds, compareEarliest, compareLatest,
  compareSongs, songAfterChange, aggregateReference, publicSongs,
  emptyRankCache, updateRankCache, rankCacheProvesTopFive, refillRankCache, firstIneligibleMillis
} from "../src/model.js";

const NOW = Date.UTC(2026, 10, 11, 10, 30);
const timestamp = ms => {
  const seconds = Math.floor(ms / 1000);
  const nanoseconds = Math.round((ms - seconds * 1000) * 1e6);
  return { seconds, nanoseconds, toMillis: () => seconds * 1000 + nanoseconds / 1e6 };
};
const raw = (songId, ms, title = songId) => ({ songId, playedAt: timestamp(ms), title, artist: "Artist", image: "" });
const play = (id, songId, ms, title = songId) => normaliseSource(id, raw(songId, ms, title));

function refilled(rows) {
  const indexed = [...rows].sort((a, b) => b.count - a.count);
  const first = indexed.slice(0, RANK_CACHE_SIZE + 1);
  const ties = first.length > RANK_CACHE_SIZE && first[RANK_CACHE_SIZE].count === first[RANK_CACHE_SIZE - 1].count
    ? indexed.filter(row => row.count === first[RANK_CACHE_SIZE - 1].count) : [];
  return refillRankCache(first, ties);
}

test("last 168 hours includes every eligible play and excludes both wrong edges", () => {
  const values = [
    play("older", "a", NOW - WINDOW_MS - 1),
    play("boundary", "a", NOW - WINDOW_MS),
    play("inside", "a", NOW - WINDOW_MS + 1),
    play("now", "a", NOW),
    play("future", "a", NOW + 1)
  ];
  assert.equal(aggregateReference(values, NOW)[0].count, 2);
  assert.equal(contributionAt(values[1], NOW), null);
  assert.equal(contributionAt(values[4], NOW).active, false);
  assert.equal(contributionAt(values[4], NOW + 1).active, true);
});

test("precise upper timestamp bound survives floating millisecond rounding", () => {
  const seconds = Math.floor(NOW / 1000);
  const roundedFuture = normaliseSource("f", { songId: "a", playedAt: {
    seconds, nanoseconds: 1, toMillis: () => seconds * 1000 + 1e-6
  } });
  assert.equal(roundedFuture.playedAtMs, NOW);
  assert.equal(contributionAt(roundedFuture, NOW).active, false);
  assert.equal(contributionAt(roundedFuture, NOW + 1).active, true);
});

test("expiry is the first integer millisecond that fails the original window guard", () => {
  for (const fraction of [0, 0.001, 0.2, 0.5, 0.999]) {
    const value = play("p", "a", NOW - WINDOW_MS + fraction);
    const expiry = firstIneligibleMillis(value);
    assert.equal(contributionAt(value, expiry), null);
    assert.equal(contributionAt(value, expiry - 1)?.active, true);
    assert.equal(Number.isSafeInteger(expiry), true);
  }
});

test("invalid fields follow original ignore behavior and unexpected song ID types fail closed", () => {
  assert.equal(normaliseSource("x", null), null);
  assert.equal(normaliseSource("x", { songId: "", playedAt: timestamp(NOW) }), null);
  assert.equal(normaliseSource("x", { songId: "a" }), null);
  assert.throws(() => normaliseSource("x", { songId: 42, playedAt: timestamp(NOW) }), IntegrityError);
});

test("latest metadata and same-time first document match the original query loop", () => {
  const values = [
    play("z", "a", NOW - 5, "Latest but later ID"),
    play("b", "a", NOW - 100, "Old"),
    play("A", "a", NOW - 5, "Latest first ID")
  ];
  const row = aggregateReference(values, NOW)[0];
  assert.equal(row.title, "Latest first ID");
  assert.equal(row.latestPlayId, "A");
  assert.equal(row.firstPlayId, "b");
  assert.equal(row.count, 3);
});

test("UTF-8 document-name ordering is distinct from both locale and UTF-16 sorting", () => {
  assert.ok(compareDocumentIds("A", "a") < 0);
  assert.ok(compareDocumentIds("\u{10000}", "\uE000") > 0);
});

test("collation-equivalent song IDs retain first-play ordering like stable sort", () => {
  assert.equal("é".localeCompare("e\u0301"), 0);
  const rows = aggregateReference([
    play("z", "é", NOW - 100), play("a", "e\u0301", NOW - 200)
  ], NOW);
  assert.equal(rows[0].songId, "e\u0301");
});

test("one-play metadata corrections, removals and moves preserve full counters", () => {
  const a = contributionAt(play("a", "song", NOW - 100, "Old"), NOW);
  const b = contributionAt(play("b", "song", NOW - 1, "New"), NOW);
  const before = aggregateReference([a, b], NOW)[0];
  const afterDelete = songAfterChange("song", before, b, null, [a, b]);
  assert.equal(afterDelete.count, 1);
  assert.equal(afterDelete.title, "Old");
  assert.equal(afterDelete.firstPlayId, "a");
  const correction = { ...b, title: "Corrected" };
  const afterEdit = songAfterChange("song", before, b, correction, [a, b]);
  assert.equal(afterEdit.count, 2);
  assert.equal(afterEdit.title, "Corrected");
  assert.equal(songAfterChange("song", afterDelete, a, null, [a]), null);
});

test("duplicate source reconciliation has no second contribution", () => {
  const contribution = contributionAt(play("p", "song", NOW), NOW);
  assert.equal(sameContribution(contribution, { ...contribution, expiresAt: "extra SDK field" }), true);
  assert.equal(sameContribution(contribution, { ...contribution, title: "changed" }), false);
  assert.equal(sameContribution(null, null), true);
});

test("counter corruption fails closed", () => {
  const current = contributionAt(play("p", "song", NOW), NOW);
  assert.throws(() => songAfterChange("song", null, current, null, [current]), IntegrityError);
  assert.throws(() => songAfterChange("song", { songId: "song", count: 2 }, current, null, [current]), IntegrityError);
});

test("a complete empty/small rank cache proves an empty or short leaderboard", () => {
  assert.equal(rankCacheProvesTopFive(emptyRankCache()), true);
  const rows = aggregateReference([play("p", "a", NOW)], NOW);
  const cache = updateRankCache(emptyRankCache(), [{ songId: "a", row: rows[0] }]);
  assert.equal(rankCacheProvesTopFive(cache), true);
  assert.deepEqual(publicSongs(cache.rows), publicSongs(rows));
});

test("all-tied rank boundary refills with complete locale ordering", () => {
  const rows = aggregateReference(Array.from({ length: 250 }, (_, index) =>
    play(String(index), `song-${250 - index}`, NOW - index)), NOW);
  const cache = refilled(rows);
  assert.equal(cache.rows.length, 20);
  assert.equal(rankCacheProvesTopFive(cache), true);
  assert.deepEqual(publicSongs(cache.rows), publicSongs(rows));
  assert.throws(() => refillRankCache(rows.slice(0, 21), []), IntegrityError);
});

test("rank cache never certifies the wrong top five over 20,000 random updates", () => {
  let seed = 328479;
  const random = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return Math.floor(seed / 2 ** 32 * n); };
  const all = new Map();
  let cache = emptyRankCache();
  let refills = 0;
  for (let step = 0; step < 20_000; step += 1) {
    const removeLeader = step % 37 === 0 && all.size > 0;
    const songId = removeLeader ? [...all.values()].sort(compareSongs)[0].songId : `song-${random(250)}`;
    const old = all.get(songId);
    const count = removeLeader ? 0 : Math.max(0, (old?.count ?? 0) + (random(5) < 2 ? -1 : 1));
    const row = count ? {
      songId, count, title: `Title ${step}`, artist: "a", image: "",
      firstPlayedAtSeconds: random(100), firstPlayedAtNanoseconds: 0, firstPlayId: `p${step}`
    } : null;
    if (row) all.set(songId, row); else all.delete(songId);
    cache = updateRankCache(cache, [{ songId, row }]);
    const reference = [...all.values()].sort(compareSongs);
    if (rankCacheProvesTopFive(cache)) {
      assert.deepEqual(publicSongs(cache.rows), publicSongs(reference), `Invalid proof at step ${step}`);
    } else {
      cache = refilled(reference);
      refills += 1;
      assert.equal(rankCacheProvesTopFive(cache), true);
      assert.deepEqual(publicSongs(cache.rows), publicSongs(reference));
    }
    assert.ok(cache.rows.length <= RANK_CACHE_SIZE);
  }
  assert.ok(refills > 0, "The test must exercise cache refills");
});

test("source reconciliation matches brute-force history through random edits/deletes/expiration", () => {
  const source = new Map();
  const ledger = new Map();
  const stats = new Map();
  let clock = NOW;
  let cache = emptyRankCache();
  let seed = 1245;
  const random = n => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed % n; };
  function reconcile(id) {
    const old = ledger.get(id) ?? null;
    const next = contributionAt(source.get(id) ?? null, clock);
    if (sameContribution(old, next)) return;
    const ids = new Set([...(old?.active ? [old.songId] : []), ...(next?.active ? [next.songId] : [])]);
    const changes = [];
    for (const songId of ids) {
      const related = [...ledger.values()].filter(value => value.active && value.songId === songId);
      const candidates = [...[...related].sort(compareEarliest).slice(0, 2), ...[...related].sort(compareLatest).slice(0, 2)];
      const row = songAfterChange(songId, stats.get(songId) ?? null, old, next, candidates);
      if (row) stats.set(songId, row); else stats.delete(songId);
      changes.push({ songId, row });
    }
    if (next) ledger.set(id, next); else ledger.delete(id);
    cache = updateRankCache(cache, changes);
  }
  for (let step = 0; step < 1000; step += 1) {
    const id = `play-${random(70)}`;
    if (random(6) === 0) source.delete(id);
    else source.set(id, play(id, `song-${random(35)}`, clock - random(WINDOW_MS + 100) + 50, `Title ${step}`));
    reconcile(id);
    if (step % 10 === 0) {
      clock += 50_000;
      for (const ledgerId of [...ledger.keys()]) reconcile(ledgerId);
    }
    // Duplicate/out-of-order delivery always re-reads the same CURRENT source.
    reconcile(`play-${random(70)}`);
    const expected = aggregateReference([...source.values()], clock);
    assert.deepEqual([...stats.values()].sort(compareSongs), expected, `Counters at ${step}`);
    if (!rankCacheProvesTopFive(cache)) cache = refilled(expected);
    assert.deepEqual(publicSongs(cache.rows), publicSongs(expected), `Top five at ${step}`);
  }
});
