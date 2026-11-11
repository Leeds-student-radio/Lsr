import { adminContext, retryVerification } from "./admin.js";

const { values, service } = adminContext();
console.log(`Initialising the isolated weekly leaderboard in ${values.project}. Deploy its trigger first.`);
try {
  const seeded = await service.bootstrap({ onProgress: progress => console.log(`Reconciled ${progress.reconciled} source plays.`) });
  await service.runMaintenance({ allowUnverified: true });
  const verification = await retryVerification(() => service.verify({ certify: true }));
  const publication = await service.runMaintenance();
  if (publication.skipped) throw new Error("Verification passed, but publication was busy; retry after the active maintenance run");
  console.log(JSON.stringify({ seeded, verification, published: true }, null, 2));
} catch (error) {
  console.error(`Bootstrap did not complete: ${error.message}`);
  console.error("Do not enable the new frontend yet. Raw song_plays data has not been deleted or rewritten.");
  process.exitCode = 1;
}
