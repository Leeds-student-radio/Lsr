/** Pure state transitions. No network, clock, Firebase SDK or credentials. */
export const SCHEMA_VERSION = 1;
export const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const RANK_CACHE_SIZE = 20;

export class IntegrityError extends Error {
  constructor(message) { super(message); this.name = "IntegrityError"; }
}

// Firestore document names use UTF-8 ordering, not locale collation.
export function compareDocumentIds(a, b) {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  for (let i = 0; i < Math.min(left.length, right.length); i += 1) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return left.length - right.length;
}

export function comparePlayTimes(a, b) {
  return a.playedAtSeconds - b.playedAtSeconds ||
    a.playedAtNanoseconds - b.playedAtNanoseconds;
}

const text = value => value ? String(value) : "";

// Admin SDK Timestamp.toMillis() floors sub-millisecond values; the browser
// Firebase SDK used by the original leaderboard retains fractional milliseconds.
export const browserTimestampMillis = stamp => stamp.seconds * 1000 + stamp.nanoseconds / 1e6;

export const compareTimestamps = (a, b) => a.seconds - b.seconds || a.nanoseconds - b.nanoseconds;

// asOf comes from Date.now() and is always an integer millisecond. This is the
// first such instant at which the original strict lower-window guard excludes
// the play. Integer storage avoids Firestore's microsecond truncation of a
// Timestamp constructed from a binary floating-point fractional millisecond.
export const firstIneligibleMillis = play => Math.ceil(play.playedAtMs) + WINDOW_MS;

export function normaliseSource(playId, data) {
  if (!data || !data.songId) return null; // Same ignored records as the old page.
  if (typeof data.songId !== "string") {
    throw new IntegrityError(`A non-string songId cannot preserve the original comparator: ${playId}`);
  }
  const stamp = data.playedAt;
  if (typeof stamp?.toMillis !== "function" || !Number.isFinite(stamp.toMillis())) return null;
  if (!Number.isInteger(stamp.seconds) || !Number.isInteger(stamp.nanoseconds) ||
      stamp.nanoseconds < 0 || stamp.nanoseconds >= 1e9) {
    throw new IntegrityError(`playedAt must be a Firestore Timestamp: ${playId}`);
  }
  const playedAtMs = browserTimestampMillis(stamp);
  return {
    playId,
    songId: data.songId,
    playedAtMs,
    playedAtSeconds: stamp.seconds,
    playedAtNanoseconds: stamp.nanoseconds,
    title: text(data.title),
    artist: text(data.artist),
    image: text(data.image)
  };
}

export function contributionAt(play, asOfMs) {
  if (!play) return null;
  if (!Number.isSafeInteger(asOfMs)) throw new IntegrityError("asOf must be an integer millisecond");
  const endSeconds = Math.floor(asOfMs / 1000);
  const endNanos = (asOfMs - endSeconds * 1000) * 1e6;
  // Preserve both the original Firestore <= upper bound and its toMillis guard.
  const future = play.playedAtSeconds > endSeconds ||
    (play.playedAtSeconds === endSeconds && play.playedAtNanoseconds > endNanos) ||
    play.playedAtMs > asOfMs;
  if (future) return { ...play, active: false };
  if (play.playedAtMs <= asOfMs - WINDOW_MS) return null;
  return { ...play, active: true };
}

const CONTRIBUTION_KEYS = [
  "playId", "songId", "playedAtMs", "playedAtSeconds", "playedAtNanoseconds",
  "title", "artist", "image", "active"
];

export function sameContribution(a, b) {
  if (!a || !b) return a === b;
  return CONTRIBUTION_KEYS.every(key => a[key] === b[key]);
}

export function compareEarliest(a, b) {
  return comparePlayTimes(a, b) || compareDocumentIds(a.playId, b.playId);
}

export function compareLatest(a, b) {
  // The old loop replaces metadata only when toMillis() strictly increases.
  // If millisecond values tie, the first original query result wins.
  return b.playedAtMs - a.playedAtMs || compareEarliest(a, b);
}

export function compareSongs(a, b) {
  return b.count - a.count || a.songId.localeCompare(b.songId) ||
    a.firstPlayedAtSeconds - b.firstPlayedAtSeconds ||
    a.firstPlayedAtNanoseconds - b.firstPlayedAtNanoseconds ||
    compareDocumentIds(a.firstPlayId, b.firstPlayId);
}

export function songAfterChange(songId, previous, oldPlay, newPlay, extremalCandidates) {
  const wasActive = oldPlay?.active === true && oldPlay.songId === songId;
  const isActive = newPlay?.active === true && newPlay.songId === songId;
  if (previous && (previous.songId !== songId || !Number.isSafeInteger(previous.count) || previous.count < 1)) {
    throw new IntegrityError(`Invalid existing counter for ${songId}`);
  }
  const remaining = extremalCandidates.filter(play => play.active && play.songId === songId &&
    play.playId !== oldPlay?.playId && play.playId !== newPlay?.playId);
  if (!previous && (wasActive || remaining.length > 0)) {
    throw new IntegrityError(`A contribution exists without its counter for ${songId}`);
  }
  const count = (previous?.count ?? 0) - Number(wasActive) + Number(isActive);
  if (count < 0 || !Number.isSafeInteger(count)) throw new IntegrityError(`Invalid resulting count for ${songId}`);
  if (count === 0) return null;
  const candidates = [...remaining, ...(isActive ? [newPlay] : [])];
  if (candidates.length === 0) throw new IntegrityError(`Missing remaining metadata for ${songId}`);
  const latest = [...candidates].sort(compareLatest)[0];
  const first = [...candidates].sort(compareEarliest)[0];
  return {
    songId,
    count,
    title: latest.title,
    artist: latest.artist,
    image: latest.image,
    latestPlayedAtMs: latest.playedAtMs,
    latestPlayId: latest.playId,
    firstPlayedAtSeconds: first.playedAtSeconds,
    firstPlayedAtNanoseconds: first.playedAtNanoseconds,
    firstPlayId: first.playId
  };
}

export const emptyRankCache = () => ({ rows: [], outsideBound: null });

function rankBound(row) {
  return {
    kind: "rank", count: row.count, songId: row.songId,
    firstPlayedAtSeconds: row.firstPlayedAtSeconds,
    firstPlayedAtNanoseconds: row.firstPlayedAtNanoseconds,
    firstPlayId: row.firstPlayId
  };
}

function strongerBound(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (a.count !== b.count) return a.count > b.count ? a : b;
  if (a.kind === "count") return a;
  if (b.kind === "count") return b;
  return compareSongs(a, b) <= 0 ? a : b;
}

export function updateRankCache(cache, changedSongs, size = RANK_CACHE_SIZE) {
  if (!cache || !Array.isArray(cache.rows)) throw new IntegrityError("Missing rank cache");
  const changes = new Map(changedSongs.map(change => [change.songId, change.row]));
  const rows = cache.rows.filter(row => !changes.has(row.songId));
  for (const row of changes.values()) if (row) rows.push(row);
  rows.sort(compareSongs);
  let outsideBound = cache.outsideBound ?? null;
  for (const omitted of rows.slice(size)) outsideBound = strongerBound(outsideBound, rankBound(omitted));
  return { rows: rows.slice(0, size), outsideBound };
}

export function rankCacheProvesTopFive(cache) {
  if (!cache || !Array.isArray(cache.rows)) return false;
  const bound = cache.outsideBound;
  if (!bound) return true;
  if (cache.rows.length < 5) return false;
  const fifth = cache.rows[4];
  if (fifth.count !== bound.count) return fifth.count > bound.count;
  return bound.kind === "rank" && compareSongs(fifth, bound) < 0;
}

/** initialRows is the indexed count-desc query of size+1; ties are all rows
 * at the size-th count, when that boundary is tied with the size+1-th row. */
export function refillRankCache(initialRows, ties = [], size = RANK_CACHE_SIZE) {
  const initial = [...initialRows].sort((a, b) => b.count - a.count);
  if (initial.length <= size) return { rows: initial.sort(compareSongs), outsideBound: null };
  const boundaryCount = initial[size - 1].count;
  const nextCount = initial[size].count;
  if (nextCount < boundaryCount) {
    return {
      rows: initial.slice(0, size).sort(compareSongs),
      outsideBound: { kind: "count", count: nextCount }
    };
  }
  const candidates = new Map();
  for (const row of [...initial.filter(row => row.count > boundaryCount), ...ties]) {
    candidates.set(row.songId, row);
  }
  const sorted = [...candidates.values()].sort(compareSongs);
  if (sorted.length <= size) throw new IntegrityError("Incomplete boundary-tie query");
  return { rows: sorted.slice(0, size), outsideBound: rankBound(sorted[size]) };
}

export function publicSongs(rows) {
  return [...rows].sort(compareSongs).slice(0, 5).map(({ songId, title, artist, image, count }) =>
    ({ songId, title, artist, image, count }));
}

/** Independent full reference calculation, used only for bootstrap/audit/tests. */
export function aggregateReference(plays, asOfMs) {
  const included = plays.map(play => contributionAt(play, asOfMs)).filter(play => play?.active)
    .sort(compareEarliest);
  const groups = new Map();
  for (const play of included) {
    const row = groups.get(play.songId);
    if (!row) {
      groups.set(play.songId, {
        songId: play.songId, count: 1,
        title: play.title, artist: play.artist, image: play.image,
        latestPlayedAtMs: play.playedAtMs, latestPlayId: play.playId,
        firstPlayedAtSeconds: play.playedAtSeconds,
        firstPlayedAtNanoseconds: play.playedAtNanoseconds, firstPlayId: play.playId
      });
    } else {
      row.count += 1;
      if (play.playedAtMs > row.latestPlayedAtMs) {
        Object.assign(row, {
          title: play.title, artist: play.artist, image: play.image,
          latestPlayedAtMs: play.playedAtMs, latestPlayId: play.playId
        });
      }
    }
  }
  return [...groups.values()].sort(compareSongs);
}
