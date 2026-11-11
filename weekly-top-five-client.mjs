// Firebase-independent validation and state for the shared rolling-week chart.
// Raw song plays are deliberately never a fallback for this reader.
export const WEEKLY_TOP_FIVE_DOCUMENT = "leaderboards/weeklyTopFive";
export const WEEKLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_SUMMARY_AGE_MS = 2 * 60 * 1000;
export const MIN_SUBSCRIPTION_RETRY_MS = 60 * 1000;

export class WeeklySummaryError extends Error {
    constructor(code, message) {
        super(message);
        this.name = "WeeklySummaryError";
        this.code = code;
    }
}

function timestampMillis(value, field) {
    let milliseconds;
    if (value && typeof value.toMillis === "function") {
        milliseconds = value.toMillis();
    } else if (
        value && Number.isInteger(value.seconds) &&
        Number.isInteger(value.nanoseconds) &&
        value.nanoseconds >= 0 && value.nanoseconds < 1e9
    ) {
        milliseconds = value.seconds * 1000 + value.nanoseconds / 1e6;
    }
    if (!Number.isFinite(milliseconds) || milliseconds < 0) {
        throw new WeeklySummaryError("invalid", `Invalid weekly chart ${field}.`);
    }
    return milliseconds;
}

export function validateWeeklyTopFiveSummary(data) {
    if (data == null) {
        throw new WeeklySummaryError("missing", "The weekly chart has not been published yet.");
    }
    if (typeof data !== "object" || Array.isArray(data)) {
        throw new WeeklySummaryError("invalid", "Invalid weekly chart format.");
    }
    if (data.ready !== true) {
        throw new WeeklySummaryError("not-ready", "The weekly chart is being prepared.");
    }
    if (
        data.schemaVersion !== 1 || data.windowMs !== WEEKLY_WINDOW_MS ||
        !Array.isArray(data.songs) || data.songs.length > 5 ||
        !("nextExpiryAt" in data)
    ) {
        throw new WeeklySummaryError("invalid", "Invalid weekly chart format.");
    }

    const asOfMs = timestampMillis(data.asOf, "asOf");
    const nextExpiryMs = data.nextExpiryAt === null
        ? null : timestampMillis(data.nextExpiryAt, "nextExpiryAt");
    const nextChangeMs = data.nextChangeAt == null
        ? nextExpiryMs : timestampMillis(data.nextChangeAt, "nextChangeAt");
    const ids = new Set();
    const songs = data.songs.map(song => {
        if (
            !song || typeof song.songId !== "string" || !song.songId ||
            ids.has(song.songId) || !Number.isSafeInteger(song.count) || song.count < 1 ||
            [song.title, song.artist, song.image].some(value => value != null && typeof value !== "string")
        ) {
            throw new WeeklySummaryError("invalid", "Invalid weekly chart song.");
        }
        ids.add(song.songId);
        return Object.freeze({
            songId: song.songId,
            title: song.title || "Unknown Song",
            artist: song.artist || "Unknown Artist",
            image: song.image || "",
            count: song.count
        });
    });

    // Use the same tie-break as the previous in-browser weekly calculation.
    songs.sort((a, b) => b.count - a.count || a.songId.localeCompare(b.songId));
    return Object.freeze({ asOfMs, nextExpiryMs, nextChangeMs, songs: Object.freeze(songs) });
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[character]));
}

// These rows can be passed directly to the site's existing HTML renderer.
export function weeklyTopFiveRows(summary) {
    return summary.songs.map(song => ({
        title: escapeHtml(song.title),
        artist: escapeHtml(song.artist),
        image: /^https?:\/\//i.test(song.image) ? escapeHtml(song.image) : "",
        count: song.count
    }));
}

export function createWeeklyTopFiveClient({
    subscribeSummary,
    onUpdate = () => {},
    now = Date.now,
    maxAgeMs = MAX_SUMMARY_AGE_MS,
    minRetryMs = MIN_SUBSCRIPTION_RETRY_MS
}) {
    if (typeof subscribeSummary !== "function") {
        throw new TypeError("A weekly chart subscription adapter is required.");
    }

    let summary = null;
    let confirmedByServer = false;
    let issue = null;
    let active = false;
    let generation = 0;
    let unsubscribe = null;
    let retryAfter = 0;

    function getState() {
        const base = {
            rows: summary ? weeklyTopFiveRows(summary) : null,
            asOfMs: summary?.asOfMs ?? null,
            error: issue
        };
        if (!summary) {
            return {
                ...base,
                status: issue ? "unavailable" : "loading",
                message: issue
                    ? "The chart is updating. Please try again shortly."
                    : "Loading this week's chart…"
            };
        }
        if (issue) {
            return {
                ...base, status: "stale",
                message: "Live chart updates are unavailable. Showing the last saved result."
            };
        }
        if (!confirmedByServer) {
            return {
                ...base, status: "stale",
                message: "Showing the last saved chart. Reconnecting for updates…"
            };
        }

        const currentTime = now();
        const dueForChange = summary.nextChangeMs !== null && currentTime >= summary.nextChangeMs;
        const heartbeatLate = currentTime - summary.asOfMs > maxAgeMs;
        const clockUncertain = summary.asOfMs - currentTime > 30000;
        if (dueForChange || heartbeatLate || clockUncertain) {
            return {
                ...base, status: "stale",
                message: "The chart is updating. Showing the last saved result."
            };
        }
        return { ...base, status: "fresh", message: "" };
    }

    function start() {
        if (active || now() < retryAfter) return getState();
        active = true;
        confirmedByServer = false;
        issue = null;
        const subscriptionGeneration = ++generation;

        const fail = error => {
            if (subscriptionGeneration !== generation) return;
            issue = error instanceof Error ? error : new Error(String(error));
            confirmedByServer = false;
            active = false;
            retryAfter = now() + minRetryMs;
            generation += 1;
            const detach = unsubscribe;
            unsubscribe = null;
            if (detach) detach();
            onUpdate(getState());
        };

        try {
            const detach = subscribeSummary(({ data, fromCache = false }) => {
                if (subscriptionGeneration !== generation || !active) return;
                confirmedByServer = !fromCache;
                // An empty local cache does not prove that the server document is missing.
                if (fromCache && data == null) {
                    onUpdate(getState());
                    return;
                }
                try {
                    const next = validateWeeklyTopFiveSummary(data);
                    if (summary && next.asOfMs < summary.asOfMs) {
                        throw new WeeklySummaryError("regressed", "The weekly chart update is older than the displayed result.");
                    }
                    summary = next;
                    issue = null;
                    retryAfter = 0;
                } catch (error) {
                    issue = error;
                }
                onUpdate(getState());
            }, fail);

            if (active && subscriptionGeneration === generation) {
                unsubscribe = typeof detach === "function" ? detach : null;
            } else if (typeof detach === "function") {
                detach();
            }
        } catch (error) {
            fail(error);
        }
        return getState();
    }

    function stop() {
        generation += 1;
        active = false;
        confirmedByServer = false;
        const detach = unsubscribe;
        unsubscribe = null;
        if (detach) detach();
    }

    return { start, getState, stop };
}
