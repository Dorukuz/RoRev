/** Roblox public API helpers. */

const CACHE_TTL_MS = 5 * 60 * 1000;
const memoryCache = new Map();

async function fetchJson(url, { cacheKey, ttl = CACHE_TTL_MS } = {}) {
  const key = cacheKey || url;
  const hit = memoryCache.get(key);
  if (hit && Date.now() - hit.at < ttl) {
    return hit.data;
  }

  const res = await fetch(url, {
    credentials: "omit",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} for ${url}${body ? `: ${body.slice(0, 160)}` : ""}`);
  }

  const data = await res.json();
  memoryCache.set(key, { at: Date.now(), data });
  return data;
}

export function parsePlaceId(urlOrPath) {
  const m = String(urlOrPath).match(/\/games\/(\d+)/);
  return m ? m[1] : null;
}

export async function getUniverseId(placeId) {
  const data = await fetchJson(
    `https://apis.roblox.com/universes/v1/places/${placeId}/universe`,
    { cacheKey: `universe:${placeId}` }
  );
  if (!data?.universeId) {
    throw new Error("Universe ID not found for this place");
  }
  return data.universeId;
}

export async function getGameDetails(universeId) {
  const data = await fetchJson(
    `https://games.roblox.com/v1/games?universeIds=${universeId}`,
    { cacheKey: `game:${universeId}` }
  );
  const game = data?.data?.[0];
  if (!game) throw new Error("Game details not found");
  return game;
}

export async function getVotes(universeId) {
  const data = await fetchJson(
    `https://games.roblox.com/v1/games/votes?universeIds=${universeId}`,
    { cacheKey: `votes:${universeId}` }
  );
  const votes = data?.data?.[0];
  return {
    upVotes: votes?.upVotes ?? 0,
    downVotes: votes?.downVotes ?? 0,
  };
}

export async function getFavoritesCount(universeId) {
  try {
    const data = await fetchJson(
      `https://games.roblox.com/v1/games/${universeId}/favorites/count`,
      { cacheKey: `favorites:${universeId}` }
    );
    return data?.favoritesCount ?? null;
  } catch {
    return null;
  }
}

function extractPassPrice(pass) {
  if (pass?.priceInformation?.defaultPriceInRobux != null) {
    return Number(pass.priceInformation.defaultPriceInRobux);
  }
  if (pass?.price != null && pass.price !== "") return Number(pass.price);
  if (pass?.priceInRobux != null) return Number(pass.priceInRobux);
  if (pass?.userBasePriceInRobux != null) return Number(pass.userBasePriceInRobux);
  return null;
}

export async function getGamePasses(universeId, { maxPages = 10 } = {}) {
  const passes = [];
  let pageToken = "";

  for (let page = 0; page < maxPages; page += 1) {
    const params = new URLSearchParams({
      passView: "Full",
      pageSize: "100",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const data = await fetchJson(
      `https://apis.roblox.com/game-passes/v1/universes/${universeId}/game-passes?${params}`,
      { cacheKey: `passes:${universeId}:${pageToken || "start"}`, ttl: CACHE_TTL_MS }
    );

    const batch = data?.gamePasses || data?.data || [];
    for (const pass of batch) {
      const price = extractPassPrice(pass);
      const priced = price != null && Number.isFinite(price) && price > 0;
      const isOnSale = pass?.isForSale === true || (pass?.isForSale == null && priced);
      passes.push({
        id: pass.gamePassId ?? pass.id,
        name: pass.displayName || pass.name || "Game Pass",
        price: priced ? price : null,
        onSale: Boolean(isOnSale && priced),
      });
    }

    pageToken = data?.nextPageToken || "";
    if (!pageToken || batch.length === 0) break;
  }

  return passes;
}

export async function collectGameStats(placeId) {
  const universeId = await getUniverseId(placeId);
  const [game, votes, favoritesBackup, gamePasses] = await Promise.all([
    getGameDetails(universeId),
    getVotes(universeId),
    getFavoritesCount(universeId),
    getGamePasses(universeId),
  ]);

  const favorites =
    favoritesBackup ??
    game.favoritedCount ??
    game.favoritesCount ??
    0;

  const createdAt = game.created ? new Date(game.created) : null;
  const ageDays = createdAt
    ? Math.max((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24), 0)
    : null;

  const totalVotes = votes.upVotes + votes.downVotes;
  const likeRatio = totalVotes > 0 ? (votes.upVotes / totalVotes) * 100 : null;

  const onSalePasses = gamePasses.filter((p) => p.onSale);
  const catalogSum = onSalePasses.reduce((sum, p) => sum + p.price, 0);
  const avgPassPrice =
    onSalePasses.length > 0 ? catalogSum / onSalePasses.length : 0;

  const topPasses = [...onSalePasses]
    .sort((a, b) => b.price - a.price)
    .slice(0, 8);

  return {
    placeId: String(placeId),
    universeId,
    name: game.name || "Unknown experience",
    description: game.description || "",
    visits: game.visits ?? 0,
    playing: game.playing ?? 0,
    favorites,
    maxPlayers: game.maxPlayers ?? null,
    genre: game.genre || game.genre_l1 || "Unknown",
    creatorName: game.creator?.name || "Unknown",
    creatorType: game.creator?.type || null,
    creatorId: game.creator?.id || null,
    created: game.created || null,
    updated: game.updated || null,
    ageDays,
    upVotes: votes.upVotes,
    downVotes: votes.downVotes,
    likeRatio,
    favoritesPerVisit: game.visits > 0 ? favorites / game.visits : 0,
    gamePasses: {
      total: gamePasses.length,
      onSale: onSalePasses.length,
      catalogSum,
      avgPrice: avgPassPrice,
      top: topPasses,
      all: gamePasses,
    },
  };
}
