(() => {
  "use strict";

  const SW = {
    PANEL_ID: "__sw_inspector_panel__",
    STYLE_ID: "__sw_inspector_style__",

    API_URL: "https://data.similarweb.com/api/v1/data",
    EXTENSION_VERSION: "6.12.22",

    VERSION: "2026-09-21-direct-api"
  };

  /* =========================================================
     HELPERS
  ========================================================= */

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function currentDomain() {
    return location.hostname
      .replace(/^www\./i, "")
      .trim()
      .toLowerCase();
  }

  function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function pct(value, decimals = 2) {
    const n = num(value);
    if (n === null) return "—";

    const p = Math.abs(n) <= 1 ? n * 100 : n;
    return `${p.toFixed(decimals)}%`;
  }

  function compactNumber(value, decimals = 1) {
    const n = num(value);
    if (n === null) return "—";

    const abs = Math.abs(n);

    if (abs >= 1e9) {
      return `${(n / 1e9).toFixed(decimals).replace(/\.0$/, "")}B`;
    }

    if (abs >= 1e6) {
      return `${(n / 1e6).toFixed(decimals).replace(/\.0$/, "")}M`;
    }

    if (abs >= 1e3) {
      return `${(n / 1e3).toFixed(decimals).replace(/\.0$/, "")}K`;
    }

    return Math.round(n).toLocaleString("en-US");
  }

  function rank(value) {
    const n = num(value);
    if (n === null || n <= 0) return "—";
    return `#${Math.round(n).toLocaleString("en-US")}`;
  }

  function duration(seconds) {
    const total = Math.round(num(seconds) || 0);

    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;

    return [
      String(h).padStart(2, "0"),
      String(m).padStart(2, "0"),
      String(s).padStart(2, "0")
    ].join(":");
  }

  function prettyMonth(dateString) {
    try {
      const date = new Date(`${dateString}T00:00:00Z`);

      return date.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
        timeZone: "UTC"
      });
    } catch {
      return dateString;
    }
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function firstDefined(...values) {
    for (const value of values) {
      if (value !== undefined && value !== null && value !== "") {
        return value;
      }
    }
    return null;
  }

  function objectEntriesSorted(obj) {
    if (!obj || typeof obj !== "object") return [];

    return Object.entries(obj)
      .map(([name, value]) => ({
        name,
        value: num(value)
      }))
      .filter(x => x.value !== null)
      .sort((a, b) => b.value - a.value);
  }

  function prettifySourceName(name) {
    const map = {
      Direct: "Direct",
      Mail: "Email",
      SocialOrganic: "Social Organic",
      SocialPaid: "Social Paid",
      Referrals: "Referrals",
      SearchOrganic: "Search Organic",
      SearchPaid: "Search Paid",
      DisplayAds: "Display Ads",
      PaidReferrals: "Affiliate",
      OrganicShopping: "Organic Shopping",
      PaidShopping: "Paid Shopping",
      GenAI: "Gen AI",
      AiTraffic: "Gen AI"
    };

    if (map[name]) return map[name];

    return String(name)
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/_/g, " ")
      .replace(/\b\w/g, m => m.toUpperCase());
  }

  /* =========================================================
     API
  ========================================================= */

  async function fetchSimilarweb(domain) {
    const url = `${SW.API_URL}?domain=${encodeURIComponent(domain)}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Extension-Version": SW.EXTENSION_VERSION
      },
      redirect: "follow"
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(
        `Similarweb API returned HTTP ${response.status}${
          text ? `: ${text.slice(0, 180)}` : ""
        }`
      );
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Similarweb returned invalid JSON");
    }
  }

  /* =========================================================
     NORMALIZATION
  ========================================================= */

  function normalizeVisits(data) {
    const monthly = data?.EstimatedMonthlyVisits;

    if (!monthly || typeof monthly !== "object") return [];

    return Object.entries(monthly)
      .map(([date, visits]) => ({
        date,
        visits: num(visits)
      }))
      .filter(x => x.visits !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  function normalizeCountries(data) {
    return safeArray(data?.TopCountryShares)
      .map(item => {
        const country =
          firstDefined(
            item?.Country,
            item?.CountryCode,
            item?.Name,
            item?.Code,
            item?.country,
            item?.countryCode
          ) || "Unknown";

        const share = firstDefined(
          item?.Value,
          item?.Share,
          item?.TrafficShare,
          item?.Percentage,
          item?.value,
          item?.share
        );

        return {
          country,
          share: num(share)
        };
      })
      .filter(x => x.share !== null)
      .sort((a, b) => b.share - a.share)
      .slice(0, 5);
  }

  function normalizeKeywords(data) {
    return safeArray(data?.TopKeywords)
      .map(item => {
        const name = firstDefined(
          item?.Name,
          item?.Keyword,
          item?.keyword,
          item?.name
        );

        const traffic = firstDefined(
          item?.EstimatedValue,
          item?.Traffic,
          item?.Value,
          item?.traffic
        );

        const volume = firstDefined(
          item?.Volume,
          item?.SearchVolume,
          item?.volume
        );

        const cpc = firstDefined(
          item?.Cpc,
          item?.CPC,
          item?.cpc
        );

        return {
          name,
          traffic: num(traffic),
          volume: num(volume),
          cpc: num(cpc)
        };
      })
      .filter(x => x.name)
      .slice(0, 5);
  }

  function normalizeAiTraffic(data) {
    const details = data?.AiTrafficDetails || {};
    const distribution = details?.Traffic?.Distribution || {};

    const chatbots = safeArray(distribution?.Chatbots);

    if (chatbots.length) {
      return chatbots
        .map(item => ({
          name: firstDefined(
            item?.Name,
            item?.Domain,
            item?.Source,
            item?.name,
            item?.domain
          ),
          value: num(
            firstDefined(
              item?.Value,
              item?.Share,
              item?.TrafficShare,
              item?.Percentage,
              item?.value
            )
          )
        }))
        .filter(x => x.name && x.value !== null)
        .sort((a, b) => b.value - a.value);
    }

    const chart = safeArray(distribution?.Chart);

    if (chart.length) {
      const latest = chart[chart.length - 1];

      if (latest && typeof latest === "object") {
        const possibleArray =
          latest?.Data ||
          latest?.Values ||
          latest?.Distribution ||
          latest?.Sources;

        if (Array.isArray(possibleArray)) {
          return possibleArray
            .map(item => ({
              name: firstDefined(
                item?.Name,
                item?.Domain,
                item?.Source
              ),
              value: num(
                firstDefined(
                  item?.Value,
                  item?.Share,
                  item?.Percentage
                )
              )
            }))
            .filter(x => x.name && x.value !== null)
            .sort((a, b) => b.value - a.value);
        }
      }
    }

    return [];
  }

  /* =========================================================
     CSS
  ========================================================= */

  function injectStyles() {
    if (document.getElementById(SW.STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = SW.STYLE_ID;

    style.textContent = `
      #${SW.PANEL_ID} {
        position: fixed;
        top: 18px;
        right: 18px;
        width: min(430px, calc(100vw - 24px));
        max-height: calc(100vh - 36px);
        overflow: auto;
        z-index: 2147483647;

        font-family:
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          Roboto,
          Arial,
          sans-serif;

        font-size: 13px;
        line-height: 1.4;
        color: #e9edf3;

        background: rgba(18, 20, 26, 0.97);
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 14px;
        box-shadow: 0 16px 50px rgba(0,0,0,.45);

        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
      }

      #${SW.PANEL_ID},
      #${SW.PANEL_ID} * {
        box-sizing: border-box;
      }

      #${SW.PANEL_ID} .sw-head {
        position: sticky;
        top: 0;
        z-index: 5;

        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;

        padding: 13px 14px;

        background: rgba(18,20,26,.96);
        border-bottom: 1px solid rgba(255,255,255,.09);
        backdrop-filter: blur(18px);
      }

      #${SW.PANEL_ID} .sw-title-wrap {
        min-width: 0;
      }

      #${SW.PANEL_ID} .sw-title {
        font-size: 15px;
        font-weight: 700;
        color: #fff;
      }

      #${SW.PANEL_ID} .sw-domain {
        margin-top: 2px;
        font-size: 12px;
        color: #9aa4b2;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      #${SW.PANEL_ID} .sw-actions {
        display: flex;
        gap: 6px;
        flex-shrink: 0;
      }

      #${SW.PANEL_ID} button {
        appearance: none;
        border: 1px solid rgba(255,255,255,.12);
        background: rgba(255,255,255,.07);
        color: #e9edf3;
        border-radius: 8px;
        min-height: 29px;
        padding: 0 9px;
        cursor: pointer;
        font: inherit;
      }

      #${SW.PANEL_ID} button:hover {
        background: rgba(255,255,255,.13);
      }

      #${SW.PANEL_ID} .sw-close {
        width: 30px;
        padding: 0;
        font-size: 18px;
      }

      #${SW.PANEL_ID} .sw-body {
        padding: 12px;
      }

      #${SW.PANEL_ID} .sw-loading,
      #${SW.PANEL_ID} .sw-error {
        padding: 22px 10px;
        text-align: center;
      }

      #${SW.PANEL_ID} .sw-loading {
        color: #b8c1cc;
      }

      #${SW.PANEL_ID} .sw-error {
        color: #ff9a9a;
        white-space: pre-wrap;
      }

      #${SW.PANEL_ID} .sw-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }

      #${SW.PANEL_ID} .sw-stat {
        padding: 10px;
        background: rgba(255,255,255,.045);
        border: 1px solid rgba(255,255,255,.07);
        border-radius: 10px;
      }

      #${SW.PANEL_ID} .sw-stat-label {
        font-size: 11px;
        color: #98a2af;
        margin-bottom: 3px;
      }

      #${SW.PANEL_ID} .sw-stat-value {
        color: #fff;
        font-weight: 700;
        font-size: 17px;
      }

      #${SW.PANEL_ID} .sw-section {
        margin-top: 14px;
      }

      #${SW.PANEL_ID} .sw-section-title {
        margin-bottom: 7px;
        font-size: 12px;
        font-weight: 700;
        color: #dce2ea;
        text-transform: uppercase;
        letter-spacing: .04em;
      }

      #${SW.PANEL_ID} .sw-list {
        overflow: hidden;
        border: 1px solid rgba(255,255,255,.07);
        border-radius: 10px;
      }

      #${SW.PANEL_ID} .sw-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;

        min-height: 34px;
        padding: 7px 10px;

        background: rgba(255,255,255,.035);
        border-bottom: 1px solid rgba(255,255,255,.055);
      }

      #${SW.PANEL_ID} .sw-row:last-child {
        border-bottom: 0;
      }

      #${SW.PANEL_ID} .sw-row-name {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: #d8dde5;
      }

      #${SW.PANEL_ID} .sw-row-value {
        flex-shrink: 0;
        color: #fff;
        font-weight: 600;
      }

      #${SW.PANEL_ID} .sw-sub {
        color: #8f99a7;
        font-size: 11px;
      }

      #${SW.PANEL_ID} .sw-chart-row {
        position: relative;
        overflow: hidden;
      }

      #${SW.PANEL_ID} .sw-chart-bar {
        position: absolute;
        inset: 0 auto 0 0;
        background: rgba(88,166,255,.12);
        pointer-events: none;
      }

      #${SW.PANEL_ID} .sw-chart-row > *:not(.sw-chart-bar) {
        position: relative;
        z-index: 1;
      }

      #${SW.PANEL_ID} .sw-keyword-main {
        min-width: 0;
      }

      #${SW.PANEL_ID} .sw-keyword-name {
        color: #fff;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      #${SW.PANEL_ID} .sw-bottom {
        display: flex;
        gap: 7px;
        margin-top: 14px;
      }

      #${SW.PANEL_ID} .sw-bottom button {
        flex: 1;
      }

      #${SW.PANEL_ID} .sw-note {
        margin-top: 10px;
        text-align: center;
        font-size: 10px;
        color: #6f7885;
      }
    `;

    document.documentElement.appendChild(style);
  }

  /* =========================================================
     PANEL
  ========================================================= */

  function removePanel() {
    document.getElementById(SW.PANEL_ID)?.remove();
  }

  function createPanel(domain) {
    removePanel();
    injectStyles();

    const panel = document.createElement("div");
    panel.id = SW.PANEL_ID;

    panel.innerHTML = `
      <div class="sw-head">
        <div class="sw-title-wrap">
          <div class="sw-title">Similarweb</div>
          <div class="sw-domain">${esc(domain)}</div>
        </div>

        <div class="sw-actions">
          <button class="sw-refresh" title="Refresh">↻</button>
          <button class="sw-close" title="Close">×</button>
        </div>
      </div>

      <div class="sw-body">
        <div class="sw-loading">Loading Similarweb data…</div>
      </div>
    `;

    panel.querySelector(".sw-close").onclick = removePanel;

    document.documentElement.appendChild(panel);

    return panel;
  }

  function section(title, rows) {
    if (!rows || !rows.length) return "";

    return `
      <div class="sw-section">
        <div class="sw-section-title">${esc(title)}</div>
        <div class="sw-list">
          ${rows.join("")}
        </div>
      </div>
    `;
  }

  function simpleRow(name, value, sub = "") {
    return `
      <div class="sw-row">
        <div class="sw-row-name">
          ${esc(name)}
          ${sub ? `<div class="sw-sub">${esc(sub)}</div>` : ""}
        </div>
        <div class="sw-row-value">${esc(value)}</div>
      </div>
    `;
  }

  function render(panel, data) {
    const engagements = data?.Engagments || {};
    const visits = normalizeVisits(data);

    const latestVisits =
      num(engagements?.Visits) ??
      (visits.length ? visits[visits.length - 1].visits : null);

    const month =
      engagements?.Month && engagements?.Year
        ? `${String(engagements.Month).padStart(2, "0")}/${engagements.Year}`
        : data?.SnapshotDate
          ? prettyMonth(String(data.SnapshotDate).slice(0, 10))
          : "";

    const globalRank = data?.GlobalRank?.Rank;
    const countryRank = data?.CountryRank?.Rank;
    const countryCode = data?.CountryRank?.CountryCode || "";
    const categoryRank = data?.CategoryRank?.Rank;
    const category =
      data?.CategoryRank?.Category ||
      data?.Category ||
      "";

    const trafficSources = objectEntriesSorted(data?.TrafficSources);

    const countries = normalizeCountries(data);
    const keywords = normalizeKeywords(data);
    const aiTraffic = normalizeAiTraffic(data);

    const maxVisit = Math.max(
      1,
      ...visits.map(x => x.visits || 0)
    );

    const visitRows = visits.map(item => {
      const width = Math.max(
        2,
        Math.min(100, ((item.visits || 0) / maxVisit) * 100)
      );

      return `
        <div class="sw-row sw-chart-row">
          <div class="sw-chart-bar" style="width:${width}%"></div>
          <div class="sw-row-name">${esc(prettyMonth(item.date))}</div>
          <div class="sw-row-value">${esc(compactNumber(item.visits))}</div>
        </div>
      `;
    });

    const rankRows = [
      simpleRow("Global", rank(globalRank)),
      simpleRow(
        countryCode ? `Country · ${countryCode}` : "Country",
        rank(countryRank)
      ),
      simpleRow(
        category ? `Category · ${String(category).replace(/_/g, " ")}` : "Category",
        rank(categoryRank)
      )
    ];

    const countryRows = countries.map(item =>
      simpleRow(item.country, pct(item.share))
    );

    const trafficRows = trafficSources.map(item =>
      simpleRow(prettifySourceName(item.name), pct(item.value))
    );

    const keywordRows = keywords.map(item => {
      const meta = [];

      if (item.traffic !== null) {
        meta.push(`Traffic ${compactNumber(item.traffic)}`);
      }

      if (item.volume !== null) {
        meta.push(`Volume ${compactNumber(item.volume)}`);
      }

      if (item.cpc !== null) {
        meta.push(`CPC $${item.cpc.toFixed(2)}`);
      }

      return `
        <div class="sw-row">
          <div class="sw-keyword-main">
            <div class="sw-keyword-name">${esc(item.name)}</div>
            ${
              meta.length
                ? `<div class="sw-sub">${esc(meta.join(" · "))}</div>`
                : ""
            }
          </div>
        </div>
      `;
    });

    const aiRows = aiTraffic.map(item =>
      simpleRow(item.name, pct(item.value))
    );

    const aiDetails = data?.AiTrafficDetails || {};

    const aiSummaryRows = [];

    if (num(aiDetails?.TotalVisits) !== null) {
      aiSummaryRows.push(
        simpleRow(
          "AI referrals visits",
          compactNumber(aiDetails.TotalVisits)
        )
      );
    }

    if (num(aiDetails?.ReferralTraffic) !== null) {
      aiSummaryRows.push(
        simpleRow(
          "Share of traffic",
          pct(aiDetails.ReferralTraffic)
        )
      );
    }

    panel.querySelector(".sw-body").innerHTML = `
      <div class="sw-grid">
        <div class="sw-stat">
          <div class="sw-stat-label">Monthly Visits</div>
          <div class="sw-stat-value">${esc(compactNumber(latestVisits))}</div>
          ${month ? `<div class="sw-sub">${esc(month)}</div>` : ""}
        </div>

        <div class="sw-stat">
          <div class="sw-stat-label">Bounce Rate</div>
          <div class="sw-stat-value">${esc(pct(engagements?.BounceRate))}</div>
        </div>

        <div class="sw-stat">
          <div class="sw-stat-label">Pages / Visit</div>
          <div class="sw-stat-value">${
            num(engagements?.PagePerVisit) !== null
              ? Number(engagements.PagePerVisit).toFixed(2)
              : "—"
          }</div>
        </div>

        <div class="sw-stat">
          <div class="sw-stat-label">Avg. Visit Duration</div>
          <div class="sw-stat-value">${
            num(engagements?.TimeOnSite) !== null
              ? esc(duration(engagements.TimeOnSite))
              : "—"
          }</div>
        </div>
      </div>

      ${section("Visits Over Time", visitRows)}
      ${section("Rankings", rankRows)}
      ${section("Top Countries", countryRows)}
      ${section("Traffic Sources", trafficRows)}
      ${section("Top Keywords", keywordRows)}
      ${section("AI Traffic", [...aiSummaryRows, ...aiRows])}

      <div class="sw-bottom">
        <button class="sw-copy">Copy Summary</button>
        <button class="sw-json">Copy JSON</button>
      </div>

      <div class="sw-note">
        Snapshot ${esc(
          data?.SnapshotDate
            ? String(data.SnapshotDate).slice(0, 10)
            : "—"
        )}
      </div>
    `;

    panel.querySelector(".sw-copy").onclick = async () => {
      const lines = [
        `Similarweb · ${data?.SiteName || currentDomain()}`,
        "",
        `Monthly Visits: ${compactNumber(latestVisits)}`,
        `Bounce Rate: ${pct(engagements?.BounceRate)}`,
        `Pages / Visit: ${
          num(engagements?.PagePerVisit) !== null
            ? Number(engagements.PagePerVisit).toFixed(2)
            : "—"
        }`,
        `Avg. Visit Duration: ${
          num(engagements?.TimeOnSite) !== null
            ? duration(engagements.TimeOnSite)
            : "—"
        }`,
        "",
        `Global Rank: ${rank(globalRank)}`,
        `Country Rank: ${rank(countryRank)}${countryCode ? ` (${countryCode})` : ""}`,
        `Category Rank: ${rank(categoryRank)}${category ? ` (${category})` : ""}`
      ];

      if (visits.length) {
        lines.push("", "Visits Over Time:");

        visits.forEach(item => {
          lines.push(
            `${prettyMonth(item.date)}: ${compactNumber(item.visits)}`
          );
        });
      }

      if (countries.length) {
        lines.push("", "Top Countries:");

        countries.forEach(item => {
          lines.push(`${item.country}: ${pct(item.share)}`);
        });
      }

      if (trafficSources.length) {
        lines.push("", "Traffic Sources:");

        trafficSources.forEach(item => {
          lines.push(
            `${prettifySourceName(item.name)}: ${pct(item.value)}`
          );
        });
      }

      if (keywords.length) {
        lines.push("", "Top Keywords:");

        keywords.forEach(item => {
          const extras = [];

          if (item.traffic !== null) {
            extras.push(`traffic ${compactNumber(item.traffic)}`);
          }

          if (item.volume !== null) {
            extras.push(`volume ${compactNumber(item.volume)}`);
          }

          if (item.cpc !== null) {
            extras.push(`CPC $${item.cpc.toFixed(2)}`);
          }

          lines.push(
            `${item.name}${extras.length ? ` — ${extras.join(", ")}` : ""}`
          );
        });
      }

      if (aiTraffic.length) {
        lines.push("", "AI Traffic:");

        aiTraffic.forEach(item => {
          lines.push(`${item.name}: ${pct(item.value)}`);
        });
      }

      try {
        await navigator.clipboard.writeText(lines.join("\n"));

        const btn = panel.querySelector(".sw-copy");
        const old = btn.textContent;
        btn.textContent = "Copied";

        setTimeout(() => {
          btn.textContent = old;
        }, 1200);
      } catch (e) {
        console.error("[SW] Clipboard error", e);
      }
    };

    panel.querySelector(".sw-json").onclick = async () => {
      try {
        await navigator.clipboard.writeText(
          JSON.stringify(data, null, 2)
        );

        const btn = panel.querySelector(".sw-json");
        const old = btn.textContent;
        btn.textContent = "Copied";

        setTimeout(() => {
          btn.textContent = old;
        }, 1200);
      } catch (e) {
        console.error("[SW] Clipboard error", e);
      }
    };
  }

  function renderError(panel, error) {
    panel.querySelector(".sw-body").innerHTML = `
      <div class="sw-error">
        <strong>Similarweb request failed</strong>

        ${esc(error?.message || String(error))}
      </div>
    `;
  }

  /* =========================================================
     MAIN
  ========================================================= */

  async function run() {
    const domain = currentDomain();

    if (!domain) {
      alert("SW: domain not found");
      return;
    }

    const panel = createPanel(domain);

    const load = async () => {
      panel.querySelector(".sw-body").innerHTML = `
        <div class="sw-loading">
          Loading Similarweb data…
        </div>
      `;

      try {
        const data = await fetchSimilarweb(domain);

        window.__SW_LAST_DATA__ = data;

        render(panel, data);

        console.log("[SW]", {
          version: SW.VERSION,
          domain,
          data
        });
      } catch (error) {
        console.error("[SW]", error);
        renderError(panel, error);
      }
    };

    panel.querySelector(".sw-refresh").onclick = load;

    await load();
  }

  run();
})();
