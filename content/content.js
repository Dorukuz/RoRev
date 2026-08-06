(() => {
  const ROOT_ID = "rorev-root";
  const HIDDEN_KEY = "rorev_panel_hidden";
  const EXPANDED_KEY = "rorev_panel_expanded";

  function compactNumber(value) {
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

  function formatRobux(value) {
    if (!Number.isFinite(Number(value))) return "R$ —";
    return `R$ ${compactNumber(value)}`;
  }

  function formatUsd(value) {
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

  function formatPercent(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return `${n.toFixed(1)}%`;
  }

  function formatAgeDays(days) {
    const n = Number(days);
    if (!Number.isFinite(n) || n < 0) return "—";
    if (n < 1) return "<1 day";
    if (n < 30) return `${Math.round(n)} days`;
    if (n < 365) return `${(n / 30).toFixed(1)} mo`;
    return `${(n / 365).toFixed(1)} yr`;
  }

  function parsePlaceId(href = location.href) {
    const m = String(href).match(/\/games\/(\d+)/);
    return m ? m[1] : null;
  }

  function esc(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  const ROW_CLASS = "rorev-layout-row";
  const MAIN_CLASS = "rorev-layout-main";

  /** Undo any previous wrap that squished the game box. */
  function unwrapLegacyLayout() {
    document.querySelectorAll(`.${ROW_CLASS}`).forEach((row) => {
      const parent = row.parentNode;
      if (!parent) return;
      const main = row.querySelector(`.${MAIN_CLASS}`);
      const kids = main ? Array.from(main.childNodes) : [];
      kids.forEach((child) => parent.insertBefore(child, row));
      // Move sidebar out before removing row
      const side = row.querySelector(`#${ROOT_ID}`);
      if (side) document.body.appendChild(side);
      row.remove();
    });
  }

  /**
   * Fixed far-right panel — does not touch Roblox game DOM at all.
   */
  function ensureRoot() {
    unwrapLegacyLayout();

    let root = document.getElementById(ROOT_ID);
    if (root?.isConnected && root.parentElement === document.body) {
      root.classList.add("rorev-sidebar");
      return root;
    }

    if (root) root.remove();

    root = document.createElement("aside");
    root.id = ROOT_ID;
    root.className = "rorev-sidebar";
    root.setAttribute("aria-label", "RoRev estimated earnings");
    document.body.appendChild(root);
    return root;
  }

  function remountIfDetached() {
    return ensureRoot();
  }

  async function getExpanded() {
    const data = await chrome.storage.local.get(EXPANDED_KEY);
    return Boolean(data[EXPANDED_KEY]);
  }

  async function setExpanded(expanded) {
    await chrome.storage.local.set({ [EXPANDED_KEY]: Boolean(expanded) });
  }

  function applyExpanded(root, expanded) {
    root.classList.toggle("rorev-collapsed", !expanded);
    const btn = root.querySelector("[data-rorev-collapse]");
    if (btn) btn.textContent = expanded ? "Less" : "More";
  }

  function headerChrome(title) {
    return `
      <div class="rorev-header">
        <div class="rorev-brand">
          <p class="rorev-eyebrow">Estimated earnings</p>
          <h2 class="rorev-title">${title}</h2>
        </div>
        <div class="rorev-header-actions">
          <button type="button" class="rorev-text-btn" data-rorev-collapse>More</button>
          <button type="button" class="rorev-text-btn" data-rorev-hide>Hide</button>
        </div>
      </div>
    `;
  }

  function earnRow(label, robux, usd, primary = false) {
    return `
      <div class="rorev-earn-card${primary ? " primary" : ""}">
        <p class="rorev-earn-label">${label}</p>
        <div class="rorev-earn-main">
          <p class="rorev-earn-value">${formatRobux(robux)}</p>
          <p class="rorev-earn-sub">${formatUsd(usd)}</p>
        </div>
      </div>
    `;
  }

  function renderHiddenChip(root) {
    root.classList.add("rorev-collapsed");
    root.innerHTML = `
      <button type="button" class="rorev-show-link" data-rorev-show>
        Show estimated earnings
      </button>
    `;
    root.querySelector("[data-rorev-show]").addEventListener("click", async () => {
      await chrome.storage.local.set({ [HIDDEN_KEY]: false });
      loadAndRender();
    });
  }

  async function renderLoading(root, placeId) {
    const expanded = await getExpanded();
    root.innerHTML = `
      <div class="rorev-section">
        ${headerChrome("Loading…")}
        <div class="rorev-body">
          <div class="rorev-status">Loading stats…</div>
        </div>
      </div>
    `;
    applyExpanded(root, expanded);
    wireChrome(root);
  }

  async function renderError(root, message, placeId) {
    const expanded = await getExpanded();
    root.innerHTML = `
      <div class="rorev-section">
        ${headerChrome("Unavailable")}
        <div class="rorev-body">
          <div class="rorev-status error">${esc(message)}</div>
          <div class="rorev-actions">
            <button type="button" class="rorev-text-btn" data-rorev-refresh>Retry</button>
          </div>
        </div>
      </div>
    `;
    applyExpanded(root, expanded);
    wireChrome(root);
  }

  async function renderStats(root, payload) {
    const { stats, estimates, fetchedAt } = payload;
    const gp = stats.gamePasses || {};
    const expanded = await getExpanded();
    const topPasses = (gp.top || [])
      .map(
        (p) => `
        <li class="rorev-pass">
          <span class="rorev-pass-name" title="${esc(p.name)}">${esc(p.name)}</span>
          <span class="rorev-pass-price">${formatRobux(p.price)}</span>
        </li>`
      )
      .join("");

    root.innerHTML = `
      <div class="rorev-section">
        ${headerChrome("Earnings")}
        <div class="rorev-body">
          <div class="rorev-earnings">
            ${earnRow("Total", estimates.total.robux, estimates.total.usd, true)}
            ${earnRow("Monthly", estimates.monthly.robux, estimates.monthly.usd)}
            ${earnRow("Daily", estimates.daily.robux, estimates.daily.usd)}
          </div>
          <p class="rorev-compact-note">Heuristic · not official Roblox data</p>

          <div class="rorev-details">
            <h3 class="rorev-section-title">Public stats</h3>
            <div class="rorev-grid">
              <div class="rorev-stat"><span class="rorev-stat-label">Playing</span><span class="rorev-stat-value">${compactNumber(stats.playing)}</span></div>
              <div class="rorev-stat"><span class="rorev-stat-label">Visits</span><span class="rorev-stat-value">${compactNumber(stats.visits)}</span></div>
              <div class="rorev-stat"><span class="rorev-stat-label">Favorites</span><span class="rorev-stat-value">${compactNumber(stats.favorites)}</span></div>
              <div class="rorev-stat"><span class="rorev-stat-label">Like ratio</span><span class="rorev-stat-value">${formatPercent(stats.likeRatio)}</span></div>
              <div class="rorev-stat"><span class="rorev-stat-label">Age</span><span class="rorev-stat-value">${formatAgeDays(stats.ageDays)}</span></div>
              <div class="rorev-stat"><span class="rorev-stat-label">Genre</span><span class="rorev-stat-value">${esc(stats.genre)}</span></div>
              <div class="rorev-stat"><span class="rorev-stat-label">Creator</span><span class="rorev-stat-value">${esc(stats.creatorName)}</span></div>
              <div class="rorev-stat"><span class="rorev-stat-label">Max players</span><span class="rorev-stat-value">${stats.maxPlayers ?? "—"}</span></div>
              <div class="rorev-stat"><span class="rorev-stat-label">Votes</span><span class="rorev-stat-value">${compactNumber(stats.upVotes)} / ${compactNumber(stats.downVotes)}</span></div>
              <div class="rorev-stat"><span class="rorev-stat-label">Est. RPV</span><span class="rorev-stat-value">${formatRobux(estimates.rpv)}</span></div>
              <div class="rorev-stat"><span class="rorev-stat-label">Intensity</span><span class="rorev-stat-value">${estimates.intensity.toFixed(2)}×</span></div>
              <div class="rorev-stat"><span class="rorev-stat-label">Universe</span><span class="rorev-stat-value">${esc(stats.universeId)}</span></div>
            </div>

            <h3 class="rorev-section-title">Game passes</h3>
            <div class="rorev-grid">
              <div class="rorev-stat"><span class="rorev-stat-label">On sale</span><span class="rorev-stat-value">${gp.onSale ?? 0} / ${gp.total ?? 0}</span></div>
              <div class="rorev-stat"><span class="rorev-stat-label">Avg price</span><span class="rorev-stat-value">${formatRobux(gp.avgPrice)}</span></div>
              <div class="rorev-stat"><span class="rorev-stat-label">Catalog sum</span><span class="rorev-stat-value">${formatRobux(gp.catalogSum)}</span></div>
              <div class="rorev-stat"><span class="rorev-stat-label">Fav / visit</span><span class="rorev-stat-value">${(stats.favoritesPerVisit || 0).toFixed(4)}</span></div>
            </div>
            ${
              topPasses
                ? `<ul class="rorev-passes">${topPasses}</ul>`
                : `<div class="rorev-status">No on-sale game passes found.</div>`
            }

            <div class="rorev-footer">
              <div class="rorev-method">Method: ${esc(estimates.methodDetail)}</div>
              Creator share ${(estimates.creatorShare * 100).toFixed(0)}% · DevEx $${estimates.devexRate}<br>
              Not affiliated with Roblox or RoMonitor.<br>
              Updated ${new Date(fetchedAt).toLocaleTimeString()}
              <div class="rorev-actions">
                <button type="button" class="rorev-text-btn" data-rorev-refresh>Refresh</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    applyExpanded(root, expanded);
    wireChrome(root);
  }

  function wireChrome(root) {
    root.querySelector("[data-rorev-collapse]")?.addEventListener("click", async () => {
      const next = root.classList.contains("rorev-collapsed");
      await setExpanded(next);
      applyExpanded(root, next);
    });
    root.querySelector("[data-rorev-hide]")?.addEventListener("click", async () => {
      await chrome.storage.local.set({ [HIDDEN_KEY]: true });
      renderHiddenChip(root);
    });
    root.querySelector("[data-rorev-refresh]")?.addEventListener("click", () => {
      loadAndRender();
    });
  }

  async function requestStats(placeId) {
    return chrome.runtime.sendMessage({ type: "GET_GAME_STATS", placeId });
  }

  let currentPlaceId = null;
  let loading = false;
  let mountRetry = 0;

  async function loadAndRender() {
    const placeId = parsePlaceId();

    if (!placeId) {
      document.getElementById(ROOT_ID)?.remove();
      currentPlaceId = null;
      return;
    }

    const hasPage = document.querySelector(
      ".game-main-content, .game-calls-to-action, #game-detail-page, h1, #content, main"
    );
    if (!hasPage && mountRetry < 24) {
      mountRetry += 1;
      setTimeout(loadAndRender, 250);
      return;
    }
    mountRetry = 0;

    const root = remountIfDetached();

    const hidden = (await chrome.storage.local.get(HIDDEN_KEY))[HIDDEN_KEY];
    if (hidden) {
      renderHiddenChip(root);
      currentPlaceId = placeId;
      return;
    }

    if (loading && currentPlaceId === placeId) return;
    loading = true;
    currentPlaceId = placeId;
    await renderLoading(root, placeId);

    try {
      const payload = await requestStats(placeId);
      if (parsePlaceId() !== placeId) return;
      const liveRoot = remountIfDetached();
      if (!payload?.ok) {
        await renderError(liveRoot, payload?.error || "Unknown error", placeId);
        return;
      }
      await renderStats(liveRoot, payload);
    } catch (err) {
      if (parsePlaceId() !== placeId) return;
      await renderError(remountIfDetached(), err?.message || "Extension messaging failed", placeId);
    } finally {
      loading = false;
    }
  }

  let lastHref = location.href;
  const mo = new MutationObserver(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      currentPlaceId = null;
      loadAndRender();
      return;
    }
    if (parsePlaceId() && !document.getElementById(ROOT_ID)?.isConnected) {
      loadAndRender();
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("popstate", () => {
    currentPlaceId = null;
    loadAndRender();
  });

  const pushState = history.pushState;
  history.pushState = function (...args) {
    pushState.apply(this, args);
    currentPlaceId = null;
    loadAndRender();
  };
  const replaceState = history.replaceState;
  history.replaceState = function (...args) {
    replaceState.apply(this, args);
    currentPlaceId = null;
    loadAndRender();
  };

  loadAndRender();
})();
