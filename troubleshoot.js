(() => {
  "use strict";

  const APP_ID = "__debugr_troubleshoot_v1__";
  const existing = document.getElementById(APP_ID);
  if (existing) {
    existing.remove();
    return;
  }

  const state = {
    slots: [],
    selected: 0,
    autoRefresh: false,
    timer: null
  };

  const host = document.createElement("div");
  host.id = APP_ID;
  host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
  document.documentElement.appendChild(host);

  const root = host.attachShadow({ mode: "open" });

  root.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; }

      .panel {
        position: fixed;
        top: 14px;
        right: 14px;
        width: min(620px, calc(100vw - 28px));
        max-height: calc(100vh - 28px);
        overflow: hidden;
        pointer-events: auto;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        font-size: 13px;
        line-height: 1.4;
        color: #e9eef6;
        background: #10141b;
        border: 1px solid #2a3340;
        border-radius: 14px;
        box-shadow: 0 18px 60px rgba(0,0,0,.48);
      }

      .head {
        display:flex;
        align-items:center;
        gap:10px;
        padding:12px 14px;
        border-bottom:1px solid #27303b;
        background:#151b24;
      }

      .title {
        font-weight:800;
        font-size:15px;
        letter-spacing:.2px;
      }

      .pill {
        font-size:11px;
        padding:3px 7px;
        border-radius:999px;
        border:1px solid #364252;
        color:#b9c5d6;
      }

      .spacer {
        flex:1;
      }

      button,
      select {
        font: inherit;
      }

      button {
        border:1px solid #3a4657;
        background:#1d2530;
        color:#eaf0f7;
        border-radius:8px;
        padding:6px 9px;
        cursor:pointer;
      }

      button:hover {
        background:#263140;
      }

      button.primary {
        background:#1f5eff;
        border-color:#1f5eff;
      }

      button.danger {
        background:#3a1f25;
        border-color:#6a2f3b;
      }

      .controls {
        display:grid;
        grid-template-columns: 1fr auto auto;
        gap:8px;
        padding:10px 12px;
        border-bottom:1px solid #27303b;
        background:#111720;
      }

      select {
        width:100%;
        min-width:0;
        background:#0d1218;
        border:1px solid #364252;
        color:#e8eef7;
        border-radius:8px;
        padding:7px 9px;
      }

      .body {
        overflow:auto;
        max-height:calc(100vh - 130px);
        padding:12px;
      }

      .section {
        border:1px solid #283240;
        border-radius:10px;
        margin-bottom:10px;
        overflow:hidden;
        background:#111720;
      }

      .section h3 {
        margin:0;
        padding:8px 10px;
        font-size:12px;
        text-transform:uppercase;
        letter-spacing:.7px;
        background:#171e28;
        border-bottom:1px solid #283240;
        color:#aebbd0;
      }

      .grid {
        display:grid;
        grid-template-columns: 155px minmax(0,1fr);
      }

      .k,
      .v {
        padding:7px 9px;
        border-bottom:1px solid #222b36;
      }

      .k {
        color:#8290a4;
      }

      .v {
        color:#edf3fb;
        overflow-wrap:anywhere;
        user-select:text;
      }

      .grid > :nth-last-child(-n+2) {
        border-bottom:0;
      }

      .ok {
        color:#6ee7a8;
        font-weight:700;
      }

      .warn {
        color:#ffd479;
        font-weight:700;
      }

      .bad {
        color:#ff8383;
        font-weight:700;
      }

      .adx {
        color:#8db7ff;
        font-weight:800;
      }

      .hb {
        color:#68e1dc;
        font-weight:800;
      }

      .muted {
        color:#7f8da0;
      }

      .mono {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size:12px;
      }

      .row {
        display:flex;
        gap:8px;
        align-items:center;
        flex-wrap:wrap;
      }

      .small {
        font-size:11px;
        color:#8f9bad;
      }

      .bidtable {
        width:100%;
        border-collapse:collapse;
      }

      .bidtable th,
      .bidtable td {
        padding:7px 8px;
        border-bottom:1px solid #222b36;
        text-align:left;
        vertical-align:top;
      }

      .bidtable th {
        color:#8391a5;
        font-size:11px;
        font-weight:600;
      }

      .bidtable tr:last-child td {
        border-bottom:0;
      }

      .winnerRow {
        background:rgba(61, 207, 174, .08);
      }

      .pre {
        white-space:pre-wrap;
        word-break:break-word;
        font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size:11px;
        margin:0;
        padding:9px;
        color:#d6dfec;
        background:#0c1117;
        max-height:220px;
        overflow:auto;
      }

      .empty {
        padding:18px;
        color:#8c99aa;
        text-align:center;
      }

      .footer {
        padding:8px 12px;
        border-top:1px solid #27303b;
        display:flex;
        align-items:center;
        gap:8px;
        background:#111720;
      }

      .statusdot {
        width:7px;
        height:7px;
        border-radius:50%;
        background:#6ee7a8;
        display:inline-block;
      }

      a {
        color:#8db7ff;
        text-decoration:none;
      }

      a:hover {
        text-decoration:underline;
      }

      .copy {
        font-size:10px;
        padding:3px 6px;
      }

      @media (max-width: 620px) {
        .panel {
          top:6px;
          right:6px;
          width:calc(100vw - 12px);
          max-height:calc(100vh - 12px);
        }

        .grid {
          grid-template-columns: 120px minmax(0,1fr);
        }

        .controls {
          grid-template-columns:1fr auto;
        }

        .controls .autoBtn {
          display:none;
        }
      }
    </style>

    <div class="panel">
      <div class="head">
        <div class="title">Debugr · Troubleshooting</div>
        <div class="pill" id="slotCount">0 slots</div>
        <div class="spacer"></div>
        <button id="refreshBtn" title="Re-scan page">Refresh</button>
        <button id="closeBtn" class="danger" title="Close">×</button>
      </div>

      <div class="controls">
        <select id="slotSelect"></select>
        <button id="autoBtn" class="autoBtn">Auto: off</button>
        <button id="consoleBtn">Publisher Console</button>
      </div>

      <div class="body" id="body"></div>

      <div class="footer">
        <span class="statusdot"></span>
        <span class="small" id="foot">Ready</span>
      </div>
    </div>
  `;

  const $ = (sel) => root.querySelector(sel);
  const body = $("#body");
  const select = $("#slotSelect");

  function esc(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function json(v) {
    try {
      return JSON.stringify(v, null, 2);
    } catch (_) {
      return String(v);
    }
  }

  function fmtNum(v, digits = 4) {
    const n = Number(v);
    return Number.isFinite(n)
      ? n.toFixed(digits).replace(/\.?0+$/, "")
      : "—";
  }

  function fmtMoney(v, cur) {
    const n = Number(v);
    return Number.isFinite(n)
      ? `${fmtNum(n, 4)} ${cur || ""}`.trim()
      : "—";
  }

  function getGoogletag() {
    try {
      return window.googletag && window.googletag.apiReady
        ? window.googletag
        : null;
    } catch (_) {
      return null;
    }
  }

  function getPbjs() {
    try {
      return window.pbjs && typeof window.pbjs === "object"
        ? window.pbjs
        : null;
    } catch (_) {
      return null;
    }
  }

  function getNetworkCode(adUnitPath) {
    const m = String(adUnitPath || "").match(/^\/(\d+)\//);
    return m ? m[1] : "";
  }

  function getSlotSizes(slot) {
    try {
      const sizes = slot.getSizes ? slot.getSizes() : [];

      return sizes.map(s => {
        if (typeof s === "string") return s;

        if (
          s &&
          typeof s.getWidth === "function" &&
          typeof s.getHeight === "function"
        ) {
          return `${s.getWidth()}x${s.getHeight()}`;
        }

        return String(s);
      });
    } catch (_) {
      return [];
    }
  }

  function getTargeting(slot) {
    const out = {};

    try {
      const keys =
        typeof slot.getTargetingKeys === "function"
          ? slot.getTargetingKeys()
          : [];

      keys.forEach(k => {
        try {
          out[k] = slot.getTargeting(k);
        } catch (_) {}
      });
    } catch (_) {}

    return out;
  }

  function getPageTargeting() {
    const gt = getGoogletag();
    const out = {};

    if (!gt) return out;

    try {
      const pubads = gt.pubads();

      const keys =
        typeof pubads.getTargetingKeys === "function"
          ? pubads.getTargetingKeys()
          : [];

      keys.forEach(k => {
        try {
          out[k] = pubads.getTargeting(k);
        } catch (_) {}
      });
    } catch (_) {}

    return out;
  }

  function getResponseInfo(slot) {
    try {
      return slot &&
        typeof slot.getResponseInformation === "function"
        ? slot.getResponseInformation()
        : null;
    } catch (_) {
      return null;
    }
  }

  function normalizeBidList(resp) {
    if (!resp) return [];

    if (Array.isArray(resp)) {
      return resp;
    }

    if (Array.isArray(resp.bids)) {
      return resp.bids;
    }

    return [];
  }

  function getAllBidResponses() {
    const pb = getPbjs();

    if (!pb || typeof pb.getBidResponses !== "function") {
      return {};
    }

    try {
      return pb.getBidResponses() || {};
    } catch (_) {
      return {};
    }
  }

  function getWinningBids() {
    const pb = getPbjs();

    if (!pb) return [];

    try {
      if (typeof pb.getAllWinningBids === "function") {
        return pb.getAllWinningBids() || [];
      }

      if (typeof pb.getAllPrebidWinningBids === "function") {
        return pb.getAllPrebidWinningBids() || [];
      }
    } catch (_) {}

    return [];
  }

  function getPbEvents() {
    const pb = getPbjs();

    if (!pb || typeof pb.getEvents !== "function") {
      return [];
    }

    try {
      return pb.getEvents() || [];
    } catch (_) {
      return [];
    }
  }

  function getHbTargeting(targeting) {
    const out = {};

    Object.keys(targeting || {}).forEach(k => {
      if (/^hb_/i.test(k)) {
        out[k] = targeting[k];
      }
    });

    return out;
  }

  function firstTarget(targeting, key) {
    const val = targeting && targeting[key];

    if (Array.isArray(val)) {
      return val[0] ?? "";
    }

    return val ?? "";
  }

  function bidMatchesSlot(bid, slotData) {
    if (!bid) return false;

    const code = String(
      bid.adUnitCode ||
      bid.adUnit ||
      ""
    );

    const div = String(slotData.divId || "");
    const path = String(slotData.adUnitPath || "");

    if (
      code &&
      (
        code === div ||
        code === path
      )
    ) {
      return true;
    }

    if (
      code &&
      div &&
      (
        code.endsWith(div) ||
        div.endsWith(code)
      )
    ) {
      return true;
    }

    const hbAdId = firstTarget(
      slotData.targeting,
      "hb_adid"
    );

    if (
      hbAdId &&
      String(bid.adId || "") === String(hbAdId)
    ) {
      return true;
    }

    const bidAdId =
      bid.adserverTargeting &&
      bid.adserverTargeting.hb_adid;

    if (
      hbAdId &&
      bidAdId &&
      String(bidAdId) === String(hbAdId)
    ) {
      return true;
    }

    return false;
  }

  function findBidsForSlot(slotData) {
    const all = getAllBidResponses();
    const bids = [];

    Object.keys(all || {}).forEach(code => {
      normalizeBidList(all[code]).forEach(bid => {
        if (bidMatchesSlot(bid, slotData)) {
          bids.push(bid);
        }
      });
    });

    if (bids.length) {
      return bids;
    }

    const hbAdId = firstTarget(
      slotData.targeting,
      "hb_adid"
    );

    if (hbAdId) {
      Object.keys(all || {}).forEach(code => {
        normalizeBidList(all[code]).forEach(bid => {
          if (
            String(bid.adId || "") === String(hbAdId)
          ) {
            bids.push(bid);
          }
        });
      });
    }

    return bids;
  }

  function findWinningBidForSlot(slotData, bids) {
    const winners = getWinningBids();

    const hbAdId = firstTarget(
      slotData.targeting,
      "hb_adid"
    );

    let win = winners.find(
      b => bidMatchesSlot(b, slotData)
    );

    if (!win && hbAdId) {
      win = winners.find(b =>
        String(b.adId || "") === String(hbAdId) ||
        String(
          (b.adserverTargeting || {}).hb_adid || ""
        ) === String(hbAdId)
      );
    }

    if (!win && hbAdId) {
      win = bids.find(b =>
        String(b.adId || "") === String(hbAdId) ||
        String(
          (b.adserverTargeting || {}).hb_adid || ""
        ) === String(hbAdId)
      );
    }

    return win || null;
  }

  function queryIdFromText(text) {
    const s = String(text || "");

    const patterns = [
      /query[_\s-]?id["'=:\s]+([A-Za-z0-9_-]{12,})/i,
      /Query ID:\s*([A-Za-z0-9_-]{12,})/i
    ];

    for (const re of patterns) {
      const m = s.match(re);

      if (m) {
        return m[1];
      }
    }

    return "";
  }

  function findQueryId(slotData) {
    const candidates = [];

    try {
      performance
        .getEntriesByType("resource")
        .forEach(e => {
          candidates.push(e.name || "");
        });
    } catch (_) {}

    try {
      document
        .querySelectorAll("iframe[src], script[src], img[src]")
        .forEach(el => {
          candidates.push(el.src || "");
        });
    } catch (_) {}

    try {
      candidates.push(
        document.documentElement.innerText || ""
      );
    } catch (_) {}

    const div =
      slotData.divId
        ? document.getElementById(slotData.divId)
        : null;

    if (div) {
      try {
        candidates.push(div.innerText || "");
        candidates.push(div.innerHTML || "");

        div
          .querySelectorAll("iframe[src], script[src], img[src]")
          .forEach(el => {
            candidates.push(el.src || "");
          });
      } catch (_) {}
    }

    for (const c of candidates) {
      const q = queryIdFromText(c);

      if (q) {
        return q;
      }
    }

    return "";
  }

  function findGamRequests(slotData) {
    const entries = [];
    const adUnitPath = String(
      slotData.adUnitPath || ""
    );

    try {
      performance
        .getEntriesByType("resource")
        .forEach(e => {
          const url = String(e.name || "");

          if (
            !/gampad\/ads|pagead\/ads|securepubads\.g\.doubleclick\.net/i.test(url)
          ) {
            return;
          }

          let match = false;

          try {
            const u = new URL(url);

            const iu = decodeURIComponent(
              u.searchParams.get("iu") || ""
            );

            const prev = decodeURIComponent(
              u.searchParams.get("prev_iu_szs") || ""
            );

            const cust = decodeURIComponent(
              u.searchParams.get("cust_params") || ""
            );

            if (
              iu &&
              (
                iu === adUnitPath ||
                adUnitPath.includes(iu) ||
                iu.includes(adUnitPath)
              )
            ) {
              match = true;
            }

            if (
              cust &&
              Object.entries(
                getHbTargeting(slotData.targeting)
              ).some(([k, vals]) => {
                const arr = Array.isArray(vals)
                  ? vals
                  : [vals];

                return arr.some(v =>
                  cust.includes(`${k}=${v}`) ||
                  cust.includes(`${k}%3D${v}`)
                );
              })
            ) {
              match = true;
            }

            if (
              !match &&
              prev &&
              slotData.sizes.some(
                s => prev.includes(s)
              )
            ) {
              match = true;
            }
          } catch (_) {}

          if (match) {
            entries.push({
              url,
              startTime: e.startTime,
              duration: e.duration,
              initiatorType: e.initiatorType,
              transferSize: e.transferSize,
              encodedBodySize: e.encodedBodySize
            });
          }
        });
    } catch (_) {}

    return entries;
  }

  function parseGamRequest(url) {
    const out = {};

    try {
      const u = new URL(url);

      const wanted = [
        "iu",
        "sz",
        "prev_iu_szs",
        "correlator",
        "pvsid",
        "output",
        "impl",
        "env",
        "url",
        "ref",
        "description_url",
        "gdpr",
        "gdpr_consent",
        "gpp",
        "gpp_sid",
        "us_privacy",
        "npa",
        "tfcd",
        "cust_params"
      ];

      wanted.forEach(k => {
        if (u.searchParams.has(k)) {
          out[k] = u.searchParams.get(k);
        }
      });
    } catch (_) {}

    return out;
  }

  function winnerType(slotData, winningBid) {
    const li =
      slotData.response
        ? Number(slotData.response.lineItemId)
        : null;

    if (li === -2) {
      return {
        label: "UNFILLED",
        cls: "bad",
        reason: "GAM lineItemId = -2"
      };
    }

    if (li === -1) {
      return {
        label: "AdX",
        cls: "adx",
        reason: "GAM lineItemId = -1"
      };
    }

    if (
      Number.isFinite(li) &&
      li > 0
    ) {
      const hbKeys = Object.keys(
        slotData.hbTargeting || {}
      );

      if (
        winningBid ||
        hbKeys.length
      ) {
        return {
          label: "HEADER BIDDING / PRICE PRIORITY",
          cls: "hb",
          reason:
            winningBid
              ? "Positive GAM line item + matched Prebid winning bid"
              : "Positive GAM line item + hb_* targeting"
        };
      }

      return {
        label: "GAM LINE ITEM",
        cls: "ok",
        reason:
          "Positive GAM line item; no matched Prebid winner detected"
      };
    }

    if (!slotData.response) {
      return {
        label: "NO RESPONSE INFO",
        cls: "warn",
        reason:
          "GPT getResponseInformation() returned null"
      };
    }

    return {
      label: "UNKNOWN",
      cls: "warn",
      reason:
        "Could not classify response"
    };
  }

  function collectSlots() {
    const gt = getGoogletag();
    const pageTargeting = getPageTargeting();

    let rawSlots = [];

    if (gt) {
      try {
        rawSlots =
          gt.pubads().getSlots() || [];
      } catch (_) {}
    }

    state.slots = rawSlots.map(
      (slot, idx) => {
        const divId = (() => {
          try {
            return slot.getSlotElementId();
          } catch (_) {
            return "";
          }
        })();

        const adUnitPath = (() => {
          try {
            return slot.getAdUnitPath();
          } catch (_) {
            return "";
          }
        })();

        const targeting =
          getTargeting(slot);

        const response =
          getResponseInfo(slot);

        const sizes =
          getSlotSizes(slot);

        const el =
          divId
            ? document.getElementById(divId)
            : null;

        const data = {
          idx,
          slot,
          divId,
          adUnitPath,
          networkCode:
            getNetworkCode(adUnitPath),
          sizes,
          targeting,
          hbTargeting:
            getHbTargeting(targeting),
          pageTargeting,
          response,
          renderedSize:
            el
              ? `${Math.round(
                  el.getBoundingClientRect().width
                )}x${Math.round(
                  el.getBoundingClientRect().height
                )}`
              : "—",
          queryId: ""
        };

        data.bids =
          findBidsForSlot(data);

        data.winningBid =
          findWinningBidForSlot(
            data,
            data.bids
          );

        data.winner =
          winnerType(
            data,
            data.winningBid
          );

        data.gamRequests =
          findGamRequests(data);

        data.queryId =
          findQueryId(data);

        return data;
      }
    );

    $("#slotCount").textContent =
      `${state.slots.length} slot${
        state.slots.length === 1
          ? ""
          : "s"
      }`;

    select.innerHTML = "";

    if (!state.slots.length) {
      const opt =
        document.createElement("option");

      opt.textContent =
        "No GPT slots detected";

      opt.value = "";

      select.appendChild(opt);

      body.innerHTML = `
        <div class="empty">
          No GPT slots found on this page.
          <br><br>
          GPT API ready:
          <b>${getGoogletag() ? "yes" : "no"}</b>
          <br>
          Prebid detected:
          <b>${getPbjs() ? "yes" : "no"}</b>
        </div>
      `;

      $("#foot").textContent =
        `GPT ${getGoogletag() ? "✓" : "✕"} · ` +
        `Prebid ${getPbjs() ? "✓" : "✕"}`;

      return;
    }

    state.slots.forEach((s, i) => {
      const opt =
        document.createElement("option");

      const li =
        s.response
          ? s.response.lineItemId
          : "—";

      opt.value =
        String(i);

      opt.textContent =
        `${i + 1}. ` +
        `${s.adUnitPath || s.divId || "slot"} · ` +
        `LI ${li}`;

      select.appendChild(opt);
    });

    if (
      state.selected >=
      state.slots.length
    ) {
      state.selected = 0;
    }

    select.value =
      String(state.selected);

    renderSelected();
  }

  function kv(k, v, cls = "") {
    return `
      <div class="k">${esc(k)}</div>
      <div class="v ${cls}">${v}</div>
    `;
  }

  function copyButton(value) {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return "";
    }

    return `
      <button
        class="copy"
        data-copy="${esc(String(value))}"
      >
        Copy
      </button>
    `;
  }

  function buildTroubleshootingUrl(s) {
    if (
      !s.networkCode ||
      !s.queryId
    ) {
      return "";
    }

    return (
      `https://admanager.google.com/` +
      `${encodeURIComponent(s.networkCode)}` +
      `#troubleshooting/screenshot/query_id=` +
      `${encodeURIComponent(s.queryId)}`
    );
  }

  function getBidderName(bid) {
    return bid
      ? (
          bid.bidder ||
          bid.bidderCode ||
          "—"
        )
      : "—";
  }

  function getBidPb(bid) {
    if (!bid) return "";

    const ast =
      bid.adserverTargeting || {};

    return (
      ast.hb_pb ||
      bid.pbCg ||
      bid.pbAg ||
      bid.pbDg ||
      bid.pbHg ||
      bid.pbMg ||
      bid.pbLg ||
      ""
    );
  }

  function renderSelected() {
    const s =
      state.slots[state.selected];

    if (!s) return;

    const r =
      s.response || {};

    const wb =
      s.winningBid;

    const trUrl =
      buildTroubleshootingUrl(s);

    const topBid =
      [...s.bids]
        .sort(
          (a, b) =>
            Number(b.cpm || 0) -
            Number(a.cpm || 0)
        )[0] || null;

    const queryHtml =
      s.queryId
        ? `
          ${esc(s.queryId)}
          ${copyButton(s.queryId)}
          <br>
          <a
            href="${esc(trUrl)}"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open in GAM Troubleshooting ↗
          </a>
        `
        : `
          <span class="muted">
            Not exposed by public GPT API / not found in page resources
          </span>
        `;

    const responseRows = [
      kv(
        "Winner",
        `<span class="${s.winner.cls}">
          ${esc(s.winner.label)}
        </span>`
      ),

      kv(
        "Classification",
        esc(s.winner.reason)
      ),

      kv(
        "Line item ID",
        `${esc(
          r.lineItemId ?? "—"
        )} ${copyButton(
          r.lineItemId
        )}`,
        Number(r.lineItemId) === -2
          ? "bad"
          : Number(r.lineItemId) === -1
            ? "adx"
            : ""
      ),

      kv(
        "Creative ID",
        `${esc(
          r.creativeId ?? "—"
        )} ${copyButton(
          r.creativeId
        )}`
      ),

      kv(
        "Advertiser ID",
        `${esc(
          r.advertiserId ?? "—"
        )} ${copyButton(
          r.advertiserId
        )}`
      ),

      kv(
        "Campaign ID",
        `${esc(
          r.campaignId ?? "—"
        )} ${copyButton(
          r.campaignId
        )}`
      ),

      kv(
        "Creative template",
        esc(
          r.creativeTemplateId ?? "—"
        )
      ),

      kv(
        "Query ID",
        queryHtml
      )
    ].join("");

    const slotRows = [
      kv(
        "Ad unit",
        `${esc(
          s.adUnitPath
        )} ${copyButton(
          s.adUnitPath
        )}`
      ),

      kv(
        "DIV",
        `${esc(
          s.divId
        )} ${copyButton(
          s.divId
        )}`
      ),

      kv(
        "Network",
        esc(
          s.networkCode || "—"
        )
      ),

      kv(
        "Configured sizes",
        esc(
          s.sizes.join(", ") || "—"
        )
      ),

      kv(
        "DOM box",
        esc(
          s.renderedSize
        )
      ),

      kv(
        "GPT response",
        s.response
          ? `<span class="ok">available</span>`
          : `<span class="warn">null</span>`
      )
    ].join("");

    let hbRows = "";

    if (getPbjs()) {
      hbRows += kv(
        "Prebid",
        `<span class="ok">detected</span>`
      );

      hbRows += kv(
        "Matched bids",
        esc(
          s.bids.length
        )
      );

      hbRows += kv(
        "Matched winner",
        wb
          ? `<span class="hb">
              ${esc(
                getBidderName(wb)
              )}
            </span>`
          : `<span class="muted">
              none
            </span>`
      );

      hbRows += kv(
        "Winning exact CPM",
        wb
          ? esc(
              fmtMoney(
                wb.cpm,
                wb.currency
              )
            )
          : "—"
      );

      hbRows += kv(
        "Winning GAM bucket",
        wb
          ? esc(
              getBidPb(wb) ||
              "—"
            )
          : "—"
      );

      hbRows += kv(
        "Best returned bid",
        topBid
          ? `${esc(
              getBidderName(topBid)
            )} · ${esc(
              fmtMoney(
                topBid.cpm,
                topBid.currency
              )
            )}`
          : "—"
      );

      hbRows += kv(
        "hb_bidder",
        esc(
          firstTarget(
            s.targeting,
            "hb_bidder"
          ) || "—"
        )
      );

      hbRows += kv(
        "hb_pb",
        esc(
          firstTarget(
            s.targeting,
            "hb_pb"
          ) || "—"
        )
      );

      hbRows += kv(
        "hb_adid",
        esc(
          firstTarget(
            s.targeting,
            "hb_adid"
          ) || "—"
        )
      );

      hbRows += kv(
        "hb_size",
        esc(
          firstTarget(
            s.targeting,
            "hb_size"
          ) || "—"
        )
      );

      hbRows += kv(
        "hb_format",
        esc(
          firstTarget(
            s.targeting,
            "hb_format"
          ) || "—"
        )
      );

      hbRows += kv(
        "hb_source",
        esc(
          firstTarget(
            s.targeting,
            "hb_source"
          ) || "—"
        )
      );
    } else {
      hbRows = kv(
        "Prebid",
        `<span class="muted">
          not detected
        </span>`
      );
    }

    let bidTable = `
      <div class="empty">
        No matching Prebid bids found for this slot.
      </div>
    `;

    if (s.bids.length) {
      const winnerAdId =
        wb
          ? String(wb.adId || "")
          : "";

      const rows =
        [...s.bids]
          .sort(
            (a, b) =>
              Number(b.cpm || 0) -
              Number(a.cpm || 0)
          )
          .map(b => {
            const isWin =
              winnerAdId &&
              String(b.adId || "") ===
              winnerAdId;

            const meta =
              b.meta || {};

            const adv =
              Array.isArray(
                meta.advertiserDomains
              )
                ? meta.advertiserDomains.join(", ")
                : (
                    meta.advertiserName ||
                    ""
                  );

            return `
              <tr class="${
                isWin
                  ? "winnerRow"
                  : ""
              }">
                <td>
                  ${
                    isWin
                      ? "★ "
                      : ""
                  }
                  ${esc(
                    getBidderName(b)
                  )}
                </td>

                <td>
                  ${esc(
                    fmtMoney(
                      b.cpm,
                      b.currency
                    )
                  )}
                </td>

                <td>
                  ${esc(
                    getBidPb(b) ||
                    "—"
                  )}
                </td>

                <td>
                  ${esc(
                    b.timeToRespond ??
                    "—"
                  )}${
                    b.timeToRespond != null
                      ? " ms"
                      : ""
                  }
                </td>

                <td>
                  ${esc(
                    b.size ||
                    (
                      b.width &&
                      b.height
                        ? `${b.width}x${b.height}`
                        : "—"
                    )
                  )}
                </td>

                <td>
                  ${esc(
                    adv || "—"
                  )}
                </td>
              </tr>
            `;
          })
          .join("");

      bidTable = `
        <table class="bidtable">
          <thead>
            <tr>
              <th>Bidder</th>
              <th>CPM</th>
              <th>Bucket</th>
              <th>RTT</th>
              <th>Size</th>
              <th>Advertiser</th>
            </tr>
          </thead>

          <tbody>
            ${rows}
          </tbody>
        </table>
      `;
    }

    const hbTargetText =
      Object.keys(
        s.hbTargeting
      ).length
        ? json(
            s.hbTargeting
          )
        : "No hb_* keys on slot.";

    const allTargetText =
      json(
        s.targeting
      );

    const pageTargetText =
      json(
        s.pageTargeting
      );

    let requestHtml = `
      <div class="empty">
        No matching GAM request found in PerformanceResourceTiming.
      </div>
    `;

    if (s.gamRequests.length) {
      requestHtml =
        s.gamRequests
          .map((req, i) => {
            const parsed =
              parseGamRequest(
                req.url
              );

            return `
              <div
                style="
                  border-bottom:
                  1px solid #27303b
                "
              >
                <div class="grid">
                  ${kv(
                    `Request ${i + 1}`,
                    `<span class="mono">
                      ${esc(
                        Math.round(
                          req.duration
                        )
                      )} ms
                    </span>`
                  )}

                  ${kv(
                    "Start",
                    `<span class="mono">
                      ${esc(
                        Math.round(
                          req.startTime
                        )
                      )} ms
                    </span>`
                  )}

                  ${kv(
                    "Transfer",
                    `<span class="mono">
                      ${esc(
                        req.transferSize ??
                        "—"
                      )} B
                    </span>`
                  )}
                </div>

                <pre class="pre">${
                  esc(
                    json(parsed)
                  )
                }</pre>
              </div>
            `;
          })
          .join("");
    }

    const eventData =
      getPbEvents();

    const relatedEvents =
      eventData.filter(e => {
        try {
          const a =
            e.args || {};

          const code =
            String(
              a.adUnitCode ||
              a.adUnit ||
              a.code ||
              e.id ||
              ""
            );

          if (
            code &&
            (
              code === s.divId ||
              code === s.adUnitPath
            )
          ) {
            return true;
          }

          if (
            wb &&
            a.adId &&
            String(a.adId) ===
            String(wb.adId)
          ) {
            return true;
          }
        } catch (_) {}

        return false;
      });

    body.innerHTML = `
      <div class="section">
        <h3>Slot</h3>
        <div class="grid">
          ${slotRows}
        </div>
      </div>

      <div class="section">
        <h3>GAM result</h3>
        <div class="grid">
          ${responseRows}
        </div>
      </div>

      <div class="section">
        <h3>Header bidding</h3>
        <div class="grid">
          ${hbRows}
        </div>
      </div>

      <div class="section">
        <h3>Prebid bids</h3>
        ${bidTable}
      </div>

      <div class="section">
        <h3>
          HB targeting sent to slot
        </h3>

        <pre class="pre">${
          esc(
            hbTargetText
          )
        }</pre>
      </div>

      <div class="section">
        <h3>
          All slot targeting
        </h3>

        <pre class="pre">${
          esc(
            allTargetText
          )
        }</pre>
      </div>

      <div class="section">
        <h3>
          Page targeting
        </h3>

        <pre class="pre">${
          esc(
            pageTargetText
          )
        }</pre>
      </div>

      <div class="section">
        <h3>
          Matched GAM network requests
        </h3>

        ${requestHtml}
      </div>

      <div class="section">
        <h3>
          Related Prebid events
        </h3>

        <pre class="pre">${
          esc(
            relatedEvents.length
              ? json(
                  relatedEvents
                )
              : "No directly matched Prebid events."
          )
        }</pre>
      </div>
    `;

    body
      .querySelectorAll(
        "[data-copy]"
      )
      .forEach(btn => {
        btn.addEventListener(
          "click",
          async () => {
            const value =
              btn.getAttribute(
                "data-copy"
              ) || "";

            try {
              await navigator.clipboard.writeText(
                value
              );

              const old =
                btn.textContent;

              btn.textContent =
                "Copied";

              setTimeout(
                () => {
                  btn.textContent =
                    old;
                },
                900
              );
            } catch (_) {
              const ta =
                document.createElement(
                  "textarea"
                );

              ta.value =
                value;

              document.body.appendChild(
                ta
              );

              ta.select();

              document.execCommand(
                "copy"
              );

              ta.remove();
            }
          }
        );
      });

    $("#foot").textContent =
      `GPT ${getGoogletag() ? "✓" : "✕"} · ` +
      `Prebid ${getPbjs() ? "✓" : "✕"} · ` +
      `${s.gamRequests.length} GAM request${
        s.gamRequests.length === 1
          ? ""
          : "s"
      } matched`;
  }

  function refresh() {
    const previousDiv =
      state.slots[
        state.selected
      ]?.divId || "";

    collectSlots();

    if (
      previousDiv &&
      state.slots.length
    ) {
      const idx =
        state.slots.findIndex(
          s =>
            s.divId ===
            previousDiv
        );

      if (idx >= 0) {
        state.selected =
          idx;

        select.value =
          String(idx);

        renderSelected();
      }
    }
  }

  select.addEventListener(
    "change",
    () => {
      state.selected =
        Number(
          select.value
        ) || 0;

      renderSelected();
    }
  );

  $("#refreshBtn").addEventListener(
    "click",
    refresh
  );

  $("#autoBtn").addEventListener(
    "click",
    () => {
      state.autoRefresh =
        !state.autoRefresh;

      $("#autoBtn").textContent =
        `Auto: ${
          state.autoRefresh
            ? "on"
            : "off"
        }`;

      if (state.timer) {
        clearInterval(
          state.timer
        );

        state.timer =
          null;
      }

      if (state.autoRefresh) {
        state.timer =
          setInterval(
            refresh,
            2000
          );
      }
    }
  );

  $("#consoleBtn").addEventListener(
    "click",
    () => {
      const gt =
        getGoogletag();

      if (
        gt &&
        typeof gt.openConsole ===
        "function"
      ) {
        try {
          gt.openConsole();
        } catch (_) {}
      }
    }
  );

  $("#closeBtn").addEventListener(
    "click",
    () => {
      if (state.timer) {
        clearInterval(
          state.timer
        );
      }

      host.remove();
    }
  );

  try {
    const gt =
      getGoogletag();

    if (
      gt &&
      gt.pubads &&
      typeof gt.pubads().addEventListener ===
      "function"
    ) {
      [
        "slotRequested",
        "slotResponseReceived",
        "slotRenderEnded"
      ].forEach(eventName => {
        try {
          gt
            .pubads()
            .addEventListener(
              eventName,
              () => {
                if (
                  state.autoRefresh
                ) {
                  refresh();
                }
              }
            );
        } catch (_) {}
      });
    }
  } catch (_) {}

  collectSlots();
})();
