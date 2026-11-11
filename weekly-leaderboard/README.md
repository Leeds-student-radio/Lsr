# Exact-count rolling weekly leaderboard

This code replaces repeated public reads of the entire `song_plays` week with one small public document: `leaderboards/weeklyTopFive`. The original source records and their existing eight-day storage TTL are left intact. This is a separate Firebase Functions codebase named `weekly-leaderboard`; it does not replace the existing song identifier or `updateArtistPlays` function.

## Preserved behavior

- The same rolling **168-hour** window: `playedAt > asOf - 604800000` and `playedAt <= asOf`.
- Every qualifying play contributes once, grouped by the exact original `songId`.
- Counts descending, then the original JavaScript `songId.localeCompare` tie-break.
- Metadata comes from the latest qualifying play. Equal-time metadata follows the original query's timestamp/document-name order. The implementation preserves the browser SDK's fractional-millisecond timestamp behavior, which differs from the Admin SDK's `toMillis()` implementation.
- New plays, corrections, deletion, future-dated plays becoming eligible, and old plays leaving the window are handled. Expiry does not depend on another new play or on Firestore's delayed TTL deletion.

**Accuracy and freshness are distinct.** Each published result is an exact calculation over the processed source contributions for its declared `asOf`. Firestore triggers are asynchronous; a source write can briefly precede its processed contribution. The summary says `sourceConsistency: "eventual"` rather than pretending the asynchronous pipeline is a synchronous query of every newly committed source record. New play events request immediate maintenance; a minute schedule advances the window even when the stream is quiet. The website listens to the summary and marks old/expired results as stale instead of silently claiming they are current. Strict instantaneous agreement with every just-committed source write would require changing the original trusted writer or a request-time reconciliation protocol.

## Components

| Path | Purpose | Public access |
| --- | --- | --- |
| `song_plays/{playId}` | Existing authoritative play history | Existing access retained during migration |
| `_weeklyLeaderboardPlays/{playId}` | One active or future contribution per source play | None |
| `_weeklyLeaderboardSongs/{hash}` | Complete count and first/latest metadata per active song | None |
| `_weeklyLeaderboardControl/state` | Logical window, revision, maintenance lease and bounded rank cache | None |
| `leaderboards/weeklyTopFive` | Five songs, counts, timestamps and readiness | Exact-document read only |

Expired contributions and zero-count song counters are removed. No permanent per-event tombstones accumulate. The event handler always re-reads the current source document and contribution inside a transaction; it does not trust the event payload. Duplicate or out-of-order delivery therefore cannot add a second contribution or resurrect an expired play.

All counter changes also update the control document. The publisher reads that same control document transactionally, so it cannot publish a mixture of counters before and after a concurrent update. Maintenance has a bounded lease and finite work/time limits; an interrupted run leaves the last published result in place and resumes on a later run. A missing counter or unsupported source value blocks certification rather than fabricating counts.

### Why the small rank cache exists

The original locale-based ID ordering differs from Firestore's raw string ordering. An indexed top-five count query alone cannot resolve every tied fifth place correctly. The control document keeps 20 candidates and a conservative bound on the best omitted candidate. It publishes from that cache only when the fifth candidate provably outranks the entire omitted set. Otherwise, it refreshes candidates with an indexed count query and reads the complete tie group at the boundary. This preserves exact ordering while avoiding a repeated full tie-group scan on every minute heartbeat. The cache remains bounded at 20 rows and never replaces the complete per-song counters.

## Deployment sequence

Run these operations with an account authorized for `shazam-453c8`. No credentials or service-account keys are embedded in this repository.

### Phased helper for an authenticated terminal

The narrow helper uses supported Firebase/gcloud CLI commands for mutations and read-only API calls for preflight checks. It requires Node 22+, `gcloud`, normal Application Default Credentials, and Firebase deployment access. It installs the locked local dependencies when needed and uses Firebase CLI 15.35.0 via `npx`. It backs up observed rules/index metadata in a git-ignored `.deploy-state` folder. It refuses rules that differ from both the observed baseline and the prepared merge. The index phase only creates missing composite indexes; it never deletes existing indexes or overwrites field exemptions.

Run each phase from the repository root, checking the output before proceeding:

```sh
bash weekly-leaderboard/deploy.sh check --project shazam-453c8
bash weekly-leaderboard/deploy.sh rules --project shazam-453c8
bash weekly-leaderboard/deploy.sh indexes --project shazam-453c8
```

Wait for the four indexes to report `READY` when running `check`, then:

```sh
bash weekly-leaderboard/deploy.sh functions --project shazam-453c8
bash weekly-leaderboard/deploy.sh bootstrap --project shazam-453c8
bash weekly-leaderboard/deploy.sh gate --project shazam-453c8
```

The `functions` phase targets only the two reviewed function IDs inside the isolated codebase. Firebase CLI requires `--force` to acknowledge the intentionally enabled retry policy in non-interactive deployments. Before using it, the helper inventories both function generations across all regions and refuses an incomplete inventory, an unrecognized function in this codebase, or a reviewed name owned by a different codebase/generation. The `bootstrap` and `gate` phases require both new functions to be active. `gate` independently verifies source/counts and a fresh, publicly readable summary. **No phase commits, pushes, or publishes the website.** Deploy the prepared frontend through the existing GitHub Pages process only after the gate passes. The detailed manual sequence below remains available for inspection or use without the helper.

1. **Review the live rules and index configuration.** The initial live rules used a broad read/write allow. Deny fragments cannot override an overlapping allow: remove the four new top-level collections from that broad rule, then grant only `get` on the public summary. Preserve the existing authorized logger and unrelated site collections. `firestore.rules.fragment.txt` is documentation, not a full replacement ruleset. Root-level migration files, if present, contain the separately reviewed merged rules.
2. **Add the new indexes**, merging `firestore.indexes.fragment.json` into the live index configuration. Do not replace or delete existing indexes. Wait for the four composite indexes to become ready. The rank-cache and metadata exemptions reduce unnecessary index size. `firebase.json` intentionally has no Firestore deployment section, so a functions deployment cannot overwrite project rules/indexes.
3. **Install and test the functions.** In `weekly-leaderboard/functions`, run `npm ci` and `npm test`. Node 22 is the deployment runtime. Copy `.env.example` to `.env.shazam-453c8`; the confirmed database location is `eur3`, with new functions deployed in `europe-west1`.
4. **Deploy only the reviewed functions before backfilling:** use the guarded `functions` helper phase above. For a manual interactive deployment, run `firebase deploy --project shazam-453c8 --config weekly-leaderboard/firebase.json --only functions:weekly-leaderboard:weeklyLeaderboardOnPlay,functions:weekly-leaderboard:weeklyLeaderboardRefresh`. Inspect the proposed operations: they should create/update only these two functions, and the retry-policy prompt is expected. Use `--force` in non-interactive mode only after the same inventory checks. The unique codebase and explicit function selectors exclude the existing `updateArtistPlays` function.
5. **Bootstrap and certify once**, using Application Default Credentials for the Admin SDK. Firebase CLI login and Admin SDK credentials are separate; use an authenticated Cloud Shell or configure ADC through the normal Google sign-in flow. Run `npm --prefix weekly-leaderboard/functions run bootstrap -- --project shazam-453c8` from the repository root. The script scans the source once, reconciles current records, advances the window, and verifies one transaction snapshot of raw plays, every contribution, every count and all metadata before setting the summary ready. It is safe to repeat an interrupted bootstrap. Keep the existing frontend live until this succeeds.
6. **Deploy the matching frontend** only after `leaderboards/weeklyTopFive.ready` is true and the verification command succeeds. It must read/listen to the single summary document and never fall back to scanning `song_plays`. The separate frontend change in this repository handles stale data explicitly.
7. **Check actual daily usage after the change.** A one-off audit is available with `npm --prefix weekly-leaderboard/functions run verify -- --project shazam-453c8`. This audit intentionally reads the raw week; do not run it on a frequent schedule. A corrected integrity error can be re-certified with the same command plus `--certify`, which keeps the summary unavailable until full comparison passes.

### Public summary schema

```js
{
  schemaVersion: 1,
  windowMs: 604800000,
  ready: true,
  status: "ready",
  asOf: Timestamp,          // exact logical end of the represented window
  generatedAt: Timestamp,  // publication time; not a substitute for asOf
  nextExpiryAt: Timestamp | null,
  nextChangeAt: Timestamp | null, // earlier of expiry and future-play activation
  revision: 123,
  sourceConsistency: "eventual",
  songs: [{ songId, title, artist, image, count }] // zero through five rows
}
```

## Verification

`npm test` runs 14 pure model tests without credentials or network. They include 20,000 adversarial/random rank-cache updates, 1,000 source changes/deletions/window advances compared with full recomputation, exact cutoff cases, metadata ties, duplicate reconciliation and corruption handling.

The actual Firestore transaction integration suite requires a **local emulator** and uses the fixed project `demo-lsr-weekly`. It refuses a non-local emulator address. From the repository root:

```sh
firebase emulators:exec --project demo-lsr-weekly --config weekly-leaderboard/firebase.emulator.json --only firestore 'npm --prefix weekly-leaderboard/functions run test:integration'
```

Its 13 integration tests exercise duplicate/concurrent delivery, corrections, source deletion, future activation, expiry without new writes, live bootstrap races, verification refusal during trigger lag, concurrent maintenance, sub-millisecond timestamps and recovery from a blocked integrity check. All 13 passed against the emulator, including a one-microsecond boundary regression. The emulator config and rules are separate and must never be deployed to production. Emulator testing does not prove production composite indexes exist; their ready status must be checked separately.

An independent comparison against a saved REST snapshot is available without credentials:

```sh
npm --prefix weekly-leaderboard/functions run fixture -- --file /absolute/path/live-plays.json
```

The snapshot uses `{ "cutoff": "ISO as-of time", "documents": [Firestore REST documents] }`. The script reproduces the original browser loop independently and compares all five rows against the new model/cache. The inspected installation snapshot contained 802 plays and 668 distinct songs; its exact top five, counts and metadata matched.

## Cost behavior and limits

The expensive frontend operation changes from about one read per eligible play **for every refresh** to one document per initial subscription and one document per summary update. At the inspected 802-play week, that is 802 reads versus one for an initial load. The new document changes on minute heartbeats and event-driven publications, so a live listener still incurs update reads. Hidden-tab listener cleanup and avoiding duplicate subscriptions remain useful.

An idle minute maintenance run is about six document reads and three writes: claim the control lease; check due expiry and activation queries; read control and the next expiry/activation; publish summary/control. Empty queries still cost a read. Around 1,440 scheduled runs/day therefore produce roughly 8,640 backend reads and 4,320 writes before plays, retries and occasional cache refills. The actual source rate was about 115 plays/day. Normal creation, activation, expiry and later raw TTL deletion add a few thousand reads/day, generally leaving considerable room within the eligible Standard Firestore free allowances of 50,000 reads and 20,000 writes/day. Transaction retries, extra index reads for multi-order queries and corrections add work, so these are estimates, not billing guarantees.

For forecasting, add frontend initial connections plus every summary update delivered to each connected visible viewer. One-minute heartbeats are approximately one read per connected viewer-minute; new-play publications and reconnects add reads. Also include the pre-existing function, source logger, storage, indexes, network egress and any other project services. Function minimum instances are zero. Scheduler/Functions/Artifact Registry costs must be included if their relevant free allowances are already used elsewhere.

The project's £2 alerts-only budget does **not** cap Firestore charges. This architecture can plausibly keep normal student-radio traffic within the free tier, but unrestricted public traffic cannot be given a mathematical £2 ceiling while guaranteeing continuous service. Firebase's newer spend-cap support for certain other products does not make Firestore itself a capped service.

## Primary references

- [Firestore pricing and listener billing](https://cloud.google.com/firestore/pricing)
- [Write-time aggregation](https://firebase.google.com/docs/firestore/solutions/aggregation)
- [Firestore event delivery and ordering](https://firebase.google.com/docs/functions/firestore-events)
- [Firestore transaction isolation](https://firebase.google.com/docs/firestore/transaction-data-contention)
- [TTL deletion timing](https://firebase.google.com/docs/firestore/ttl)
- [Multiple independent Functions codebases](https://firebase.google.com/docs/functions/organize-functions)
- [Budget alerts and supported spend caps](https://firebase.google.com/docs/projects/billing/budget-alerts)

## Rollback and operational recovery

Do not delete `song_plays`, disable the original logger, disable all project billing, or deploy an incomplete replacement ruleset as part of this migration. If the new backend fails, retain the last result with its stale indicator while repairing it; re-enabling the old full-week polling path restores its high-read behavior. The frontend can be rolled back independently. Stop only this codebase's new schedule/functions if a measured fault requires it, after checking that the site will clearly show the last known result. Internal counters can be rebuilt from the retained source with an explicitly reviewed recovery; the normal bootstrap does not silently erase existing state.
