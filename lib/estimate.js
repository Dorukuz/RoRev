/** Heuristic Robux-per-visit revenue estimator. */

export const DEVEX_RATE = 0.0035;
export const CREATOR_SHARE = 0.7;
const BASE_RPV = 0.35;
const MIN_RPV = 0.05;
const MAX_RPV = 4.5;
const SNAPSHOT_MIN_GAP_MS = 60 * 60 * 1000;

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Monetization intensity from public catalog + engagement signals.
 * Returns a multiplier roughly in [0.4, 3.5].
 */
export function monetizationIntensity(stats) {
  const onSale = stats.gamePasses?.onSale ?? 0;
  const avgPrice = stats.gamePasses?.avgPrice ?? 0;
  const catalogSum = stats.gamePasses?.catalogSum ?? 0;
  const favRatio = stats.favoritesPerVisit ?? 0;

  let intensity = 1;

  // More on-sale passes → more monetization surface
  intensity += Math.min(onSale / 12, 1.2);

  // Higher average prices → stronger paid intent
  intensity += clamp(avgPrice / 400, 0, 0.9);

  // Large catalog sum → premium offerings
  intensity += clamp(Math.log10(catalogSum + 1) / 6, 0, 0.8);

  // Favorites/visits as engagement proxy (typical games ~0.001–0.05)
  intensity += clamp(favRatio * 40, 0, 0.6);

  // Soft penalty when no gamepasses at all
  if (onSale === 0) intensity *= 0.45;

  return clamp(intensity, 0.4, 3.5);
}

export function estimateRpv(stats) {
  const intensity = monetizationIntensity(stats);
  const rpv = clamp(BASE_RPV * intensity, MIN_RPV, MAX_RPV);
  return { rpv, intensity };
}

function robuxToUsd(robux) {
  return robux * DEVEX_RATE;
}

/**
 * @param {object} stats
 * @param {{ previous?: { visits: number, playing: number, ts: number } | null }} options
 */
export function estimateEarnings(stats, { previous = null } = {}) {
  const { rpv, intensity } = estimateRpv(stats);
  const visits = Number(stats.visits) || 0;
  const ageDays = Number(stats.ageDays);
  const safeAgeDays = Number.isFinite(ageDays) && ageDays > 0 ? ageDays : null;

  const totalRobux = visits * rpv * CREATOR_SHARE;

  let dailyVisits;
  let method;
  let methodDetail;

  const now = Date.now();
  if (
    previous &&
    Number.isFinite(previous.visits) &&
    Number.isFinite(previous.ts) &&
    now - previous.ts >= SNAPSHOT_MIN_GAP_MS &&
    visits >= previous.visits
  ) {
    const deltaDays = (now - previous.ts) / (1000 * 60 * 60 * 24);
    dailyVisits = (visits - previous.visits) / Math.max(deltaDays, 1 / 24);
    method = "snapshot";
    methodDetail = `from local snapshot (${deltaDays.toFixed(2)}d Δ)`;
  } else if (safeAgeDays != null) {
    dailyVisits = visits / safeAgeDays;
    method = "fallback";
    methodDetail = "fallback (lifetime avg)";
  } else {
    dailyVisits = 0;
    method = "fallback";
    methodDetail = "fallback (no age data)";
  }

  const dailyRobux = dailyVisits * rpv * CREATOR_SHARE;
  const monthlyRobux = dailyRobux * 30;

  return {
    rpv,
    intensity,
    creatorShare: CREATOR_SHARE,
    devexRate: DEVEX_RATE,
    method,
    methodDetail,
    dailyVisits,
    total: {
      robux: totalRobux,
      usd: robuxToUsd(totalRobux),
    },
    daily: {
      robux: dailyRobux,
      usd: robuxToUsd(dailyRobux),
    },
    monthly: {
      robux: monthlyRobux,
      usd: robuxToUsd(monthlyRobux),
    },
  };
}

export { SNAPSHOT_MIN_GAP_MS };
