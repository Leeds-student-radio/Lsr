import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { parseArgs } from "node:util";
import {
  WINDOW_MS, normaliseSource, aggregateReference, publicSongs, compareDocumentIds,
  emptyRankCache, updateRankCache, rankCacheProvesTopFive, refillRankCache, RANK_CACHE_SIZE
} from "../src/model.js";

const { values } = parseArgs({ options: { file: { type: "string" }, asOf: { type: "string" } } });
if (!values.file) throw new Error("Usage: npm run fixture -- --file path/to/live-plays.json [--asOf ISO]");
const fixture = JSON.parse(await fs.readFile(values.file, "utf8"));
const asOfMs = Date.parse(values.asOf ?? fixture.cutoff);
if (!Number.isSafeInteger(asOfMs)) throw new Error("Fixture must provide cutoff as an ISO timestamp");

function decodeTimestamp(iso) {
  const match = iso.match(/^(.*?)(?:\.(\d{1,9}))?Z$/);
  if (!match) throw new Error(`Invalid ISO timestamp: ${iso}`);
  const seconds = Date.parse(`${match[1]}Z`) / 1000;
  const nanoseconds = Number((match[2] ?? "").padEnd(9, "0"));
  return { seconds, nanoseconds, toMillis: () => seconds * 1000 + nanoseconds / 1e6 };
}
const documents = fixture.documents.map(document => ({
  id: document.name.split("/").at(-1),
  data: Object.fromEntries(Object.entries(document.fields).map(([key, field]) => [key,
    "timestampValue" in field ? decodeTimestamp(field.timestampValue) :
      "stringValue" in field ? field.stringValue : "integerValue" in field ? Number(field.integerValue) : null
  ]))
}));
documents.sort((a, b) => a.data.playedAt.seconds - b.data.playedAt.seconds ||
  a.data.playedAt.nanoseconds - b.data.playedAt.nanoseconds || compareDocumentIds(a.id, b.id));

// Independent copy of the original page's counting/metadata loop.
const original = new Map();
for (const document of documents) {
  const value = document.data;
  const playedAt = value.playedAt?.toMillis();
  if (!value.songId || !Number.isFinite(playedAt) || playedAt <= asOfMs - WINDOW_MS || playedAt > asOfMs) continue;
  const existing = original.get(value.songId);
  if (existing) {
    existing.count += 1;
    if (playedAt > existing.latest) Object.assign(existing, { title: value.title, artist: value.artist, image: value.image, latest: playedAt });
  } else original.set(value.songId, { songId: value.songId, title: value.title, artist: value.artist, image: value.image, count: 1, latest: playedAt });
}
const originalTop = [...original.values()].sort((a, b) => b.count - a.count || a.songId.localeCompare(b.songId))
  .slice(0, 5).map(({ latest, ...row }) => row);
const modelRows = aggregateReference(documents.map(document => normaliseSource(document.id, document.data)), asOfMs);
assert.deepEqual(publicSongs(modelRows), originalTop);
let cache = emptyRankCache();
for (const row of [...modelRows].reverse()) cache = updateRankCache(cache, [{ songId: row.songId, row }]);
if (!rankCacheProvesTopFive(cache)) {
  const indexed = [...modelRows].sort((a, b) => b.count - a.count);
  const first = indexed.slice(0, RANK_CACHE_SIZE + 1);
  const ties = first.length > RANK_CACHE_SIZE ? indexed.filter(row => row.count === first[RANK_CACHE_SIZE - 1].count) : [];
  cache = refillRankCache(first, ties);
}
assert.deepEqual(publicSongs(cache.rows), originalTop);
console.log(JSON.stringify({
  matched: true, asOf: new Date(asOfMs).toISOString(),
  sourceDocuments: documents.length, includedPlays: modelRows.reduce((sum, row) => sum + row.count, 0),
  distinctSongs: modelRows.length, songs: originalTop
}, null, 2));
