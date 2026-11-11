// Narrow orchestration of supported CLIs. REST requests here are READ-ONLY.
// No access token is logged/saved. No git push or frontend publication is performed.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { parseArgs } from "node:util";
import { applicationDefault } from "firebase-admin/app";

const PROJECT = "shazam-453c8";
const REGION = "europe-west1";
const CLI = "firebase-tools@15.35.0";
const directory = fileURLToPath(new URL("../../", import.meta.url));
const repo = path.dirname(directory);
const functionsDirectory = path.join(directory, "functions");
const { values, positionals } = parseArgs({ options: { project: { type: "string" } }, allowPositionals: true });
const phase = positionals[0];
const phases = ["check", "rules", "indexes", "functions", "bootstrap", "gate"];
if (!phases.includes(phase) || positionals.length !== 1 || values.project !== PROJECT) {
  throw new Error(`Usage: bash weekly-leaderboard/deploy.sh ${phases.join("|")} --project ${PROJECT}`);
}
const credential = applicationDefault();
const dbPath = `projects/${PROJECT}/databases/(default)`;
const indexBase = `${dbPath}/collectionGroups/_weeklyLeaderboardPlays/indexes`;
const expected = JSON.parse(await fs.readFile(path.join(directory, "firestore.indexes.fragment.json"), "utf8"));

function canonicalRules(source) {
  let output = "", state = "code", quote = "";
  for (let i = 0; i < source.length; i += 1) {
    const c = source[i], next = source[i + 1];
    if (state === "line") { if (c === "\n") state = "code"; continue; }
    if (state === "block") { if (c === "*" && next === "/") { state = "code"; i += 1; } continue; }
    if (state === "string") {
      output += c;
      if (c === "\\") output += source[++i] ?? "";
      else if (c === quote) state = "code";
      continue;
    }
    if (c === "/" && next === "/") { state = "line"; i += 1; }
    else if (c === "/" && next === "*") { state = "block"; i += 1; }
    else if (c === "'" || c === '"') { state = "string"; quote = c; output += c; }
    else if (!/\s/.test(c)) output += c;
  }
  return output;
}

function indexKey(index) {
  const fields = index.fields.map(field => ({ fieldPath: field.fieldPath, order: field.order }));
  if (fields.at(-1)?.fieldPath !== "__name__") fields.push({ fieldPath: "__name__", order: fields.at(-1).order });
  return JSON.stringify({ queryScope: index.queryScope, fields });
}

async function getJSON(host, resource, version = "v1") {
  const token = await credential.getAccessToken();
  const response = await fetch(`https://${host}/${version}/${resource}`, {
    headers: { Authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(30_000)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`${host}: ${data.error?.message ?? response.status}`);
  return data;
}

async function inspect() {
  const [database, release, listing] = await Promise.all([
    getJSON("firestore.googleapis.com", dbPath),
    getJSON("firebaserules.googleapis.com", `projects/${PROJECT}/releases/cloud.firestore`),
    getJSON("firestore.googleapis.com", indexBase)
  ]);
  if (database.locationId !== "eur3") throw new Error("Database location changed; review region before proceeding");
  if (!release.rulesetName?.startsWith(`projects/${PROJECT}/rulesets/`)) throw new Error("Unexpected ruleset reference");
  const ruleset = await getJSON("firebaserules.googleapis.com", release.rulesetName);
  const files = ruleset.source?.files ?? [];
  if (files.length !== 1) throw new Error("Live rules use an unexpected source layout; review manually");
  const [baseline, merged] = await Promise.all([
    fs.readFile(path.join(directory, "firestore.observed-baseline.rules"), "utf8"),
    fs.readFile(path.join(directory, "firestore.merged.rules"), "utf8")
  ]);
  const current = canonicalRules(files[0].content);
  const rules = current === canonicalRules(merged) ? "merged" : current === canonicalRules(baseline) ? "baseline" : "changed";
  const indexes = [...(listing.indexes ?? [])];
  let page = listing.nextPageToken;
  while (page) {
    const more = await getJSON("firestore.googleapis.com", `${indexBase}?pageToken=${encodeURIComponent(page)}`);
    indexes.push(...(more.indexes ?? [])); page = more.nextPageToken;
  }
  const required = expected.indexes.map(definition => ({
    definition, current: indexes.find(index => indexKey(index) === indexKey(definition)) ?? null
  }));
  await fs.mkdir(path.join(directory, ".deploy-state"), { recursive: true });
  const backup = path.join(directory, ".deploy-state", `before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await fs.writeFile(backup, JSON.stringify({ project: PROJECT, release, ruleset, indexes }, null, 2));
  if (rules === "changed") throw new Error(`Live rules differ from both reviewed versions. Stopped before changes; saved ${backup}`);
  return { rules, required, backup };
}

function run(command, args, cwd = repo) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit", shell: false });
    child.once("error", reject);
    child.once("close", code => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
  });
}

const firebase = args => run("npx", ["--yes", CLI, ...args, "--project", PROJECT, "--non-interactive"]);

function assertReviewedDeployment(functions) {
  const approved = new Set(["weeklyLeaderboardOnPlay", "weeklyLeaderboardRefresh"].map(
    name => `projects/${PROJECT}/locations/${REGION}/functions/${name}`));
  for (const fn of functions) {
    const codebase = fn.labels?.["firebase-functions-codebase"] ?? "default";
    if (codebase === "weekly-leaderboard" && !approved.has(fn.name)) {
      throw new Error(`Refusing --force: unrecognized function in this codebase: ${fn.name}`);
    }
    if (approved.has(fn.name) && (codebase !== "weekly-leaderboard" || fn.environment !== "GEN_2")) {
      throw new Error(`Refusing --force: reviewed function name belongs to a different codebase/generation: ${fn.name}`);
    }
  }
}

async function checkReviewedRetryDeployment() {
  const functions = [];
  for (const version of ["v1", "v2"]) {
    let page;
    do {
      const resource = `projects/${PROJECT}/locations/-/functions${page ? `?pageToken=${encodeURIComponent(page)}` : ""}`;
      const listing = await getJSON("cloudfunctions.googleapis.com", resource, version);
      if (listing.unreachable?.length || listing.unreachableLocations?.length) {
        throw new Error("Refusing --force: function inventory is incomplete in one or more regions");
      }
      functions.push(...(listing.functions ?? []).map(fn => ({
        ...fn, environment: fn.environment ?? (version === "v1" ? "GEN_1" : "GEN_2")
      })));
      page = listing.nextPageToken;
    } while (page);
  }
  assertReviewedDeployment(functions);
}

try {
  const report = await inspect();
  console.log(`Project ${PROJECT}, Firestore eur3, live rules: ${report.rules}. Backup: ${report.backup}`);
  console.log(`Composite indexes: ${report.required.map(item => item.current?.state ?? "MISSING").join(", ")}`);
  if (phase === "check") process.exit(0);
  if (phase === "rules") {
    if (report.rules === "merged") console.log("Reviewed merged rules are already deployed.");
    else await firebase(["deploy", "--config", path.join(directory, "firebase.rules.json"), "--only", "firestore:rules"]);
  } else if (phase === "indexes") {
    for (const { definition, current } of report.required) {
      if (current) continue; // Never delete or replace an existing composite index.
      if (definition.collectionGroup !== "_weeklyLeaderboardPlays") throw new Error("Unexpected collection in additive index plan");
      await run("gcloud", ["firestore", "indexes", "composite", "create", "--project", PROJECT,
        "--database=(default)", `--collection-group=${definition.collectionGroup}`, "--query-scope=collection", "--async",
        ...definition.fields.map(field => `--field-config=field-path=${field.fieldPath},order=${field.order.toLowerCase()}`)]);
    }
    console.log("Only missing composite indexes were created. Wait for READY, then rerun check.");
    console.log("Optional field exemptions are documented in firestore.indexes.fragment.json; existing field settings are not overwritten by this helper.");
  } else {
    if (report.rules !== "merged") throw new Error("Apply the reviewed rules phase first");
    if (report.required.some(item => item.current?.state !== "READY")) throw new Error("All four additive composite indexes must be READY first");
    if (phase === "bootstrap" || phase === "gate") {
      const deployed = await getJSON("cloudfunctions.googleapis.com", `projects/${PROJECT}/locations/${REGION}/functions`, "v2");
      for (const name of ["weeklyLeaderboardOnPlay", "weeklyLeaderboardRefresh"]) {
        if (!deployed.functions?.some(fn => fn.name.endsWith(`/functions/${name}`) && fn.state === "ACTIVE")) {
          throw new Error(`Deploy and activate ${name} before bootstrap or the frontend gate`);
        }
      }
    }
    if (phase === "functions") {
      const envPath = path.join(functionsDirectory, `.env.${PROJECT}`);
      try {
        if (!/^WEEKLY_LEADERBOARD_REGION=europe-west1\s*$/m.test(await fs.readFile(envPath, "utf8"))) {
          throw new Error("Function region environment differs from the confirmed plan");
        }
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        await fs.writeFile(envPath, `WEEKLY_LEADERBOARD_REGION=${REGION}\n`);
      }
      await run("npm", ["test"], functionsDirectory);
      // Firebase CLI requires --force to acknowledge retry:true in non-interactive
      // deployments. Refuse unknown functions first and target only these two IDs.
      await checkReviewedRetryDeployment();
      const selectors = ["weeklyLeaderboardOnPlay", "weeklyLeaderboardRefresh"]
        .map(name => `functions:weekly-leaderboard:${name}`).join(",");
      await firebase(["deploy", "--config", path.join(directory, "firebase.json"), "--only", selectors, "--force"]);
    } else if (phase === "bootstrap") {
      await run("node", ["scripts/bootstrap.js", "--project", PROJECT], functionsDirectory);
    } else if (phase === "gate") {
      await run("node", ["scripts/verify.js", "--project", PROJECT], functionsDirectory);
      const response = await fetch(`https://firestore.googleapis.com/v1/${dbPath}/documents/leaderboards/weeklyTopFive`, { signal: AbortSignal.timeout(30_000) });
      const document = await response.json();
      const asOf = Date.parse(document.fields?.asOf?.timestampValue ?? "");
      if (!response.ok || document.fields?.ready?.booleanValue !== true || !Number.isFinite(asOf) ||
          Date.now() - asOf > 120_000 || asOf > Date.now() + 5000) {
        throw new Error("Public summary is not ready/fresh yet; keep the old frontend until this gate passes");
      }
      console.log("Backend verification and public-read gate passed. The prepared frontend can now be reviewed and deployed through the site's existing GitHub Pages workflow.");
      console.log("No git commit, git push, or frontend publication has been performed by this helper.");
    }
  }
} catch (error) {
  console.error(`Stopped: ${error.message}`);
  console.error("If credentials are unavailable, use your normal Google sign-in / gcloud auth application-default login and Firebase CLI login. No credentials were copied or saved by this helper.");
  process.exitCode = 1;
}
