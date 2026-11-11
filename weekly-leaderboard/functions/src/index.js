import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { defineString } from "firebase-functions/params";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { makeService } from "./service.js";
import { IntegrityError } from "./model.js";

initializeApp();
const service = makeService(getFirestore());
// Deployment must choose the function region after checking the database location.
const region = defineString("WEEKLY_LEADERBOARD_REGION", {
  description: "Cloud Functions region nearest this project's Firestore database (for example europe-west2)."
});

export const weeklyLeaderboardOnPlay = onDocumentWritten({
  document: "song_plays/{playId}", region,
  retry: true, minInstances: 0, maxInstances: 2,
  concurrency: 1, timeoutSeconds: 300, memory: "256MiB"
}, async event => {
  try {
    const result = await service.reconcile(event.params.playId);
    // A new play can publish immediately; the minute schedule also handles expiry
    // when no song is played. The lease serialises overlapping maintenance runs.
    if (result.changed) await service.runMaintenance();
  } catch (error) {
    if (error instanceof IntegrityError) await service.recordIntegrityFailure(error);
    logger.error("Weekly leaderboard reconciliation failed", { playId: event.params.playId, error: error.message });
    throw error;
  }
});

export const weeklyLeaderboardRefresh = onSchedule({
  schedule: "every 1 minutes", timeZone: "UTC", region,
  minInstances: 0, maxInstances: 1, concurrency: 1,
  timeoutSeconds: 300, memory: "256MiB", retryCount: 3
}, async () => {
  await service.runMaintenance();
});
