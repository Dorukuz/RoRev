import { collectGameStats } from "../lib/api.js";
import { estimateEarnings } from "../lib/estimate.js";

const SNAPSHOT_KEY = "rorev_snapshots";
const MAX_SNAPSHOTS = 200;
const MIN_GAP_MS = 60 * 60 * 1000;

async function loadSnapshots() {
  const data = await chrome.storage.local.get(SNAPSHOT_KEY);
  return data[SNAPSHOT_KEY] || {};
}

function pickPreviousForEstimate(stored) {
  if (!stored) return null;
  const now = Date.now();
  if (stored.prior && now - stored.prior.ts >= MIN_GAP_MS) {
    return stored.prior;
  }
  if (now - stored.ts >= MIN_GAP_MS) {
    return { visits: stored.visits, playing: stored.playing, ts: stored.ts };
  }
  return null;
}

async function saveSnapshot(universeId, { visits, playing }) {
  const snapshots = await loadSnapshots();
  const prev = snapshots[universeId] || null;
  const now = Date.now();

  let prior = prev?.prior || null;
  if (prev && now - prev.ts >= MIN_GAP_MS) {
    prior = { visits: prev.visits, playing: prev.playing, ts: prev.ts };
  }

  snapshots[universeId] = { visits, playing, ts: now, prior };

  const keys = Object.keys(snapshots);
  if (keys.length > MAX_SNAPSHOTS) {
    keys
      .sort((a, b) => (snapshots[a].ts || 0) - (snapshots[b].ts || 0))
      .slice(0, keys.length - MAX_SNAPSHOTS)
      .forEach((k) => {
        delete snapshots[k];
      });
  }

  await chrome.storage.local.set({ [SNAPSHOT_KEY]: snapshots });
}

async function getGameStatsPayload(placeId) {
  const stats = await collectGameStats(placeId);
  const snapshots = await loadSnapshots();
  const stored = snapshots[stats.universeId] || null;
  const previous = pickPreviousForEstimate(stored);
  const estimates = estimateEarnings(stats, { previous });

  await saveSnapshot(stats.universeId, {
    visits: stats.visits,
    playing: stats.playing,
  });

  return {
    ok: true,
    fetchedAt: Date.now(),
    stats,
    estimates,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "GET_GAME_STATS") return false;

  const placeId = String(message.placeId || "");
  if (!/^\d+$/.test(placeId)) {
    sendResponse({ ok: false, error: "Invalid place ID" });
    return false;
  }

  getGameStatsPayload(placeId)
    .then((payload) => sendResponse(payload))
    .catch((err) => {
      sendResponse({
        ok: false,
        error: err?.message || "Failed to load game stats",
      });
    });

  return true;
});
