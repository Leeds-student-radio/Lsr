import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import {
    createWeeklyTopFiveClient,
    MAX_SUMMARY_AGE_MS,
    MIN_SUBSCRIPTION_RETRY_MS,
    validateWeeklyTopFiveSummary,
    weeklyTopFiveRows,
    WEEKLY_TOP_FIVE_DOCUMENT,
    WEEKLY_WINDOW_MS
} from "../weekly-top-five-client.mjs";

const BASE_TIME = Date.UTC(2026, 10, 11, 12);
const timestamp = milliseconds => ({ toMillis: () => milliseconds });
const song = (songId, count, overrides = {}) => ({
    songId, title: `Song ${songId}`, artist: "Artist", image: "https://example.com/art.jpg", count,
    ...overrides
});
const summary = (overrides = {}) => ({
    schemaVersion: 1,
    windowMs: WEEKLY_WINDOW_MS,
    ready: true,
    asOf: timestamp(BASE_TIME),
    nextExpiryAt: timestamp(BASE_TIME + 3600000),
    songs: [song("b", 3), song("a", 3), song("c", 1)],
    ...overrides
});

function harness() {
    let time = BASE_TIME;
    const subscriptions = [];
    const updates = [];
    const client = createWeeklyTopFiveClient({
        now: () => time,
        onUpdate: state => updates.push(state),
        subscribeSummary(onValue, onError) {
            const subscription = { onValue, onError, detachCount: 0 };
            subscriptions.push(subscription);
            return () => { subscription.detachCount += 1; };
        }
    });
    return {
        client, subscriptions, updates,
        setTime: next => { time = next; },
        publish: (data, fromCache = false) => subscriptions.at(-1).onValue({ data, fromCache })
    };
}

test("summary rows preserve count order, existing tie-break, fallbacks and safe HTML", () => {
    const parsed = validateWeeklyTopFiveSummary(summary({
        songs: [
            song("b", 3, { title: "<A & B> \"live\"", artist: "O'Neil", image: 'https://example.com/cover?x="&y=1' }),
            song("a", 3, { title: "", artist: null, image: "javascript:alert(1)" }),
            song("c", 1)
        ]
    }));
    assert.deepEqual(parsed.songs.map(item => item.songId), ["a", "b", "c"]);
    assert.deepEqual(weeklyTopFiveRows(parsed).slice(0, 2), [
        { title: "Unknown Song", artist: "Unknown Artist", image: "", count: 3 },
        {
            title: "&lt;A &amp; B&gt; &quot;live&quot;", artist: "O&#39;Neil",
            image: "https://example.com/cover?x=&quot;&amp;y=1", count: 3
        }
    ]);
});

test("malformed summaries cannot silently become a chart", () => {
    const invalid = [
        { schemaVersion: 2 },
        { ready: "true" },
        { windowMs: WEEKLY_WINDOW_MS - 1 },
        { asOf: null },
        { nextExpiryAt: undefined },
        { songs: Array.from({ length: 6 }, (_, i) => song(String(i), 1)) },
        { songs: [song("a", 1), song("a", 2)] },
        { songs: [song("a", 0)] },
        { songs: [song("a", 1.5)] },
        { songs: [song("a", "12")] },
        { songs: [song("a", 1, { title: {} })] }
    ];
    for (const value of invalid) {
        assert.throws(() => validateWeeklyTopFiveSummary(summary(value)));
    }
    for (const value of [true, 1, "chart", []]) {
        assert.throws(() => validateWeeklyTopFiveSummary(value));
    }
});

test("missing and unready documents remain distinct from a valid empty leaderboard", () => {
    const h = harness();
    h.client.start();
    h.publish(null, true);
    assert.equal(h.client.getState().status, "loading");
    assert.equal(h.client.getState().rows, null);
    h.publish(null);
    assert.equal(h.client.getState().status, "unavailable");
    assert.equal(h.client.getState().rows, null);
    h.publish(summary({ ready: false, songs: [] }));
    assert.equal(h.client.getState().status, "unavailable");
    assert.equal(h.client.getState().rows, null);
    h.publish(summary({ ready: undefined, songs: [] }));
    assert.equal(h.client.getState().status, "unavailable");
    assert.equal(h.client.getState().rows, null);
    h.publish(summary({ songs: [], nextExpiryAt: null }));
    assert.equal(h.client.getState().status, "fresh");
    assert.deepEqual(h.client.getState().rows, []);
});

test("repeated starts and minute freshness checks share one subscription", () => {
    const h = harness();
    h.client.start();
    h.publish(summary());
    for (let i = 0; i < 120; i += 1) {
        h.client.start();
        h.client.getState();
    }
    assert.equal(h.subscriptions.length, 1);
    assert.equal(h.updates.length, 1);
});

test("cached data is visibly unconfirmed until the server confirms it", () => {
    const h = harness();
    h.client.start();
    h.publish(summary(), true);
    assert.equal(h.client.getState().status, "stale");
    assert.match(h.client.getState().message, /Reconnecting/);
    assert.equal(h.client.getState().rows.length, 3);
    h.publish(summary(), false);
    assert.equal(h.client.getState().status, "fresh");
    assert.equal(h.client.getState().message, "");
});

test("expiration and future-play activation can make the chart stale without new plays", () => {
    for (const timeField of ["nextExpiryAt", "nextChangeAt"]) {
        const h = harness();
        h.client.start();
        h.publish(summary({ [timeField]: timestamp(BASE_TIME + 10000) }));
        h.setTime(BASE_TIME + 9999);
        assert.equal(h.client.getState().status, "fresh");
        h.setTime(BASE_TIME + 10000);
        assert.equal(h.client.getState().status, "stale");
        assert.equal(h.subscriptions.length, 1);
        h.publish(summary({
            asOf: timestamp(BASE_TIME + 10000),
            songs: [song("sixth-place-promoted", 2)],
            nextExpiryAt: timestamp(BASE_TIME + 60000)
        }));
        assert.equal(h.client.getState().status, "fresh");
        assert.equal(h.client.getState().rows[0].title, "Song sixth-place-promoted");
    }
});

test("a stopped backend heartbeat marks even an unchanged or empty chart stale", () => {
    const h = harness();
    h.client.start();
    h.publish(summary({ songs: [], nextExpiryAt: null }));
    h.setTime(BASE_TIME + MAX_SUMMARY_AGE_MS);
    assert.equal(h.client.getState().status, "fresh");
    h.setTime(BASE_TIME + MAX_SUMMARY_AGE_MS + 1);
    assert.equal(h.client.getState().status, "stale");
    assert.equal(h.subscriptions.length, 1);
});

test("missing, rebuilding, malformed and older updates preserve previously valid rows", () => {
    const h = harness();
    h.client.start();
    h.publish(summary());
    const previous = h.client.getState().rows;
    for (const next of [
        null,
        summary({ ready: false }),
        summary({ songs: [song("broken", -3)] }),
        summary({ asOf: timestamp(BASE_TIME - 1000), songs: [] })
    ]) {
        h.publish(next);
        assert.equal(h.client.getState().status, "stale");
        assert.deepEqual(h.client.getState().rows, previous);
    }
    h.publish(summary({ asOf: timestamp(BASE_TIME + 1000), songs: [song("new", 8)] }));
    assert.equal(h.client.getState().status, "fresh");
    assert.equal(h.client.getState().rows[0].count, 8);
});

test("terminal listener retries retain data and are limited to once per minute", () => {
    const h = harness();
    h.client.start();
    h.publish(summary());
    const old = h.subscriptions[0];
    old.onError(new Error("permission denied"));
    assert.equal(old.detachCount, 1);
    assert.equal(h.client.getState().status, "stale");
    assert.equal(h.client.getState().rows.length, 3);
    h.client.start();
    assert.equal(h.subscriptions.length, 1);
    h.client.stop();
    h.client.start();
    assert.equal(h.subscriptions.length, 1, "hiding or navigating must not bypass the retry delay");
    h.setTime(BASE_TIME + MIN_SUBSCRIPTION_RETRY_MS - 1);
    h.client.start();
    assert.equal(h.subscriptions.length, 1);
    h.setTime(BASE_TIME + MIN_SUBSCRIPTION_RETRY_MS);
    h.client.start();
    assert.equal(h.subscriptions.length, 2);
    old.onValue({ data: summary({ songs: [] }), fromCache: false });
    assert.equal(h.client.getState().rows.length, 3);
    h.publish(summary({ asOf: timestamp(BASE_TIME + MIN_SUBSCRIPTION_RETRY_MS) }));
    assert.equal(h.client.getState().status, "fresh");
});

test("stopping invalidates late callbacks without losing the last valid display", () => {
    const h = harness();
    h.client.start();
    h.publish(summary());
    h.client.stop();
    h.subscriptions[0].onValue({ data: summary({ songs: [] }), fromCache: false });
    assert.equal(h.client.getState().rows.length, 3);
    assert.equal(h.client.getState().status, "stale");
    assert.equal(h.subscriptions[0].detachCount, 1);
});

function fakeTable(weekly) {
    return {
        id: "lsr-trk-wgt-song-table-body",
        dataset: weekly ? { weekly: "true" } : {},
        isConnected: true,
        children: [],
        renderedRows: null,
        html: "",
        set innerHTML(value) { this.html = value; this.children = []; this.renderedRows = null; },
        replaceChildren() { this.html = ""; this.children = []; this.renderedRows = null; },
        appendChild(child) { this.children.push(child); }
    };
}

test("actual site integration survives SPA navigation and never polls raw song plays", async () => {
    const source = await readFile(new URL("../generalscript.js", import.meta.url), "utf8");
    // This is a cost regression guard: a missing summary must never restore raw reads.
    assert.doesNotMatch(source, /["']song_plays["']/);
    const start = source.indexOf("    let songLoadVersion = 0;");
    const end = source.indexOf("    async function loadArtists()", start);
    assert.ok(start > 0 && end > start);
    assert.match(source, /currentMain\.innerHTML = newMain\.innerHTML;\s*syncWeeklyTopFive\(\);/);

    let current = fakeTable(true);
    let time = BASE_TIME;
    let resolveAllTime;
    const subscriptions = [];
    const intervals = [];
    const listeners = {};
    const context = vm.createContext({
        console: { warn() {}, error() {} },
        createWeeklyTopFiveClient: options => createWeeklyTopFiveClient({ ...options, now: () => time }),
        WEEKLY_TOP_FIVE_DOCUMENT,
        shazamApp: {},
        getFirestore: () => "database",
        doc: (database, path) => ({ database, path }),
        onSnapshot(reference, options, onValue, onError) {
            assert.equal(reference.path, WEEKLY_TOP_FIVE_DOCUMENT);
            assert.equal(options.includeMetadataChanges, true);
            const subscription = { onValue, onError, detachCount: 0 };
            subscriptions.push(subscription);
            return () => { subscription.detachCount += 1; };
        },
        cachedSongs: null,
        fetchChartData: () => new Promise(resolve => { resolveAllTime = resolve; }),
        displayLeaderboard(rows, type, id) {
            assert.equal(id, current.id);
            current.renderedRows = rows;
            current.children = [];
        },
        document: {
            hidden: false,
            getElementById: () => current,
            querySelector: () => current?.dataset.weekly === "true" ? current : null,
            createElement: () => ({ style: {}, setAttribute() {}, textContent: "" }),
            addEventListener: (name, callback) => { listeners[name] = callback; }
        },
        setInterval(callback, delay) { intervals.push({ callback, delay }); }
    });
    vm.runInContext(source.slice(start, end), context);
    const publish = (data, fromCache = false) => subscriptions.at(-1).onValue({
        exists: () => data != null,
        data: () => data,
        metadata: { fromCache, hasPendingWrites: false }
    });

    context.document.hidden = true;
    await context.loadSongs();
    assert.equal(subscriptions.length, 0, "a background tab must not start the listener");
    context.document.hidden = false;
    listeners.visibilitychange();
    await context.loadSongs();
    assert.equal(subscriptions.length, 1);
    publish(summary());
    assert.equal(current.renderedRows[0].title, "Song a");

    context.document.hidden = true;
    listeners.visibilitychange();
    assert.equal(subscriptions[0].detachCount, 1);
    publish(summary({ songs: [] }));
    intervals[0].callback();
    assert.equal(subscriptions.length, 1, "hidden tabs must not restart listeners");
    assert.equal(current.renderedRows[0].title, "Song a", "late detached callbacks must be ignored");
    context.document.hidden = false;
    listeners.visibilitychange();
    assert.equal(subscriptions.length, 2);
    publish(summary());

    current.isConnected = false;
    current = fakeTable(false);
    const pendingAllTime = context.loadSongs();
    assert.equal(subscriptions[1].detachCount, 1);
    publish(summary({ asOf: timestamp(BASE_TIME + 1000), songs: [song("updated", 7)] }));
    assert.equal(current.renderedRows, null, "weekly listener must not render into /chart");

    current.isConnected = false;
    current = fakeTable(true);
    await context.loadSongs();
    assert.equal(subscriptions.length, 3);
    publish(summary({ asOf: timestamp(BASE_TIME + 1000), songs: [song("updated", 7)] }));
    assert.equal(current.renderedRows[0].title, "Song updated");
    resolveAllTime([{ title: "All-time result", count: 99 }]);
    await pendingAllTime;
    assert.equal(current.renderedRows[0].title, "Song updated", "late all-time response must not overwrite /listen");
    assert.equal(subscriptions.length, 3);

    assert.equal(intervals.length, 1);
    assert.equal(intervals[0].delay, 60000);
    for (let i = 0; i < 60; i += 1) intervals[0].callback();
    assert.equal(subscriptions.length, 3, "healthy minute checks must only repaint locally");
    time = BASE_TIME + MAX_SUMMARY_AGE_MS + 2000;
    intervals[0].callback();
    assert.match(current.children.at(-1).textContent, /last saved result/);
    publish(null);
    assert.equal(current.renderedRows[0].title, "Song updated");
    assert.doesNotMatch(current.html, /No songs recorded/);
    listeners.visibilitychange();
    assert.equal(subscriptions.length, 3);

    publish(summary({ asOf: timestamp(time), songs: [], nextExpiryAt: null }));
    assert.match(current.html, /No songs recorded this week yet/);

    current.isConnected = false;
    current = null;
    context.syncWeeklyTopFive();
    assert.equal(subscriptions[2].detachCount, 1, "successful navigation away must detach immediately");
    intervals[0].callback();
    assert.equal(subscriptions.length, 3);
    current = fakeTable(true);
    await context.loadSongs();
    assert.equal(subscriptions.length, 4);
    publish(summary({ asOf: timestamp(time) }));
    subscriptions[3].onError(new Error("temporary terminal failure"));
    intervals[0].callback();
    listeners.visibilitychange();
    assert.equal(subscriptions.length, 4, "a listener error must not trigger a retry loop");
    time += MIN_SUBSCRIPTION_RETRY_MS;
    intervals[0].callback();
    assert.equal(subscriptions.length, 5, "foreground weekly chart automatically recovers after the retry delay");
    publish(summary({ asOf: timestamp(time) }));
    assert.equal(current.children.length, 0);
});
