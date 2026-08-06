import { collectGameStats } from "../lib/api.js";
import { estimateEarnings } from "../lib/estimate.js";

for (const place of ["79268393072444", "920587237"]) {
  const stats = await collectGameStats(place);
  const estimates = estimateEarnings(stats, { previous: null });
  console.log("---", place, "universe", stats.universeId);
  console.log("visits", stats.visits, "playing", stats.playing, "passes onSale", stats.gamePasses.onSale, "/", stats.gamePasses.total);
  console.log("est total R$", Math.round(estimates.total.robux), "daily", Math.round(estimates.daily.robux), "monthly", Math.round(estimates.monthly.robux), "method", estimates.method);
}
