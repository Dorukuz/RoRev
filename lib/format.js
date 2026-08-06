/** Compact number formatting for Robux, USD, and counts. */

export function compactNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(2)}K`;
  if (abs >= 100) return `${sign}${Math.round(abs)}`;
  if (abs >= 10) return `${sign}${abs.toFixed(1)}`;
  if (abs >= 1) return `${sign}${abs.toFixed(2)}`;
  return `${sign}${abs.toFixed(3)}`;
}

export function formatRobux(value) {
  if (!Number.isFinite(Number(value))) return "R$ —";
  return `R$ ${compactNumber(value)}`;
}

export function formatUsd(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "$ —";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(2)}K`;
  if (abs >= 100) return `${sign}$${Math.round(abs)}`;
  if (abs >= 1) return `${sign}$${abs.toFixed(2)}`;
  return `${sign}$${abs.toFixed(3)}`;
}

export function formatPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

export function formatAgeDays(days) {
  const n = Number(days);
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1) return "<1 day";
  if (n < 30) return `${Math.round(n)} days`;
  if (n < 365) return `${(n / 30).toFixed(1)} mo`;
  return `${(n / 365).toFixed(1)} yr`;
}
