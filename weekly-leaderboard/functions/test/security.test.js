import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const host = process.env.FIRESTORE_EMULATOR_HOST ?? '';
if (!/^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(host)) {
  throw new Error('Security tests require a LOCAL Firestore emulator. Production is forbidden.');
}
const project = 'demo-lsr-weekly-security';
const app = initializeApp({ projectId: project }, 'weekly-security-tests');
const db = getFirestore(app);
const base = `http://${host}/v1/projects/${project}/databases/(default)/documents`;

async function client(path, method = 'GET') {
  return fetch(`${base}/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(method === 'PATCH' ? { body: JSON.stringify({ fields: { count: { integerValue: '999' } } }) } : {})
  });
}

before(async () => {
  for (const path of [
    'song_plays/legacy', 'detected_songs/legacy', 'artists/legacy',
    'leaderboards/weeklyTopFive', 'leaderboards/other',
    '_weeklyLeaderboardControl/state', '_weeklyLeaderboardSongs/song',
    '_weeklyLeaderboardPlays/play', '_weeklyLeaderboardSongs/song/nested/hidden'
  ]) await db.doc(path).set({ count: 1 });
});
after(async () => { await db.terminate(); await deleteApp(app); });

test('public visitors can read the exact weekly summary, but cannot list or change it', async () => {
  assert.equal((await client('leaderboards/weeklyTopFive')).status, 200);
  assert.equal((await client('leaderboards')).status, 403);
  assert.equal((await client('leaderboards/weeklyTopFive', 'PATCH')).status, 403);
  assert.equal((await client('leaderboards/weeklyTopFive', 'DELETE')).status, 403);
  assert.equal((await db.doc('leaderboards/weeklyTopFive').get()).data().count, 1);
});

test('all internal state and other leaderboard paths are private despite the legacy wildcard', async () => {
  for (const path of [
    '_weeklyLeaderboardControl/state', '_weeklyLeaderboardSongs/song',
    '_weeklyLeaderboardPlays/play', '_weeklyLeaderboardSongs/song/nested/hidden',
    'leaderboards/other', 'leaderboards/weeklyTopFive/nested/hidden'
  ]) {
    assert.equal((await client(path)).status, 403, `${path}: read denied`);
    assert.equal((await client(path, 'PATCH')).status, 403, `${path}: write denied`);
  }
});

test('existing song logging and all-time charts retain their previous access', async () => {
  for (const path of ['song_plays/legacy', 'detected_songs/legacy', 'artists/legacy']) {
    assert.equal((await client(path)).status, 200, `${path}: old read access`);
    assert.equal((await client(path, 'PATCH')).status, 200, `${path}: old writer access`);
  }
  assert.equal((await client('song_plays')).status, 200);
});
