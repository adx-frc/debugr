// ==UserScript==
// @name         Similarweb Inspector
// @namespace    https://github.com/adx-frc
// @version      2.2.0
// @description  Similarweb traffic inspector with API and public-web fallback
// @author       AdX
// @match        http://*/*
// @match        https://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM_openInTab
// @connect      data.similarweb.com
// @connect      www.similarweb.com
// @run-at       document-idle
// @noframes
// @updateURL    https://raw.githubusercontent.com/adx-frc/debugr/similarweb-fallback-v2/similarweb-inspector.user.js
// @downloadURL  https://raw.githubusercontent.com/adx-frc/debugr/similarweb-fallback-v2/similarweb-inspector.user.js
// ==/UserScript==

(() => {
  "use strict";

  const SW = {
    PANEL_ID: "__sw_inspector_panel__",
    STYLE_ID: "__sw_inspector_style__",

    API_URL: "https://data.similarweb.com/api/v1/data",
    EXTENSION_VERSION: "6.12.22",

    VERSION: "2026-09-21-direct-diagnostic"
  };

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

  function injectStyles() {
    if (document.getElementById(SW.STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = SW.STYLE_ID;

    style.textContent = `
      #${SW.PANEL_ID} {
        position: fixed;
        top: 18px;
        right: 18px;
        width: min(460px, calc(100vw - 24px));
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

        background: rgba(18, 20, 26, 0.98);
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

        background: rgba(18,20,26,.97);
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
        padding: 18px 10px;
      }

      #${SW.PANEL_ID} .sw-loading {
        text-align: center;
        color: #b8c1cc;
      }

      #${SW.PANEL_ID} .sw-error {
        color: #ffaaaa;
        white-space: pre-wrap;
      }

      #${SW.PANEL_ID} .sw-debug {
        margin-top: 10px;
        padding: 10px;
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 10px;
        background: rgba(255,255,255,.035);
        color: #c7cfda;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 11px;
        white-space: pre-wrap;
        word-break: break-word;
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
      .map(item => ({
        country:
          firstDefined(
            item?.Country,
            item?.CountryCode,
            item?.Name,
            item?.Code,
            item?.country,
            item?.countryCode
          ) || "Unknown",

        share: num(
          firstDefined(
            item?.Value,
            item?.Share,
            item?.TrafficShare,
            item?.Percentage,
            item?.value,
            item?.share
          )
        )
      }))
      .filter(x => x.share !== null)
      .sort((a, b) => b.share - a.share)
      .slice(0, 5);
  }

  function normalizeKeywords(data) {
    return safeArray(data?.TopKeywords)
      .map(item => ({
        name: firstDefined(
          item?.Name,
          item?.Keyword,
          item?.keyword,
          item?.name
        ),

        traffic: num(
          firstDefined(
            item?.EstimatedValue,
            item?.Traffic,
            item?.Value,
            item?.traffic
          )
        ),

        volume: num(
          firstDefined(
            item?.Volume,
            item?.SearchVolume,
            item?.volume
          )
        ),

        cpc: num(
          firstDefined(
            item?.Cpc,
            item?.CPC,
            item?.cpc
          )
        )
      }))
      .filter(x => x.name)
      .slice(0, 5);
  }

  function normalizeAiTraffic(data) {
    const details = data?.AiTrafficDetails || {};
    const distribution = details?.Traffic?.Distribution || {};

    const chatbots = safeArray(distribution?.Chatbots);

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

  function gmRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: options.method || "GET",
        url,
        headers: options.headers || {},
        timeout: options.timeout || 20000,
        onload(response) {
          resolve({
            status: response.status,
            text: String(response.responseText || ""),
            finalUrl: response.finalUrl || url
          });
        },
        onerror(error) {
          reject(new Error(error?.error || error?.statusText || "Network error"));
        },
        ontimeout() {
          reject(new Error("Request timed out"));
        }
      });
    });
  }

  function mergeObject(target, source) {
    if (!source || typeof source !== "object") return target;
    for (const [key, value] of Object.entries(source)) {
      if (value === undefined || value === null) continue;
      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        target[key] &&
        typeof target[key] === "object" &&
        !Array.isArray(target[key])
      ) {
        mergeObject(target[key], value);
      } else if (
        target[key] === undefined ||
        target[key] === null ||
        (Array.isArray(target[key]) && target[key].length === 0) ||
        (
          target[key] &&
          typeof target[key] === "object" &&
          !Array.isArray(target[key]) &&
          Object.keys(target[key]).length === 0
        )
      ) {
        target[key] = value;
      }
    }
    return target;
  }

  function walkJson(value, fn, seen = new WeakSet(), depth = 0) {
    if (!value || typeof value !== "object" || depth > 35) return;
    if (seen.has(value)) return;
    seen.add(value);
    fn(value);
    if (Array.isArray(value)) {
      value.forEach(item => walkJson(item, fn, seen, depth + 1));
    } else {
      Object.values(value).forEach(item => walkJson(item, fn, seen, depth + 1));
    }
  }

  function parseJsonScripts(doc) {
    const roots = [];
    doc.querySelectorAll("script").forEach(script => {
      const text = String(script.textContent || "").trim();
      if (!text) return;
      if (
        script.type === "application/json" ||
        script.id === "__NEXT_DATA__" ||
        text.startsWith("{") ||
        text.startsWith("[")
      ) {
        try {
          roots.push(JSON.parse(text));
        } catch {}
      }
    });
    return roots;
  }

  function extractApiLike(roots, domain) {
    const result = { SiteName: domain };
    const useful = new Set([
      "version","sitename","description","topcountryshares","title",
      "engagments","engagements","estimatedmonthlyvisits","globalrank",
      "countryrank","categoryrank","globalcategoryrank","issmall","policy",
      "trafficsources","category","largescreenshot","isdatafromga","countries",
      "competitors","notification","topkeywords","aitrafficdetails","snapshotdate"
    ]);

    roots.forEach(root => {
      walkJson(root, obj => {
        if (!obj || Array.isArray(obj)) return;
        const keys = Object.keys(obj);
        const score = keys.filter(k => useful.has(k.toLowerCase())).length;
        if (score >= 2) mergeObject(result, obj);
      });
    });

    if (!result.Engagments && result.Engagements) {
      result.Engagments = result.Engagements;
    }

    return result;
  }

  function parseCompact(value) {
    const text = String(value || "").trim().replace(/,/g, "");
    const match = /^(\\d+(?:\\.\\d+)?)\\s*([KMB])?$/i.exec(text);
    if (!match) return Number.isFinite(Number(text)) ? Number(text) : null;
    const mult = !match[2] ? 1 : ({ K: 1e3, M: 1e6, B: 1e9 })[match[2].toUpperCase()];
    return Number(match[1]) * mult;
  }

  function parseVisibleHtml(doc, domain) {
    const rawText = String(doc.body?.innerText || "")
      .replace(/\u00a0/g, " ")
      .replace(/\r/g, "");

    const lines = rawText
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean);

    const out = {
      SiteName: domain,
      Engagments: {},
      EstimatedMonthlyVisits: {},
      GlobalRank: {},
      CountryRank: {},
      CategoryRank: {},
      TopCountryShares: [],
      TrafficSources: {},
      TopKeywords: []
    };

    out.Title =
      doc.querySelector('meta[property="og:title"]')?.content ||
      doc.querySelector("title")?.textContent ||
      "";

    out.Description =
      doc.querySelector('meta[name="description"]')?.content ||
      doc.querySelector('meta[property="og:description"]')?.content ||
      "";

    const indexOfLine = pattern => {
      if (typeof pattern === "string") {
        const needle = pattern.toLowerCase();
        return lines.findIndex(line => line.toLowerCase() === needle);
      }
      return lines.findIndex(line => pattern.test(line));
    };

    const nextMatchingLine = (startIndex, maxAhead, regex) => {
      if (startIndex < 0) return null;
      const max = Math.min(lines.length, startIndex + maxAhead + 1);
      for (let i = startIndex + 1; i < max; i++) {
        const m = regex.exec(lines[i]);
        if (m) return { index: i, line: lines[i], match: m };
      }
      return null;
    };

    const parseRankAfter = label => {
      const i = indexOfLine(label);
      const found = nextMatchingLine(i, 8, /^#?\s*([\d,]+)$/);
      return found ? Number(found.match[1].replace(/,/g, "")) : null;
    };

    const globalRank = parseRankAfter("Global Rank");
    const countryRank = parseRankAfter("Country Rank");
    let categoryRank = parseRankAfter("Category Rank");

    if (globalRank) out.GlobalRank.Rank = globalRank;
    if (countryRank) out.CountryRank.Rank = countryRank;

    if (!categoryRank && out.Description) {
      const m = /ranked\s+#([\d,]+)\s+in\s+the\s+(.+?)\s+category/i.exec(out.Description);
      if (m) {
        categoryRank = Number(m[1].replace(/,/g, ""));
        out.CategoryRank.Category = m[2].trim();
      }
    }

    if (categoryRank) out.CategoryRank.Rank = categoryRank;

    const countryAnchor = doc.querySelector(
      'a[href*="/top-websites/"][href$="/"]'
    );

    if (countryAnchor?.textContent?.trim()) {
      const label = countryAnchor.textContent.trim();
      if (label && label.length < 80) {
        out.CountryRank.CountryCode = label;
      }
    }

    const parsePercentAfterLabel = label => {
      const i = indexOfLine(label);
      const found = nextMatchingLine(i, 6, /^([\d.]+)%$/);
      return found ? Number(found.match[1]) / 100 : null;
    };

    const parseNumberAfterLabel = label => {
      const i = indexOfLine(label);
      const found = nextMatchingLine(i, 6, /^([\d.]+)$/);
      return found ? Number(found.match[1]) : null;
    };

    const parseDurationAfterLabel = label => {
      const i = indexOfLine(label);
      const found = nextMatchingLine(i, 6, /^(\d{1,2}):(\d{2}):(\d{2})$/);
      if (!found) return null;
      return (
        Number(found.match[1]) * 3600 +
        Number(found.match[2]) * 60 +
        Number(found.match[3])
      );
    };

    const bounce = parsePercentAfterLabel("Bounce Rate");
    const pages = parseNumberAfterLabel("Pages per Visit");
    const timeOnSite = parseDurationAfterLabel("Avg Visit Duration");

    if (bounce !== null) out.Engagments.BounceRate = bounce;
    if (pages !== null) out.Engagments.PagePerVisit = pages;
    if (timeOnSite !== null) out.Engagments.TimeOnSite = timeOnSite;

    const visitsHeading = indexOfLine("### Total Visits Last 3 Months") >= 0
      ? indexOfLine("### Total Visits Last 3 Months")
      : indexOfLine("Total Visits Last 3 Months");

    let visits = null;

    if (visitsHeading >= 0) {
      const found = nextMatchingLine(
        visitsHeading,
        30,
        /^(\d+(?:\.\d+)?)\s*([KMB])$/i
      );

      if (found) {
        visits = parseCompact(found.match[1] + found.match[2]);
      }
    }

    if (visits === null) {
      const trafficHeading = lines.findIndex(line =>
        /Traffic\s*&\s*Engagement Analysis/i.test(line)
      );

      if (trafficHeading >= 0) {
        const found = nextMatchingLine(
          trafficHeading,
          80,
          /^(\d+(?:\.\d+)?)\s*([KMB])$/i
        );

        if (found) {
          visits = parseCompact(found.match[1] + found.match[2]);
        }
      }
    }

    if (visits !== null) {
      out.Engagments.Visits = visits;
    }

    const countriesStart = indexOfLine("### Top Countries") >= 0
      ? indexOfLine("### Top Countries")
      : indexOfLine("Top Countries");

    if (countriesStart >= 0) {
      const countries = [];

      for (
        let i = countriesStart + 1;
        i < Math.min(lines.length, countriesStart + 45);
        i++
      ) {
        const line = lines[i];

        if (
          /See all countries/i.test(line) ||
          /Website Traffic Demographics/i.test(line) ||
          /^##\s/.test(line)
        ) {
          break;
        }

        if (
          line === "Share" ||
          line === "Others" ||
          /Top Countries/i.test(line) ||
          /^\d+(?:\.\d+)?%/.test(line)
        ) {
          continue;
        }

        const next = lines[i + 1] || "";
        const pctMatch = /^([\d.]+)%/.exec(next);

        if (pctMatch) {
          countries.push({
            Country: line,
            Value: Number(pctMatch[1]) / 100
          });
          i += 1;
        }
      }

      out.TopCountryShares = countries.slice(0, 5);
    }

    const sourceStart = lines.findIndex(line =>
      /Top Traffic Sources/i.test(line)
    );

    if (sourceStart >= 0) {
      const section = lines
        .slice(sourceStart, Math.min(lines.length, sourceStart + 45))
        .join(" ");

      const direct = /Direct traffic, driving\s+([\d.]+)%/i.exec(section);

      if (direct) {
        out.TrafficSources.Direct = Number(direct[1]) / 100;
      }

      const channelNames = [
        ["Direct", "Direct"],
        ["Referrals", "Referrals"],
        ["Organic Search", "SearchOrganic"],
        ["Paid Search", "SearchPaid"],
        ["Social", "SocialOrganic"],
        ["Email", "Mail"],
        ["Display Ads", "DisplayAds"],
        ["Affiliate", "Affiliate"]
      ];

      for (const [label, key] of channelNames) {
        const labelIndex = lines.findIndex(
          (line, idx) =>
            idx >= sourceStart &&
            idx < sourceStart + 45 &&
            line.toLowerCase() === label.toLowerCase()
        );

        if (labelIndex < 0) continue;

        const before = lines[labelIndex - 1] || "";
        const after = lines[labelIndex + 1] || "";

        const beforePct = /^([\d.]+)%$/.exec(before);
        const afterPct = /^([\d.]+)%$/.exec(after);
        const match = beforePct || afterPct;

        if (match) {
          out.TrafficSources[key] = Number(match[1]) / 100;
        }
      }
    }

    const keywordsStart = indexOfLine("### Top Keywords") >= 0
      ? indexOfLine("### Top Keywords")
      : indexOfLine("Top Keywords");

    if (keywordsStart >= 0) {
      const stop = Math.min(lines.length, keywordsStart + 35);
      const candidates = [];

      for (let i = keywordsStart + 1; i < stop; i++) {
        const line = lines[i];

        if (
          /Total Keywords/i.test(line) ||
          /Referral Web Traffic/i.test(line) ||
          /^##\s/.test(line)
        ) {
          break;
        }

        if (
          /^(Organic|Paid)\s+\d+(?:\.\d+)?%$/i.test(line) ||
          line === "Share" ||
          /See more/i.test(line)
        ) {
          continue;
        }

        const pieces = line
          .split(/\$\d+(?:\.\d+)?/)
          .map(x => x.trim())
          .filter(Boolean);

        for (const piece of pieces) {
          if (
            piece.length >= 2 &&
            piece.length <= 120 &&
            !/^\d+(?:\.\d+)?[KMB]?\s+Others/i.test(piece)
          ) {
            candidates.push(piece);
          }
        }
      }

      out.TopKeywords = [...new Set(candidates)]
        .slice(0, 10)
        .map(Name => ({ Name }));
    }

    return out;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function waitForSimilarwebRendered(domain) {
    const deadline = Date.now() + 18000;

    while (Date.now() < deadline) {
      const text = String(document.body?.innerText || "");

      if (
        text.includes(domain) &&
        (
          text.includes("Global Rank") ||
          text.includes("Traffic & Engagement Analysis") ||
          text.includes("Total Visits Last 3 Months")
        )
      ) {
        await sleep(1200);
        return;
      }

      await sleep(500);
    }
  }

  async function collectRenderedSimilarweb(domain, requestId) {
    const resultKey = "__sw_rendered_result__:" + requestId;

    try {
      await waitForSimilarwebRendered(domain);

      const data = extractApiLike(parseJsonScripts(document), domain);
      mergeObject(data, parseVisibleHtml(document, domain));

      const diagnostic = {
        href: location.href,
        title: document.title,
        textLength: String(document.body?.innerText || "").length,
        scriptCount: document.scripts?.length || 0,
        hasGlobalRank: !!data?.GlobalRank?.Rank,
        hasVisits: !!data?.Engagments?.Visits,
        monthlyVisits: Object.keys(data?.EstimatedMonthlyVisits || {}).length,
        countryCount: Array.isArray(data?.TopCountryShares)
          ? data.TopCountryShares.length
          : 0,
        keywordCount: Array.isArray(data?.TopKeywords)
          ? data.TopKeywords.length
          : 0
      };

      GM_setValue(resultKey, {
        ok: true,
        ts: Date.now(),
        data,
        diagnostic
      });
    } catch (error) {
      GM_setValue(resultKey, {
        ok: false,
        ts: Date.now(),
        error: error?.message || String(error),
        diagnostic: {
          href: location.href,
          title: document.title,
          textLength: String(document.body?.innerText || "").length
        }
      });
    }

    setTimeout(() => {
      try {
        window.close();
      } catch {}
    }, 400);
  }

  async function fetchWebFallback(domain) {
    const requestId =
      Date.now().toString(36) +
      Math.random().toString(36).slice(2);

    const resultKey = "__sw_rendered_result__:" + requestId;

    return new Promise((resolve, reject) => {
      let settled = false;
      let listenerId = null;
      let tab = null;

      const cleanup = () => {
        if (listenerId !== null) {
          try {
            GM_removeValueChangeListener(listenerId);
          } catch {}
        }

        try {
          tab?.close?.();
        } catch {}
      };

      const finish = payload => {
        if (settled) return;
        settled = true;
        cleanup();

        if (!payload?.ok) {
          const err = new Error(
            payload?.error ||
            "Similarweb rendered fallback failed"
          );
          err.__swRenderedDebug = payload?.diagnostic || {};
          reject(err);
          return;
        }

        const data = payload.data || {};

        if (
          !data?.Engagments?.Visits &&
          !data?.GlobalRank?.Rank &&
          !Object.keys(data?.EstimatedMonthlyVisits || {}).length
        ) {
          const err = new Error(
            "Similarweb rendered fallback returned no usable data"
          );
          err.__swRenderedDebug = payload?.diagnostic || {};
          reject(err);
          return;
        }

        data.__SW_SOURCE__ = "rendered-web";
        data.__SW_DIAGNOSTIC__ = payload?.diagnostic || {};
        resolve(data);
      };

      listenerId = GM_addValueChangeListener(
        resultKey,
        (_name, _oldValue, newValue) => {
          if (newValue) finish(newValue);
        }
      );

      const collectorUrl =
        "https://www.similarweb.com/website/" +
        encodeURIComponent(domain) +
        "/?__sw_collect=1&__sw_domain=" +
        encodeURIComponent(domain) +
        "&__sw_req=" +
        encodeURIComponent(requestId);

      try {
        tab = GM_openInTab(collectorUrl, {
          active: false,
          insert: true,
          setParent: true
        });
      } catch (error) {
        cleanup();
        reject(error);
        return;
      }

      setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();

        const err = new Error(
          "Similarweb rendered fallback timed out"
        );
        err.__swRenderedDebug = {
          collectorUrl,
          timeoutMs: 22000
        };
        reject(err);
      }, 22000);
    });
  }

  async function fetchSimilarweb(domain) {
    const cacheKey = "__sw_cache_v2__:" + domain;
    const cached = GM_getValue(cacheKey, null);

    if (
      cached &&
      cached.ts &&
      Date.now() - cached.ts < 6 * 60 * 60 * 1000 &&
      cached.data
    ) {
      console.log("[SW] cache hit", domain);
      return cached.data;
    }

    const url = SW.API_URL + "?domain=" + encodeURIComponent(domain);

    try {
      const response = await gmRequest(url, {
        headers: {
          "X-Extension-Version": "6.12.26"
        }
      });

      if (response.status >= 200 && response.status < 300) {
        const data = JSON.parse(response.text);
        GM_setValue(cacheKey, { ts: Date.now(), data, source: "api" });
        return data;
      }

      console.warn("[SW] direct API failed", response.status, response.text.slice(0, 300));
    } catch (error) {
      console.warn("[SW] direct API error", error);
    }

    const fallback = await fetchWebFallback(domain);

    if (
      !fallback ||
      (
        !fallback.Engagments?.Visits &&
        !fallback.GlobalRank?.Rank &&
        !Object.keys(fallback.EstimatedMonthlyVisits || {}).length
      )
    ) {
      const err = new Error("Similarweb fallback returned no usable data");
      err.__swRenderedDebug = fallback?.__SW_DIAGNOSTIC__ || {};
      throw err;
    }

    GM_setValue(cacheKey, { ts: Date.now(), data: fallback, source: "web" });
    return fallback;
  }

  function render(panel, data) {
    const engagements = data?.Engagments || {};
    const visits = normalizeVisits(data);

    const latestVisits =
      num(engagements?.Visits) ??
      (visits.length ? visits[visits.length - 1].visits : null);

    const globalRank = data?.GlobalRank?.Rank;
    const countryRank = data?.CountryRank?.Rank;
    const countryCode = data?.CountryRank?.CountryCode || "";
    const categoryRank = data?.CategoryRank?.Rank;
    const category =
      data?.CategoryRank?.Category ||
      data?.Category ||
      "";

    const trafficSources =
      objectEntriesSorted(data?.TrafficSources);

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
        Math.min(
          100,
          ((item.visits || 0) / maxVisit) * 100
        )
      );

      return `
        <div class="sw-row sw-chart-row">
          <div
            class="sw-chart-bar"
            style="width:${width}%"
          ></div>

          <div class="sw-row-name">
            ${esc(prettyMonth(item.date))}
          </div>

          <div class="sw-row-value">
            ${esc(compactNumber(item.visits))}
          </div>
        </div>
      `;
    });

    const rankRows = [
      simpleRow(
        "Global",
        rank(globalRank)
      ),

      simpleRow(
        countryCode
          ? `Country · ${countryCode}`
          : "Country",
        rank(countryRank)
      ),

      simpleRow(
        category
          ? `Category · ${String(category).replace(/_/g, " ")}`
          : "Category",
        rank(categoryRank)
      )
    ];

    const countryRows = countries.map(item =>
      simpleRow(
        item.country,
        pct(item.share)
      )
    );

    const trafficRows = trafficSources.map(item =>
      simpleRow(
        prettifySourceName(item.name),
        pct(item.value)
      )
    );

    const keywordRows = keywords.map(item => {
      const meta = [];

      if (item.traffic !== null) {
        meta.push(
          `Traffic ${compactNumber(item.traffic)}`
        );
      }

      if (item.volume !== null) {
        meta.push(
          `Volume ${compactNumber(item.volume)}`
        );
      }

      if (item.cpc !== null) {
        meta.push(
          `CPC $${item.cpc.toFixed(2)}`
        );
      }

      return `
        <div class="sw-row">
          <div class="sw-keyword-main">
            <div class="sw-keyword-name">
              ${esc(item.name)}
            </div>

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
      simpleRow(
        item.name,
        pct(item.value)
      )
    );

    panel.querySelector(".sw-body").innerHTML = `
      <div class="sw-grid">

        <div class="sw-stat">
          <div class="sw-stat-label">
            Monthly Visits
          </div>

          <div class="sw-stat-value">
            ${esc(compactNumber(latestVisits))}
          </div>
        </div>

        <div class="sw-stat">
          <div class="sw-stat-label">
            Bounce Rate
          </div>

          <div class="sw-stat-value">
            ${esc(pct(engagements?.BounceRate))}
          </div>
        </div>

        <div class="sw-stat">
          <div class="sw-stat-label">
            Pages / Visit
          </div>

          <div class="sw-stat-value">
            ${
              num(engagements?.PagePerVisit) !== null
                ? Number(engagements.PagePerVisit).toFixed(2)
                : "—"
            }
          </div>
        </div>

        <div class="sw-stat">
          <div class="sw-stat-label">
            Avg. Visit Duration
          </div>

          <div class="sw-stat-value">
            ${
              num(engagements?.TimeOnSite) !== null
                ? esc(duration(engagements.TimeOnSite))
                : "—"
            }
          </div>
        </div>

      </div>

      ${section("Visits Over Time", visitRows)}
      ${section("Rankings", rankRows)}
      ${section("Top Countries", countryRows)}
      ${section("Traffic Sources", trafficRows)}
      ${section("Top Keywords", keywordRows)}
      ${section("AI Traffic", aiRows)}

      <div class="sw-bottom">
        <button class="sw-copy-json">
          Copy JSON
        </button>

        <button class="sw-copy-debug">
          Copy Debug
        </button>
      </div>

      <div class="sw-note">
        SW ${esc(SW.VERSION)}
      </div>
    `;

    panel.querySelector(".sw-copy-json").onclick = async () => {
      try {
        await navigator.clipboard.writeText(
          JSON.stringify(data, null, 2)
        );

        const btn =
          panel.querySelector(".sw-copy-json");

        btn.textContent = "Copied";

        setTimeout(() => {
          btn.textContent = "Copy JSON";
        }, 1200);
      } catch (error) {
        console.error("[SW] Clipboard failed", error);
      }
    };

    panel.querySelector(".sw-copy-debug").onclick = async () => {
      const debug = {
        swVersion: SW.VERSION,
        pageUrl: location.href,
        pageOrigin: location.origin,
        domain: currentDomain(),
        apiUrl:
          `${SW.API_URL}?domain=${encodeURIComponent(currentDomain())}`,
        extensionVersion: SW.EXTENSION_VERSION,
        result: "success"
      };

      try {
        await navigator.clipboard.writeText(
          JSON.stringify(debug, null, 2)
        );

        const btn =
          panel.querySelector(".sw-copy-debug");

        btn.textContent = "Copied";

        setTimeout(() => {
          btn.textContent = "Copy Debug";
        }, 1200);
      } catch (error) {
        console.error("[SW] Clipboard failed", error);
      }
    };
  }

  function renderError(panel, error) {
    const debug =
      error?.__swDebug || {
        swVersion: SW.VERSION,
        pageOrigin: location.origin,
        pageUrl: location.href,
        domain: currentDomain(),
        apiUrl:
          `${SW.API_URL}?domain=${encodeURIComponent(currentDomain())}`,
        extensionVersion: SW.EXTENSION_VERSION,
        name: error?.name || "",
        message: error?.message || String(error),
        renderedFallback: error?.__swRenderedDebug || {}
      };

    panel.querySelector(".sw-body").innerHTML = `
      <div class="sw-error">
        <strong>Similarweb request failed</strong>

        ${esc(error?.message || String(error))}

        <div class="sw-debug">${esc(
          JSON.stringify(debug, null, 2)
        )}</div>

        <div class="sw-bottom">
          <button class="sw-copy-debug">
            Copy Debug
          </button>
        </div>
      </div>
    `;

    panel.querySelector(".sw-copy-debug").onclick =
      async () => {
        try {
          await navigator.clipboard.writeText(
            JSON.stringify(debug, null, 2)
          );

          const btn =
            panel.querySelector(".sw-copy-debug");

          btn.textContent = "Copied";

          setTimeout(() => {
            btn.textContent = "Copy Debug";
          }, 1200);
        } catch (clipboardError) {
          console.error(
            "[SW] Clipboard failed",
            clipboardError
          );
        }
      };
  }

  async function run() {
    const domain = currentDomain();

    console.log(
      `[SW] Loaded ${SW.VERSION} on ${location.href}`
    );

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

        console.log("[SW] SUCCESS", {
          version: SW.VERSION,
          domain,
          data
        });

      } catch (error) {
        console.error("[SW] ERROR", error);
        renderError(panel, error);
      }
    };

    panel.querySelector(".sw-refresh").onclick = load;

    await load();
  }


  function ensureLauncher() {
    if (document.getElementById("__sw_launcher__")) return;

    const button = document.createElement("button");
    button.id = "__sw_launcher__";
    button.textContent = "SW";
    button.title = "Similarweb Inspector";
    button.style.cssText = [
      "position:fixed",
      "right:14px",
      "bottom:14px",
      "width:42px",
      "height:42px",
      "border:0",
      "border-radius:50%",
      "background:#111",
      "color:#fff",
      "font:700 13px Arial,sans-serif",
      "cursor:pointer",
      "z-index:2147483646",
      "box-shadow:0 5px 18px rgba(0,0,0,.32)"
    ].join(";");

    button.addEventListener("click", () => {
      run().catch(error => console.error("[SW] launcher error", error));
    });

    document.documentElement.appendChild(button);
  }

  const swParams = new URLSearchParams(location.search);

  if (
    location.hostname === "www.similarweb.com" &&
    swParams.get("__sw_collect") === "1" &&
    swParams.get("__sw_domain") &&
    swParams.get("__sw_req")
  ) {
    collectRenderedSimilarweb(
      swParams.get("__sw_domain"),
      swParams.get("__sw_req")
    ).catch(error => {
      console.error("[SW] collector failed", error);
    });
  } else {
    ensureLauncher();
  }
})();
