import { parseArgs } from "node:util";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { makeService } from "../src/service.js";

export function adminContext(options = {}) {
  const { values } = parseArgs({
    options: { project: { type: "string" }, certify: { type: "boolean", default: false }, ...options },
    strict: true
  });
  if (!values.project) throw new Error("Provide --project explicitly; for this site use --project shazam-453c8");
  const app = initializeApp({
    projectId: values.project,
    ...(!process.env.FIRESTORE_EMULATOR_HOST ? { credential: applicationDefault() } : {})
  });
  const db = getFirestore(app);
  return { values, db, service: makeService(db) };
}

export async function retryVerification(action, tries = 6) {
  let lastError;
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    try { return await action(); }
    catch (error) {
      lastError = error;
      if (attempt === tries) break;
      console.log(`Verification attempt ${attempt} has not matched yet; waiting for live triggers.`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  throw lastError;
}
