import { createHash, randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { FieldPath, FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  SCHEMA_VERSION, WINDOW_MS, RANK_CACHE_SIZE, IntegrityError,
  normaliseSource, contributionAt, sameContribution, songAfterChange,
  emptyRankCache, updateRankCache, rankCacheProvesTopFive, refillRankCache,
  compareSongs, aggregateReference, publicSongs,
  firstIneligibleMillis, compareTimestamps
} from "./model.js";

export const PATHS = Object.freeze({
  source: "song_plays",
  plays: "_weeklyLeaderboardPlays",
  songs: "_weeklyLeaderboardSongs",
  control: "_weeklyLeaderboardControl/state",
  summary: "leaderboards/weeklyTopFive"
});

const LEASE_MS = 270_000;
const MAX_WORK_PER_RUN = 5_000;
const MAX_RUN_MS = 210_000;
const PAGE_SIZE = 100;

class DueWorkRemaining extends Error {}
const sameJSON = isDeepStrictEqual;

export function makeService(db, { now = () => Date.now() } = {}) {
  const source = db.collection(PATHS.source);
  const plays = db.collection(PATHS.plays);
  const songs = db.collection(PATHS.songs);
  const control = db.doc(PATHS.control);
  const summary = db.doc(PATHS.summary);
  const songRef = songId => songs.doc(createHash("sha256").update(songId).digest("hex"));
  const stamp = value => Timestamp.fromMillis(value);

  function requireState(snapshot) {
    const state = snapshot.data();
    if (!snapshot.exists || state.schemaVersion !== SCHEMA_VERSION || state.windowMs !== WINDOW_MS ||
        !Number.isSafeInteger(state.targetAsOf?.toMillis()) || state.targetAsOf.nanoseconds % 1e6 !== 0 ||
        !Number.isSafeInteger(state.revision)) {
      throw new IntegrityError("Missing or incompatible leaderboard control state");
    }
    return state;
  }

  function serialiseContribution(play) {
    return {
      ...play,
      playedAt: new Timestamp(play.playedAtSeconds, play.playedAtNanoseconds),
      // Deliberately ignore the raw document's expiresAt (its storage TTL is eight days).
      ...(play.active ? { expiresAt: stamp(firstIneligibleMillis(play)) } : {})
    };
  }

  function activeDue(asOf) {
    return plays.where("active", "==", true).where("expiresAt", "<=", asOf)
      .orderBy("expiresAt", "asc").limit(PAGE_SIZE);
  }

  function pendingDue(asOf) {
    return plays.where("active", "==", false).where("playedAt", "<=", asOf)
      .orderBy("playedAt", "asc").limit(PAGE_SIZE);
  }

  async function initialise() {
    return db.runTransaction(async transaction => {
      const current = await transaction.get(control);
      if (current.exists) return requireState(current);
      // Never silently attach a fresh control document to unknown old counters.
      const [oldPlays, oldSongs] = await Promise.all([
        transaction.get(plays.limit(1)), transaction.get(songs.limit(1))
      ]);
      if (!oldPlays.empty || !oldSongs.empty) {
        throw new IntegrityError("Internal data exists without control state; review before recovery");
      }
      const state = {
        schemaVersion: SCHEMA_VERSION,
        windowMs: WINDOW_MS,
        targetAsOf: stamp(now()),
        revision: 0,
        rankCache: emptyRankCache(),
        bootstrapCompleted: false,
        verified: false,
        integrityBlocked: false,
        phase: "bootstrap",
        createdAt: FieldValue.serverTimestamp()
      };
      transaction.create(control, state);
      transaction.set(summary, {
        schemaVersion: SCHEMA_VERSION, windowMs: WINDOW_MS,
        ready: false, status: "initialising", songs: [],
        asOf: state.targetAsOf, nextExpiryAt: null, nextChangeAt: null,
        revision: 0, generatedAt: FieldValue.serverTimestamp(), sourceConsistency: "eventual"
      });
      return state;
    });
  }

  async function reconcile(playId) {
    if (typeof playId !== "string" || !playId || playId.includes("/")) throw new IntegrityError("Invalid play document ID");
    await initialise();
    return db.runTransaction(async transaction => {
      const state = requireState(await transaction.get(control));
      const [raw, previousSnapshot] = await transaction.getAll(source.doc(playId), plays.doc(playId));
      const previous = previousSnapshot.exists ? previousSnapshot.data() : null;
      const desired = contributionAt(normaliseSource(playId, raw.exists ? raw.data() : null), state.targetAsOf.toMillis());
      if (sameContribution(previous, desired)) return { changed: false, revision: state.revision };

      const affectedIds = [...new Set([
        ...(previous?.active ? [previous.songId] : []),
        ...(desired?.active ? [desired.songId] : [])
      ])];
      const previousStats = affectedIds.length ? await transaction.getAll(...affectedIds.map(songRef)) : [];
      const changes = [];
      for (let i = 0; i < affectedIds.length; i += 1) {
        const songId = affectedIds[i];
        const baseQuery = plays.where("songId", "==", songId).where("active", "==", true);
        // Two of each extreme suffice because this transaction replaces only one play.
        // Ordering on playedAtMs first preserves the original strict toMillis metadata test.
        const [earliest, latest] = await Promise.all([
          transaction.get(baseQuery.orderBy("playedAt", "asc").orderBy(FieldPath.documentId(), "asc").limit(2)),
          transaction.get(baseQuery.orderBy("playedAtMs", "desc").orderBy("playedAt", "asc")
            .orderBy(FieldPath.documentId(), "asc").limit(2))
        ]);
        const candidates = new Map([...earliest.docs, ...latest.docs].map(doc => [doc.id, doc.data()]));
        changes.push({
          songId,
          row: songAfterChange(songId, previousStats[i].exists ? previousStats[i].data() : null,
            previous, desired, [...candidates.values()])
        });
      }
      const rankCache = updateRankCache(state.rankCache, changes);
      if (Buffer.byteLength(JSON.stringify(rankCache)) > 750_000) {
        throw new IntegrityError("Unexpectedly large song metadata would exceed the bounded rank cache");
      }
      // All transaction reads precede every write.
      if (desired) transaction.set(plays.doc(playId), serialiseContribution(desired));
      else transaction.delete(plays.doc(playId));
      for (const change of changes) {
        if (change.row) transaction.set(songRef(change.songId), change.row);
        else transaction.delete(songRef(change.songId));
      }
      transaction.update(control, {
        revision: state.revision + 1, rankCache,
        updatedAt: FieldValue.serverTimestamp()
      });
      return { changed: true, revision: state.revision + 1 };
    });
  }

  async function recordIntegrityFailure(error) {
    // Keep any previously published songs visible as stale, but do not certify bad state.
    const message = String(error?.message ?? error).slice(0, 1000);
    await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(control);
      if (!snapshot.exists) return;
      transaction.update(control, {
        integrityBlocked: true, verified: false,
        lastIntegrityError: message, lastIntegrityErrorAt: FieldValue.serverTimestamp()
      });
      transaction.set(summary, { ready: false, status: "verification-required" }, { merge: true });
    });
  }

  async function claimMaintenance({ allowUnverified = false } = {}) {
    const token = randomUUID();
    return db.runTransaction(async transaction => {
      const snapshot = await transaction.get(control);
      if (!snapshot.exists) return null;
      const state = requireState(snapshot);
      if (!state.bootstrapCompleted || (state.integrityBlocked && !allowUnverified) || (!state.verified && !allowUnverified)) return null;
      const currentMs = now();
      if (state.leaseUntil?.toMillis() > currentMs) return null;
      const targetMs = Math.max(currentMs, state.targetAsOf.toMillis());
      transaction.update(control, {
        targetAsOf: stamp(targetMs), phase: "advancing",
        leaseToken: token, leaseUntil: stamp(currentMs + LEASE_MS)
      });
      return { token, asOf: stamp(targetMs), allowUnverified };
    });
  }

  async function publish(lease) {
    return db.runTransaction(async transaction => {
      const state = requireState(await transaction.get(control));
      if (state.leaseToken !== lease.token || !state.targetAsOf.isEqual(lease.asOf)) {
        throw new Error("Maintenance lease changed before publication");
      }
      if (state.integrityBlocked && !lease.allowUnverified) throw new IntegrityError("Publication is blocked pending verification");
      const [nextExpiry, nextActivation] = await Promise.all([
        transaction.get(plays.where("active", "==", true).orderBy("expiresAt", "asc").limit(1)),
        transaction.get(plays.where("active", "==", false).orderBy("playedAt", "asc").limit(1))
      ]);
      const nextExpiryAt = nextExpiry.empty ? null : nextExpiry.docs[0].data().expiresAt;
      const nextActivationAt = nextActivation.empty ? null : nextActivation.docs[0].data().playedAt;
      if ((nextExpiryAt && compareTimestamps(nextExpiryAt, lease.asOf) <= 0) ||
          (nextActivationAt && compareTimestamps(nextActivationAt, lease.asOf) <= 0)) {
        throw new DueWorkRemaining("A concurrent reconciliation left due work");
      }
      let rankCache = state.rankCache;
      if (!rankCacheProvesTopFive(rankCache)) {
        const first = await transaction.get(songs.orderBy("count", "desc").limit(RANK_CACHE_SIZE + 1));
        const rows = first.docs.map(doc => doc.data());
        let tiedRows = [];
        if (rows.length > RANK_CACHE_SIZE && rows[RANK_CACHE_SIZE].count === rows[RANK_CACHE_SIZE - 1].count) {
          const tied = await transaction.get(songs.where("count", "==", rows[RANK_CACHE_SIZE - 1].count));
          tiedRows = tied.docs.map(doc => doc.data());
        }
        rankCache = refillRankCache(rows, tiedRows);
      }
      const nextChangeAt = [nextExpiryAt, nextActivationAt].filter(Boolean)
        .sort((a, b) => a.seconds - b.seconds || a.nanoseconds - b.nanoseconds)[0] ?? null;
      const output = {
        schemaVersion: SCHEMA_VERSION,
        windowMs: WINDOW_MS,
        ready: Boolean(state.bootstrapCompleted && state.verified && !state.integrityBlocked),
        status: state.verified && !state.integrityBlocked ? "ready" : "verification-required",
        asOf: lease.asOf,
        generatedAt: FieldValue.serverTimestamp(),
        nextExpiryAt, nextChangeAt,
        songs: publicSongs(rankCache.rows),
        revision: state.revision,
        sourceConsistency: "eventual"
      };
      transaction.set(summary, output);
      transaction.update(control, {
        rankCache, phase: "ready", publishedRevision: state.revision,
        publishedAsOf: lease.asOf,
        leaseToken: FieldValue.delete(), leaseUntil: FieldValue.delete(),
        lastMaintenanceError: FieldValue.delete()
      });
      return output;
    });
  }

  async function runMaintenance(options = {}) {
    const lease = await claimMaintenance(options);
    if (!lease) return { skipped: true };
    const deadline = Date.now() + MAX_RUN_MS;
    let processed = 0;
    try {
      for (;;) {
        for (const dueQuery of [activeDue(lease.asOf), pendingDue(lease.asOf)]) {
          for (;;) {
            const due = await dueQuery.get();
            if (due.empty) break;
            for (const document of due.docs) {
              if (processed >= MAX_WORK_PER_RUN || Date.now() >= deadline) {
                throw new Error("Maintenance work limit reached; next run will resume safely");
              }
              await reconcile(document.id);
              processed += 1;
            }
          }
        }
        try {
          const output = await publish(lease);
          return { skipped: false, processed, output };
        } catch (error) {
          if (!(error instanceof DueWorkRemaining) || Date.now() >= deadline) throw error;
        }
      }
    } catch (error) {
      await db.runTransaction(async transaction => {
        const snapshot = await transaction.get(control);
        if (!snapshot.exists || snapshot.data().leaseToken !== lease.token) return;
        transaction.update(control, {
          leaseToken: FieldValue.delete(), leaseUntil: FieldValue.delete(),
          phase: "maintenance-pending", lastMaintenanceError: String(error.message).slice(0, 1000)
        });
      });
      if (error instanceof IntegrityError) await recordIntegrityFailure(error);
      throw error;
    }
  }

  async function bootstrap({ onProgress = () => {} } = {}) {
    const state = await initialise();
    if (state.bootstrapCompleted) return { alreadyCompleted: true, reconciled: 0 };
    const cutoff = stamp(state.targetAsOf.toMillis() - WINDOW_MS);
    // Include future timestamps so they can become eligible without a new write.
    const base = source.where("playedAt", ">", cutoff).orderBy("playedAt", "asc")
      .orderBy(FieldPath.documentId(), "asc").limit(PAGE_SIZE);
    let cursor = null;
    let reconciled = 0;
    for (;;) {
      const page = await (cursor ? base.startAfter(cursor) : base).get();
      if (page.empty) break;
      for (const document of page.docs) {
        await reconcile(document.id); // Read current source again; never trust a stale page.
        reconciled += 1;
      }
      cursor = page.docs.at(-1);
      await onProgress({ reconciled });
    }
    await db.runTransaction(async transaction => {
      const current = requireState(await transaction.get(control));
      if (current.bootstrapCompleted) return;
      transaction.update(control, { bootstrapCompleted: true, bootstrapCompletedAt: FieldValue.serverTimestamp() });
    });
    return { alreadyCompleted: false, reconciled };
  }

  async function verify({ certify = false } = {}) {
    // This intentionally reads the raw week once, only for installation/audit.
    // It compares a single transaction snapshot, including all per-play ledger IDs,
    // full counts, metadata and ranking. No checksum can hide a missing/extra play.
    return db.runTransaction(async transaction => {
      const state = requireState(await transaction.get(control));
      if (!state.bootstrapCompleted || state.leaseToken) throw new Error("Complete bootstrap/maintenance before verification");
      const asOfMs = state.targetAsOf.toMillis();
      const [rawSnapshot, ledgerSnapshot, statsSnapshot] = await Promise.all([
        transaction.get(source.where("playedAt", ">", stamp(asOfMs - WINDOW_MS))
          .orderBy("playedAt", "asc").orderBy(FieldPath.documentId(), "asc")),
        transaction.get(plays),
        transaction.get(songs)
      ]);
      const rawPlays = rawSnapshot.docs.map(doc => normaliseSource(doc.id, doc.data())).filter(Boolean);
      const expectedContributions = new Map(rawPlays.map(play => contributionAt(play, asOfMs))
        .filter(Boolean).map(play => [play.playId, play]));
      if (expectedContributions.size !== ledgerSnapshot.size) {
        throw new Error(`Ledger mismatch: expected ${expectedContributions.size}, found ${ledgerSnapshot.size}; retry after triggers catch up`);
      }
      for (const document of ledgerSnapshot.docs) {
        const expected = expectedContributions.get(document.id);
        if (!expected || !sameContribution(document.data(), expected)) {
          throw new Error(`Ledger mismatch for ${document.id}; retry after triggers catch up`);
        }
        if (expected.active && (!document.data().expiresAt ||
            !document.data().expiresAt.isEqual(stamp(firstIneligibleMillis(expected))))) {
          throw new IntegrityError(`Incorrect rolling expiry for ${document.id}`);
        }
      }
      const expectedRows = aggregateReference(rawPlays, asOfMs);
      const actualRows = statsSnapshot.docs.map(doc => doc.data()).sort(compareSongs);
      if (!sameJSON(actualRows, expectedRows)) throw new Error("Full song counts/metadata do not match source; keep summary unverified");
      if (!rankCacheProvesTopFive(state.rankCache) ||
          !sameJSON(publicSongs(state.rankCache.rows), publicSongs(expectedRows))) {
        throw new Error("Rank cache does not prove the reference top five; run maintenance before verification");
      }
      if (certify) {
        transaction.update(control, {
          verified: true, integrityBlocked: false,
          verifiedAt: FieldValue.serverTimestamp(), verifiedAgainstAsOf: state.targetAsOf,
          verifiedSourcePlayCount: rawPlays.filter(play => contributionAt(play, asOfMs)?.active).length,
          lastIntegrityError: FieldValue.delete(), lastIntegrityErrorAt: FieldValue.delete()
        });
      }
      return {
        asOf: new Date(asOfMs).toISOString(),
        sourcePlays: rawPlays.filter(play => contributionAt(play, asOfMs)?.active).length,
        futurePlays: [...expectedContributions.values()].filter(play => !play.active).length,
        distinctSongs: expectedRows.length,
        songs: publicSongs(expectedRows), certified: certify
      };
    });
  }

  return { initialise, reconcile, bootstrap, verify, runMaintenance, recordIntegrityFailure };
}
