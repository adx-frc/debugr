(() => {
  "use strict";

  const APP_ID = "__debugr_troubleshooting__";

  const old = document.getElementById(APP_ID);
  if (old) {
    old.remove();
    return;
  }

  const state = {
    slots: [],
    selected: 0,
    showIgnored: false,
    ignored: [],
    timer: null,
    auto: false
  };

  const host = document.createElement("div");
  host.id = APP_ID;
  host.style.cssText =
    "all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;";

  document.documentElement.appendChild(host);

  const root = host.attachShadow({ mode: "open" });

  root.innerHTML = `
    <style>
      :host {
        all: initial;
      }

      * {
        box-sizing: border-box;
      }

      .panel {
        position: fixed;
        top: 12px;
        right: 12px;
        width: min(640px, calc(100vw - 24px));
        max-height: calc(100vh - 24px);
        overflow: hidden;
        pointer-events: auto;
        font-family:
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          Roboto,
          Arial,
          sans-serif;
        font-size: 13px;
        line-height: 1.4;
        color: #edf3fb;
        background: #0f151e;
        border: 1px solid #344051;
        border-radius: 14px;
        box-shadow: 0 18px 60px rgba(0,0,0,.55);
      }

      .header {
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 11px 12px;
        background: #161e29;
        border-bottom: 1px solid #303b49;
      }

      .title {
        font-size: 15px;
        font-weight: 800;
      }

      .pill {
        border: 1px solid #425066;
        border-radius: 999px;
        padding: 2px 7px;
        font-size: 11px;
        color: #bac6d7;
      }

      .spacer {
        flex: 1;
      }

      button,
      select {
        font: inherit;
      }

      button {
        cursor: pointer;
        color: #edf3fb;
        background: #1c2633;
        border: 1px solid #415066;
        border-radius: 8px;
        padding: 6px 9px;
      }

      button:hover {
        background: #263345;
      }

      .danger {
        background: #3b1e25;
        border-color: #71303d;
      }

      .copy-json {
        background: #173c32;
        border-color: #2d725e;
      }

      .copy-json:hover {
        background: #205345;
      }

      .controls {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 8px;
        padding: 9px 10px;
        background: #111923;
        border-bottom: 1px solid #303b49;
      }

      select {
        width: 100%;
        min-width: 0;
        padding: 7px 9px;
        color: #edf3fb;
        background: #0b1119;
        border: 1px solid #3a485c;
        border-radius: 8px;
      }

      .subcontrols {
        display: flex;
        gap: 7px;
        padding: 0 10px 9px 10px;
        background: #111923;
        border-bottom: 1px solid #303b49;
        flex-wrap: wrap;
      }

      .body {
        overflow: auto;
        max-height: calc(100vh - 162px);
        padding: 10px;
      }

      .section {
        margin-bottom: 10px;
        overflow: hidden;
        background: #111923;
        border: 1px solid #2d3948;
        border-radius: 10px;
      }

      .section-title {
        padding: 7px 10px;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: .7px;
        text-transform: uppercase;
        color: #aab9cc;
        background: #18212d;
        border-bottom: 1px solid #2d3948;
      }

      .grid {
        display: grid;
        grid-template-columns: 158px minmax(0,1fr);
      }

      .k,
      .v {
        padding: 7px 9px;
        border-bottom: 1px solid #263241;
      }

      .k {
        color: #8fa0b5;
      }

      .v {
        color: #eef4fb;
        overflow-wrap: anywhere;
        user-select: text;
      }

      .grid > .k:nth-last-child(-n+2),
      .grid > .v:nth-last-child(-n+2) {
        border-bottom: none;
      }

      .yes {
        color: #63e6a1;
        font-weight: 750;
      }

      .no {
        color: #ff7f87;
        font-weight: 750;
      }

      .warn {
        color: #ffd06b;
        font-weight: 750;
      }

      .adx {
        color: #83b5ff;
        font-weight: 800;
      }

      .hb {
        color: #66ded8;
        font-weight: 800;
      }

      .muted {
        color: #7f8da0;
      }

      .mono {
        font-family:
          ui-monospace,
          SFMono-Regular,
          Menlo,
          Monaco,
          Consolas,
          monospace;
      }

      .bidtable {
        width: 100%;
        border-collapse: collapse;
      }

      .bidtable th,
      .bidtable td {
        padding: 7px 8px;
        text-align: left;
        vertical-align: top;
        border-bottom: 1px solid #253140;
      }

      .bidtable th {
        color: #8fa0b5;
        font-size: 11px;
        font-weight: 650;
      }

      .bidtable tr:last-child td {
        border-bottom: none;
      }

      .winner-row {
        background: rgba(53, 201, 175, .09);
      }

      .copy {
        padding: 2px 6px;
        margin-left: 5px;
        font-size: 10px;
      }

      .link {
        color: #83b5ff;
        text-decoration: none;
      }

      .link:hover {
        text-decoration: underline;
      }

      .empty {
        padding: 14px;
        text-align: center;
        color: #8594a8;
      }

      details {
        background: #0c1219;
      }

      summary {
        cursor: pointer;
        padding: 9px 10px;
        font-weight: 700;
        color: #adb9ca;
        background: #18212d;
      }

      pre {
        margin: 0;
        padding: 10px;
        max-height: 320px;
        overflow: auto;
        white-space: pre-wrap;
        word-break: break-word;
        color: #d8e0eb;
        font-family:
          ui-monospace,
          SFMono-Regular,
          Menlo,
          Monaco,
          Consolas,
          monospace;
        font-size: 11px;
      }

      .ignored {
        padding: 8px 10px;
        color: #8594a8;
        font-size: 11px;
      }

      .footer {
        padding: 7px 10px;
        border-top: 1px solid #303b49;
        color: #8797aa;
        font-size: 11px;
        background: #111923;
      }

      @media (max-width: 650px) {
        .panel {
          top: 5px;
          right: 5px;
          width: calc(100vw - 10px);
          max-height: calc(100vh - 10px);
        }

        .grid {
          grid-template-columns: 125px minmax(0,1fr);
        }

        .body {
          max-height: calc(100vh - 170px);
        }
      }
    </style>

    <div class="panel">
      <div class="header">
        <div class="title">Debugr · Troubleshooting</div>
        <div class="pill" id="slotCount">0 slots</div>

        <div class="spacer"></div>

        <button id="refreshBtn">Refresh</button>
        <button id="closeBtn" class="danger">×</button>
      </div>

      <div class="controls">
        <select id="slotSelect"></select>
        <button id="autoBtn">Auto: off</button>
      </div>

      <div class="subcontrols">
        <button id="copyJsonBtn" class="copy-json">Copy JSON</button>
        <button id="ignoredBtn">Ignored: 0</button>
        <button id="consoleBtn">Publisher Console</button>
      </div>

      <div class="body" id="body"></div>

      <div class="footer" id="footer">Ready</div>
    </div>
  `;

  const $ = selector => root.querySelector(selector);

  const body = $("#body");
  const select = $("#slotSelect");

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function stringify(value) {
    try {
      return JSON.stringify(value, null, 2);
    } catch (_) {
      return String(value);
    }
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
      <button class="copy" data-copy="${esc(String(value))}">
        Copy
      </button>
    `;
  }

  function kv(key, value, cls = "") {
    return `
      <div class="k">${esc(key)}</div>
      <div class="v ${cls}">${value}</div>
    `;
  }

  function yesNo(value) {
    if (value === true) {
      return `<span class="yes">YES</span>`;
    }

    if (value === false) {
      return `<span class="no">NO</span>`;
    }

    return `<span class="muted">UNKNOWN</span>`;
  }

  function safeNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function money(value, currency = "USD") {
    const n = safeNumber(value);

    if (n === null) {
      return "—";
    }

    let out;

    if (n >= 1) {
      out = n.toFixed(2);
    } else if (n >= 0.01) {
      out = n
        .toFixed(3)
        .replace(/0+$/, "")
        .replace(/\.$/, "");
    } else {
      out = n
        .toFixed(4)
        .replace(/0+$/, "")
        .replace(/\.$/, "");
    }

    return `${out} ${currency || ""}`.trim();
  }

  function getGoogletag() {
    try {
      if (
        window.googletag &&
        window.googletag.apiReady
      ) {
        return window.googletag;
      }
    } catch (_) {}

    return null;
  }

  function getPbjs() {
    try {
      if (
        window.pbjs &&
        typeof window.pbjs === "object"
      ) {
        return window.pbjs;
      }
    } catch (_) {}

    return null;
  }

  function getNetworkCode(adUnitPath) {
    const match = String(adUnitPath || "")
      .match(/^\/(\d+)\//);

    return match ? match[1] : "";
  }

  function getSlotDivId(slot) {
    try {
      return slot.getSlotElementId() || "";
    } catch (_) {
      return "";
    }
  }

  function getAdUnitPath(slot) {
    try {
      return slot.getAdUnitPath() || "";
    } catch (_) {
      return "";
    }
  }

  function isOutOfPage(slot, adUnitPath, divId) {
    try {
      if (
        typeof slot.getOutOfPage === "function" &&
        slot.getOutOfPage()
      ) {
        return true;
      }
    } catch (_) {}

    const text =
      `${adUnitPath || ""} ${divId || ""}`.toLowerCase();

    if (
      /\b(interstitial|anchor|rewarded|out[-_ ]?of[-_ ]?page|oop)\b/.test(text)
    ) {
      return true;
    }

    try {
      if (
        !divId &&
        typeof slot.getSlotElementId === "function"
      ) {
        const targeting = getTargeting(slot);

        const format =
          firstTarget(targeting, "format") ||
          firstTarget(targeting, "ad_format") ||
          firstTarget(targeting, "google_ad_format");

        if (
          /interstitial|anchor|rewarded/i.test(
            String(format || "")
          )
        ) {
          return true;
        }
      }
    } catch (_) {}

    return false;
  }

  function getSlotSizes(slot) {
    try {
      const sizes =
        typeof slot.getSizes === "function"
          ? slot.getSizes()
          : [];

      return sizes.map(size => {
        if (typeof size === "string") {
          return size;
        }

        if (
          size &&
          typeof size.getWidth === "function" &&
          typeof size.getHeight === "function"
        ) {
          return `${size.getWidth()}x${size.getHeight()}`;
        }

        return String(size);
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

      keys.forEach(key => {
        try {
          out[key] = slot.getTargeting(key);
        } catch (_) {}
      });
    } catch (_) {}

    return out;
  }

  function getPageTargeting() {
    const gt = getGoogletag();
    const out = {};

    if (!gt) {
      return out;
    }

    try {
      const pubads = gt.pubads();

      const keys =
        typeof pubads.getTargetingKeys === "function"
          ? pubads.getTargetingKeys()
          : [];

      keys.forEach(key => {
        try {
          out[key] = pubads.getTargeting(key);
        } catch (_) {}
      });
    } catch (_) {}

    return out;
  }

  function getResponseInfo(slot) {
    try {
      if (
        slot &&
        typeof slot.getResponseInformation === "function"
      ) {
        return slot.getResponseInformation();
      }
    } catch (_) {}

    return null;
  }

  function firstTarget(targeting, key) {
    const value =
      targeting &&
      targeting[key];

    if (Array.isArray(value)) {
      return value.length
        ? value[0]
        : "";
    }

    return value ?? "";
  }

  function parseNestedParams(raw) {
    const out = {};

    if (!raw) {
      return out;
    }

    let decoded = String(raw);

    for (let i = 0; i < 3; i++) {
      try {
        const next = decodeURIComponent(decoded);

        if (next === decoded) {
          break;
        }

        decoded = next;
      } catch (_) {
        break;
      }
    }

    decoded
      .replace(/^\?/, "")
      .split("&")
      .forEach(part => {
        if (!part) {
          return;
        }

        const eq = part.indexOf("=");

        let key;
        let value;

        if (eq === -1) {
          key = part;
          value = "";
        } else {
          key = part.slice(0, eq);
          value = part.slice(eq + 1);
        }

        try {
          key = decodeURIComponent(key);
        } catch (_) {}

        try {
          value = decodeURIComponent(value);
        } catch (_) {}

        if (key) {
          out[key] = value;
        }
      });

    return out;
  }

  function getPerformanceResources() {
    try {
      return performance
        .getEntriesByType("resource")
        .map(entry => ({
          url: String(entry.name || ""),
          startTime: entry.startTime || 0,
          duration: entry.duration || 0,
          transferSize: entry.transferSize || 0
        }));
    } catch (_) {
      return [];
    }
  }

  function isGamRequestUrl(url) {
    return (
      /(?:securepubads|pagead2|googleads)\.(?:g\.doubleclick|googlesyndication)\.com/i.test(
        url
      ) &&
      /\/gampad\/ads|\/pagead\/ads/i.test(url)
    );
  }

  function parseGamRequest(url) {
    const out = {
      url,
      params: {},
      prevScp: {},
      custParams: {}
    };

    try {
      const parsed = new URL(url);

      parsed.searchParams.forEach((value, key) => {
        out.params[key] = value;
      });

      out.prevScp =
        parseNestedParams(
          out.params.prev_scp || ""
        );

      out.custParams =
        parseNestedParams(
          out.params.cust_params || ""
        );
    } catch (_) {}

    return out;
  }

  function getRequestAdUnitPath(parsed) {
    const p = parsed.params || {};

    if (p.iu) {
      return decodeURIComponent(p.iu);
    }

    if (p.iu_parts) {
      const parts =
        String(p.iu_parts)
          .split(",")
          .filter(Boolean);

      if (parts.length) {
        return "/" + parts.join("/");
      }
    }

    return "";
  }

  function requestMatchesSlot(parsed, slotData) {
    const p = parsed.params || {};
    const prev = parsed.prevScp || {};

    const divId =
      String(slotData.divId || "");

    const path =
      String(slotData.adUnitPath || "");

    if (
      divId &&
      p.dids &&
      String(p.dids)
        .split(",")
        .includes(divId)
    ) {
      return {
        matched: true,
        score: 100,
        reason: "dids exact DIV match"
      };
    }

    if (
      divId &&
      prev.hb_div_id === divId
    ) {
      return {
        matched: true,
        score: 95,
        reason: "prev_scp hb_div_id exact match"
      };
    }

    const requestPath =
      getRequestAdUnitPath(parsed);

    if (
      requestPath &&
      path &&
      requestPath === path
    ) {
      return {
        matched: true,
        score: 90,
        reason: "exact ad unit path match"
      };
    }

    if (
      requestPath &&
      path &&
      (
        requestPath.endsWith(path) ||
        path.endsWith(requestPath)
      )
    ) {
      return {
        matched: true,
        score: 70,
        reason: "ad unit path suffix match"
      };
    }

    return {
      matched: false,
      score: 0,
      reason: ""
    };
  }

  function findGamRequests(slotData) {
    return getPerformanceResources()
      .filter(resource =>
        isGamRequestUrl(resource.url)
      )
      .map(resource => {
        const parsed =
          parseGamRequest(resource.url);

        const match =
          requestMatchesSlot(
            parsed,
            slotData
          );

        return {
          ...resource,
          parsed,
          match
        };
      })
      .filter(item => item.match.matched)
      .sort((a, b) => {
        if (
          b.match.score !==
          a.match.score
        ) {
          return (
            b.match.score -
            a.match.score
          );
        }

        return (
          b.startTime -
          a.startTime
        );
      });
  }

  function getBestGamRequest(slotData) {
    const requests =
      findGamRequests(slotData);

    return requests.length
      ? requests[0]
      : null;
  }

  function getHbFromRequest(request) {
    if (
      !request ||
      !request.parsed
    ) {
      return null;
    }

    const p =
      request.parsed.params || {};

    const prev =
      request.parsed.prevScp || {};

    const cust =
      request.parsed.custParams || {};

    const get = key => {
      if (
        prev[key] !== undefined &&
        prev[key] !== ""
      ) {
        return prev[key];
      }

      if (
        p[key] !== undefined &&
        p[key] !== ""
      ) {
        return p[key];
      }

      if (
        cust[key] !== undefined &&
        cust[key] !== ""
      ) {
        return cust[key];
      }

      return "";
    };

    const bidder =
      get("hb_bidder");

    const bucket =
      get("hb_pb");

    const adId =
      get("hb_adid");

    const size =
      get("hb_size");

    const format =
      get("hb_format");

    const version =
      get("hb_ver");

    const divId =
      get("hb_div_id");

    const siteId =
      get("hb_site_id");

    const buyerId =
      get("hb_buyer_id");

    const overrideId =
      get("hb_override_id");

    const requestId =
      get("hb_r_id");

    const rfBid =
      get("hb_rfBid");

    const strategy =
      cust.hb_strategy ||
      get("hb_strategy");

    const vmhbmp =
      get("is_vmhbmp");

    const detected = Boolean(
      bidder ||
      bucket ||
      adId ||
      size ||
      format ||
      version ||
      divId ||
      siteId ||
      buyerId ||
      overrideId ||
      requestId ||
      rfBid ||
      vmhbmp ||
      strategy
    );

    if (!detected) {
      return null;
    }

    return {
      detected: true,
      bidder,
      bucket,
      adId,
      size,
      format,
      version,
      divId,
      siteId,
      buyerId,
      overrideId,
      requestId,
      rfBid,
      strategy,
      vmhbmp
    };
  }

  function normalizePbResponseObject(raw) {
    const bids = [];

    if (!raw) {
      return bids;
    }

    if (Array.isArray(raw)) {
      raw.forEach(item => {
        if (
          item &&
          typeof item === "object"
        ) {
          bids.push(item);
        }
      });

      return bids;
    }

    if (
      raw &&
      Array.isArray(raw.bids)
    ) {
      raw.bids.forEach(item => {
        if (
          item &&
          typeof item === "object"
        ) {
          bids.push(item);
        }
      });
    }

    return bids;
  }

  function getPbjsBids() {
    const pbjs = getPbjs();
    const bids = [];

    if (!pbjs) {
      return bids;
    }

    try {
      if (
        typeof pbjs.getBidResponses ===
        "function"
      ) {
        const responses =
          pbjs.getBidResponses() || {};

        Object.keys(responses)
          .forEach(adUnitCode => {
            normalizePbResponseObject(
              responses[adUnitCode]
            ).forEach(bid => {
              bids.push({
                ...bid,
                __source: "pbjs",
                __adUnitCode:
                  bid.adUnitCode ||
                  adUnitCode
              });
            });
          });
      }
    } catch (_) {}

    return bids;
  }

  function getPbjsWinningBids() {
    const pbjs = getPbjs();

    if (!pbjs) {
      return [];
    }

    try {
      if (
        typeof pbjs.getAllWinningBids ===
        "function"
      ) {
        return (
          pbjs.getAllWinningBids() || []
        );
      }
    } catch (_) {}

    try {
      if (
        typeof pbjs.getAllPrebidWinningBids ===
        "function"
      ) {
        return (
          pbjs.getAllPrebidWinningBids() ||
          []
        );
      }
    } catch (_) {}

    return [];
  }

  function looksLikeBidObject(obj) {
    if (
      !obj ||
      typeof obj !== "object"
    ) {
      return false;
    }

    let bidder = "";
    let cpm = null;

    try {
      bidder =
        obj.bidder ||
        obj.bidderCode ||
        obj.bidderName ||
        obj.ssp ||
        obj.partner ||
        "";

      cpm =
        obj.cpm ??
        obj.price ??
        obj.bidPrice ??
        obj.bid ??
        null;
    } catch (_) {
      return false;
    }

    return (
      Boolean(bidder) &&
      safeNumber(cpm) !== null
    );
  }

  function normalizeRuntimeBid(obj, sourceName) {
    let bidder = "";
    let cpm = null;
    let currency = "USD";
    let adUnitCode = "";
    let size = "";
    let adId = "";
    let responseTime = null;
    let status = "";

    try {
      bidder =
        obj.bidder ||
        obj.bidderCode ||
        obj.bidderName ||
        obj.ssp ||
        obj.partner ||
        "";

      cpm =
        obj.cpm ??
        obj.price ??
        obj.bidPrice ??
        obj.bid ??
        null;

      currency =
        obj.currency ||
        obj.cur ||
        "USD";

      adUnitCode =
        obj.adUnitCode ||
        obj.adunitCode ||
        obj.adUnit ||
        obj.slotId ||
        obj.divId ||
        "";

      size =
        obj.size ||
        (
          obj.width &&
          obj.height
            ? `${obj.width}x${obj.height}`
            : ""
        );

      adId =
        obj.adId ||
        obj.adid ||
        obj.bidId ||
        obj.requestId ||
        "";

      responseTime =
        obj.timeToRespond ??
        obj.responseTime ??
        obj.latency ??
        null;

      status =
        obj.status ||
        obj.statusMessage ||
        "";
    } catch (_) {}

    return {
      bidder: String(bidder || ""),
      cpm: safeNumber(cpm),
      currency: String(currency || "USD"),
      adUnitCode: String(adUnitCode || ""),
      size: String(size || ""),
      adId: String(adId || ""),
      responseTime:
        safeNumber(responseTime),
      status: String(status || ""),
      __source: sourceName
    };
  }

  function discoverRuntimeBids() {
    const found = [];
    const seen = new WeakSet();

    let globalNames = [];

    try {
      globalNames =
        Object.getOwnPropertyNames(window);
    } catch (_) {
      return found;
    }

    const likelyNames =
      globalNames.filter(name =>
        /bid|header|auction|prebid|hb|bmt|monet|adtech|ssp|wrapper/i.test(
          name
        )
      );

    const namesToInspect =
      [...new Set(likelyNames)]
        .slice(0, 100);

    const inspect = (
      value,
      sourceName,
      depth
    ) => {
      if (
        value === null ||
        value === undefined
      ) {
        return;
      }

      if (
        typeof value !== "object"
      ) {
        return;
      }

      if (seen.has(value)) {
        return;
      }

      seen.add(value);

      if (looksLikeBidObject(value)) {
        const bid =
          normalizeRuntimeBid(
            value,
            sourceName
          );

        if (
          bid.bidder &&
          bid.cpm !== null
        ) {
          found.push(bid);
        }
      }

      if (depth >= 3) {
        return;
      }

      if (Array.isArray(value)) {
        const limit =
          Math.min(value.length, 100);

        for (
          let i = 0;
          i < limit;
          i++
        ) {
          try {
            inspect(
              value[i],
              sourceName,
              depth + 1
            );
          } catch (_) {}
        }

        return;
      }

      let keys = [];

      try {
        keys =
          Object.keys(value)
            .slice(0, 100);
      } catch (_) {
        return;
      }

      keys.forEach(key => {
        if (
          /^__react|^webkit|^ownerDocument$/i.test(
            key
          )
        ) {
          return;
        }

        let child;

        try {
          child = value[key];
        } catch (_) {
          return;
        }

        inspect(
          child,
          `${sourceName}.${key}`,
          depth + 1
        );
      });
    };

    namesToInspect.forEach(name => {
      try {
        inspect(
          window[name],
          `window.${name}`,
          0
        );
      } catch (_) {}
    });

    const unique = [];
    const uniqueKeys = new Set();

    found.forEach(bid => {
      const key = [
        bid.bidder,
        bid.cpm,
        bid.currency,
        bid.adUnitCode,
        bid.adId
      ].join("|");

      if (!uniqueKeys.has(key)) {
        uniqueKeys.add(key);
        unique.push(bid);
      }
    });

    return unique;
  }

  function bidMatchesSlot(
    bid,
    slotData
  ) {
    if (!bid) {
      return false;
    }

    const code =
      String(
        bid.adUnitCode ||
        bid.__adUnitCode ||
        ""
      );

    const div =
      String(slotData.divId || "");

    const path =
      String(
        slotData.adUnitPath || ""
      );

    if (
      code &&
      div &&
      code === div
    ) {
      return true;
    }

    if (
      code &&
      path &&
      code === path
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

    const adId =
      String(
        bid.adId ||
        bid.bidId ||
        ""
      );

    const requestHbAdId =
      slotData.hbRequest &&
      slotData.hbRequest.adId
        ? String(
            slotData.hbRequest.adId
          )
        : "";

    if (
      adId &&
      requestHbAdId &&
      adId === requestHbAdId
    ) {
      return true;
    }

    const hbAdId =
      String(
        firstTarget(
          slotData.targeting,
          "hb_adid"
        ) || ""
      );

    if (
      adId &&
      hbAdId &&
      adId === hbAdId
    ) {
      return true;
    }

    return false;
  }

  function collectHbBids(slotData) {
    const bids = [];

    getPbjsBids()
      .forEach(bid => {
        if (
          bidMatchesSlot(
            bid,
            slotData
          )
        ) {
          bids.push({
            bidder:
              bid.bidder ||
              bid.bidderCode ||
              "Unknown",
            cpm:
              safeNumber(bid.cpm),
            currency:
              bid.currency || "USD",
            size:
              bid.size ||
              (
                bid.width &&
                bid.height
                  ? `${bid.width}x${bid.height}`
                  : ""
              ),
            adId:
              bid.adId || "",
            responseTime:
              safeNumber(
                bid.timeToRespond
              ),
            bucket:
              bid.adserverTargeting
                ? (
                    bid.adserverTargeting.hb_pb ||
                    ""
                  )
                : "",
            status:
              bid.statusMessage ||
              bid.status ||
              "",
            source: "Prebid runtime",
            raw: bid
          });
        }
      });

    discoverRuntimeBids()
      .forEach(bid => {
        if (
          bidMatchesSlot(
            bid,
            slotData
          )
        ) {
          bids.push({
            bidder:
              bid.bidder,
            cpm:
              bid.cpm,
            currency:
              bid.currency || "USD",
            size:
              bid.size,
            adId:
              bid.adId,
            responseTime:
              bid.responseTime,
            bucket: "",
            status:
              bid.status,
            source:
              bid.__source,
            raw: bid
          });
        }
      });

    if (
      slotData.hbRequest &&
      slotData.hbRequest.bidder
    ) {
      const hr =
        slotData.hbRequest;

      const already =
        bids.some(bid =>
          String(bid.bidder) ===
          String(hr.bidder)
        );

      if (!already) {
        bids.push({
          bidder:
            hr.bidder,
          cpm: null,
          currency: "USD",
          size:
            hr.size || "",
          adId:
            hr.adId || "",
          responseTime: null,
          bucket:
            hr.bucket || "",
          status:
            "Sent to GAM",
          source:
            "GAM request",
          raw: hr
        });
      }
    }

    const unique = [];
    const seen = new Set();

    bids.forEach(bid => {
      const key = [
        bid.bidder,
        bid.cpm,
        bid.bucket,
        bid.adId,
        bid.size
      ].join("|");

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(bid);
      }
    });

    unique.sort((a, b) => {
      const ac =
        a.cpm === null
          ? -1
          : a.cpm;

      const bc =
        b.cpm === null
          ? -1
          : b.cpm;

      return bc - ac;
    });

    return unique;
  }

  function findPbWinningBid(
    slotData
  ) {
    const winners =
      getPbjsWinningBids();

    return (
      winners.find(bid =>
        bidMatchesSlot(
          bid,
          slotData
        )
      ) || null
    );
  }

  function getHbTargeting(
    targeting
  ) {
    const out = {};

    Object.keys(
      targeting || {}
    ).forEach(key => {
      if (
        /^hb_/i.test(key)
      ) {
        out[key] =
          targeting[key];
      }
    });

    return out;
  }

  function getConsentStatus(
    request
  ) {
    const result = {
      gdprApplies: null,
      consentString: null,
      cmpPresent: null,
      gpp: null,
      usPrivacy: null,
      gdprValue: "",
      consentValue: "",
      gppValue: "",
      gppSid: "",
      usPrivacyValue: ""
    };

    if (
      request &&
      request.parsed
    ) {
      const p =
        request.parsed.params || {};

      if (
        p.gdpr === "1"
      ) {
        result.gdprApplies =
          true;
      } else if (
        p.gdpr === "0"
      ) {
        result.gdprApplies =
          false;
      }

      if (
        "gdpr_consent" in p
      ) {
        result.consentString =
          Boolean(
            p.gdpr_consent
          );

        result.consentValue =
          p.gdpr_consent || "";
      }

      if (
        p.gpp &&
        p.gpp !== ""
      ) {
        result.gpp = true;
        result.gppValue =
          p.gpp;
      } else if (
        p.gpp_sid &&
        p.gpp_sid !== "-1"
      ) {
        result.gpp = true;
      } else if (
        p.gpp_sid === "-1"
      ) {
        result.gpp = false;
      }

      result.gppSid =
        p.gpp_sid || "";

      if (
        p.us_privacy
      ) {
        result.usPrivacy =
          true;

        result.usPrivacyValue =
          p.us_privacy;
      }

      result.gdprValue =
        p.gdpr || "";
    }

    try {
      result.cmpPresent =
        typeof window.__tcfapi ===
        "function";
    } catch (_) {
      result.cmpPresent =
        false;
    }

    return result;
  }

  function parseIdsFromText(
    text,
    divId
  ) {
    const result = {
      lineItemId: "",
      creativeId: "",
      advertiserId: "",
      orderId: "",
      queryId: ""
    };

    const s =
      String(text || "");

    if (
      divId &&
      !s.includes(divId)
    ) {
      return result;
    }

    const patterns = {
      lineItemId: [
        /Line\s*Item(?:-|\s*)ID\s*[:=]\s*(-?\d+)/i,
        /LineItem-ID\s*[:=]\s*(-?\d+)/i,
        /lineItemId["'\s:=]+(-?\d+)/i
      ],

      creativeId: [
        /Creative(?:-|\s*)ID\s*[:=]\s*(\d+)/i,
        /creativeId["'\s:=]+(\d+)/i
      ],

      advertiserId: [
        /Advertiser(?:-|\s*)ID\s*[:=]\s*(\d+)/i,
        /advertiserId["'\s:=]+(\d+)/i
      ],

      orderId: [
        /Order(?:-|\s*)ID\s*[:=]\s*(\d+)/i,
        /Campaign(?:-|\s*)ID\s*[:=]\s*(\d+)/i,
        /campaignId["'\s:=]+(\d+)/i
      ],

      queryId: [
        /Query(?:-|\s*)ID\s*[:=]\s*([A-Za-z0-9_-]{12,})/i,
        /query[_-]?id["'\s:=]+([A-Za-z0-9_-]{12,})/i
      ]
    };

    Object.keys(patterns)
      .forEach(key => {
        for (
          const regex of patterns[key]
        ) {
          const match =
            s.match(regex);

          if (match) {
            result[key] =
              match[1];

            break;
          }
        }
      });

    return result;
  }

  function findDebugOverlayIds(
    slotData
  ) {
    const divId =
      slotData.divId;

    const candidates = [];

    if (!divId) {
      return {
        lineItemId: "",
        creativeId: "",
        advertiserId: "",
        orderId: "",
        queryId: ""
      };
    }

    try {
      const elements =
        document.querySelectorAll(
          "div,span,section,aside"
        );

      for (
        let i = 0;
        i < elements.length;
        i++
      ) {
        const el =
          elements[i];

        let text = "";

        try {
          text =
            el.innerText || "";
        } catch (_) {
          continue;
        }

        if (
          !text ||
          text.length > 4000 ||
          !text.includes(divId)
        ) {
          continue;
        }

        if (
          /LineItem|Line Item|Creative|Query-ID|Query ID/i.test(
            text
          )
        ) {
          candidates.push(text);
        }
      }
    } catch (_) {}

    const combined =
      candidates.join("\n");

    return parseIdsFromText(
      combined,
      divId
    );
  }

  function mergeIds(
    response,
    overlay
  ) {
    const ids = {
      lineItemId: null,
      creativeId: null,
      advertiserId: null,
      orderId: null,
      queryId: ""
    };

    if (response) {
      if (
        response.lineItemId !==
        undefined &&
        response.lineItemId !==
        null
      ) {
        ids.lineItemId =
          response.lineItemId;
      }

      if (
        response.creativeId !==
        undefined &&
        response.creativeId !==
        null
      ) {
        ids.creativeId =
          response.creativeId;
      }

      if (
        response.advertiserId !==
        undefined &&
        response.advertiserId !==
        null
      ) {
        ids.advertiserId =
          response.advertiserId;
      }

      if (
        response.campaignId !==
        undefined &&
        response.campaignId !==
        null
      ) {
        ids.orderId =
          response.campaignId;
      }
    }

    if (
      (
        ids.lineItemId === null ||
        ids.lineItemId === ""
      ) &&
      overlay.lineItemId !== ""
    ) {
      ids.lineItemId =
        safeNumber(
          overlay.lineItemId
        );
    }

    if (
      (
        ids.creativeId === null ||
        ids.creativeId === ""
      ) &&
      overlay.creativeId
    ) {
      ids.creativeId =
        safeNumber(
          overlay.creativeId
        );
    }

    if (
      (
        ids.advertiserId === null ||
        ids.advertiserId === ""
      ) &&
      overlay.advertiserId
    ) {
      ids.advertiserId =
        safeNumber(
          overlay.advertiserId
        );
    }

    if (
      (
        ids.orderId === null ||
        ids.orderId === ""
      ) &&
      overlay.orderId
    ) {
      ids.orderId =
        safeNumber(
          overlay.orderId
        );
    }

    if (
      overlay.queryId
    ) {
      ids.queryId =
        overlay.queryId;
    }

    return ids;
  }

  function classifyWinner(
    slotData
  ) {
    const lineItemId =
      slotData.ids.lineItemId;

    if (
      Number(lineItemId) === -2
    ) {
      return {
        label: "UNFILLED",
        cls: "no",
        reason:
          "Line item ID = -2"
      };
    }

    if (
      Number(lineItemId) === -1
    ) {
      return {
        label: "AdX",
        cls: "adx",
        reason:
          "Line item ID = -1"
      };
    }

    if (
      Number.isFinite(
        Number(lineItemId)
      ) &&
      Number(lineItemId) > 0
    ) {
      if (
        slotData.hbDetected &&
        slotData.hbWinnerLikely
      ) {
        return {
          label:
            "HEADER BIDDING",
          cls: "hb",
          reason:
            "Positive GAM line item + HB winner evidence"
        };
      }

      return {
        label:
          "GAM LINE ITEM",
        cls: "yes",
        reason:
          slotData.hbDetected
            ? "HB participated, but GAM returned a positive line item"
            : "Positive GAM line item"
      };
    }

    return {
      label: "UNKNOWN",
      cls: "warn",
      reason:
        "Line item ID unavailable"
    };
  }

  function buildTroubleshootingUrl(
    slotData
  ) {
    if (
      !slotData.networkCode ||
      !slotData.ids.queryId
    ) {
      return "";
    }

    return (
      "https://admanager.google.com/" +
      encodeURIComponent(
        slotData.networkCode
      ) +
      "#troubleshooting/screenshot/query_id=" +
      encodeURIComponent(
        slotData.ids.queryId
      )
    );
  }

  function sanitizeGamParams(params) {
    const out = {};

    Object.keys(params || {})
      .forEach(key => {
        const value =
          params[key];

        if (
          key === "gdpr_consent"
        ) {
          out[key] = {
            present:
              Boolean(value),
            length:
              String(value || "")
                .length
          };

          return;
        }

        if (
          key === "gpp"
        ) {
          out[key] = {
            present:
              Boolean(value),
            length:
              String(value || "")
                .length
          };

          return;
        }

        out[key] = value;
      });

    return out;
  }

  function buildDiagnosticExport(
    slotData
  ) {
    const request =
      slotData.bestRequest;

    const consent =
      slotData.consent;

    const hbBids =
      (slotData.hbBids || [])
        .map(bid => ({
          bidder:
            bid.bidder || "",
          cpm:
            bid.cpm,
          currency:
            bid.currency || "",
          bucket:
            bid.bucket || "",
          size:
            bid.size || "",
          adId:
            bid.adId || "",
          responseTime:
            bid.responseTime,
          status:
            bid.status || "",
          source:
            bid.source || ""
        }));

    let pbjsVersion = null;

    try {
      const pbjs =
        getPbjs();

      if (pbjs) {
        pbjsVersion =
          pbjs.version ||
          pbjs.libLoaded ||
          null;
      }
    } catch (_) {}

    const exportObject = {
      debugr: {
        tool:
          "Debugr Troubleshooting",
        exportedAt:
          new Date().toISOString(),
        pageUrl:
          location.href,
        pageTitle:
          document.title,
        userAgent:
          navigator.userAgent
      },

      environment: {
        gptAvailable:
          Boolean(
            getGoogletag()
          ),
        pbjsAvailable:
          Boolean(
            getPbjs()
          ),
        pbjsVersion,
        tcfApiAvailable:
          typeof window.__tcfapi ===
          "function",
        gppApiAvailable:
          typeof window.__gpp ===
          "function",
        totalActiveSlots:
          state.slots.length,
        totalIgnoredSlots:
          state.ignored.length
      },

      selectedSlot: {
        index:
          state.selected,
        originalIndex:
          slotData.originalIndex,
        adUnitPath:
          slotData.adUnitPath,
        divId:
          slotData.divId,
        networkCode:
          slotData.networkCode,
        outOfPage:
          slotData.oop,
        configuredSizes:
          slotData.sizes,
        domSize:
          slotData.domSize,
        elementExists:
          Boolean(
            slotData.element
          )
      },

      auction: {
        winner:
          slotData.winner,
        ids:
          slotData.ids
      },

      gpt: {
        responseInformation:
          slotData.response,
        slotTargeting:
          slotData.targeting,
        pageTargeting:
          slotData.pageTargeting,
        overlayIds:
          slotData.overlayIds
      },

      gamRequest: request
        ? {
            found: true,
            match: {
              score:
                request.match.score,
              reason:
                request.match.reason
            },
            timing: {
              startTimeMs:
                request.startTime,
              durationMs:
                request.duration,
              transferSize:
                request.transferSize
            },
            adUnitPath:
              getRequestAdUnitPath(
                request.parsed
              ),
            params:
              sanitizeGamParams(
                request.parsed.params
              ),
            prevScp:
              request.parsed.prevScp,
            custParams:
              request.parsed.custParams
          }
        : {
            found: false
          },

      headerBidding: {
        detected:
          slotData.hbDetected,
        winnerLikely:
          slotData.hbWinnerLikely,
        requestData:
          slotData.hbRequest,
        topBid:
          slotData.topBid
            ? {
                bidder:
                  slotData.topBid.bidder,
                cpm:
                  slotData.topBid.cpm,
                currency:
                  slotData.topBid.currency,
                bucket:
                  slotData.topBid.bucket,
                size:
                  slotData.topBid.size,
                adId:
                  slotData.topBid.adId,
                responseTime:
                  slotData.topBid.responseTime,
                status:
                  slotData.topBid.status,
                source:
                  slotData.topBid.source
              }
            : null,
        bids:
          hbBids,
        hbTargeting:
          getHbTargeting(
            slotData.targeting
          )
      },

      privacy: {
        gdprApplies:
          consent.gdprApplies,
        cmpPresent:
          consent.cmpPresent,
        consentStringPresent:
          consent.consentString,
        consentStringLength:
          String(
            consent.consentValue || ""
          ).length,
        gpp:
          consent.gpp,
        gppStringPresent:
          Boolean(
            consent.gppValue
          ),
        gppStringLength:
          String(
            consent.gppValue || ""
          ).length,
        gppSid:
          consent.gppSid,
        usPrivacy:
          consent.usPrivacy,
        usPrivacyValue:
          consent.usPrivacyValue
      },

      ignoredSlots:
        state.ignored.map(item => ({
          originalIndex:
            item.originalIndex,
          adUnitPath:
            item.adUnitPath,
          divId:
            item.divId,
          reason:
            item.reason
        }))
    };

    return exportObject;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard
        .writeText(text);

      return true;
    } catch (_) {
      try {
        const textarea =
          document.createElement(
            "textarea"
          );

        textarea.value =
          text;

        textarea.style.position =
          "fixed";

        textarea.style.left =
          "-9999px";

        document.body
          .appendChild(
            textarea
          );

        textarea.select();

        const ok =
          document.execCommand(
            "copy"
          );

        textarea.remove();

        return ok;
      } catch (_) {
        return false;
      }
    }
  }

  function collectSlots() {
    const gt =
      getGoogletag();

    state.slots = [];
    state.ignored = [];

    if (!gt) {
      renderEmpty(
        "GPT API is not available."
      );
      return;
    }

    let rawSlots = [];

    try {
      rawSlots =
        gt.pubads().getSlots() || [];
    } catch (_) {}

    const pageTargeting =
      getPageTargeting();

    rawSlots.forEach(
      (slot, originalIndex) => {
        const divId =
          getSlotDivId(slot);

        const adUnitPath =
          getAdUnitPath(slot);

        const oop =
          isOutOfPage(
            slot,
            adUnitPath,
            divId
          );

        const element =
          divId
            ? document.getElementById(
                divId
              )
            : null;

        if (
          !oop &&
          (
            !divId ||
            !element
          )
        ) {
          state.ignored.push({
            originalIndex,
            divId,
            adUnitPath,
            reason:
              !divId
                ? "No DIV ID"
                : "DIV not found in DOM"
          });

          return;
        }

        const targeting =
          getTargeting(slot);

        const response =
          getResponseInfo(slot);

        const base = {
          originalIndex,
          slot,
          divId,
          adUnitPath,
          oop,
          element,
          networkCode:
            getNetworkCode(
              adUnitPath
            ),
          sizes:
            getSlotSizes(slot),
          targeting,
          pageTargeting,
          response
        };

        const bestRequest =
          getBestGamRequest(base);

        base.bestRequest =
          bestRequest;

        base.hbRequest =
          getHbFromRequest(
            bestRequest
          );

        base.overlayIds =
          findDebugOverlayIds(base);

        base.ids =
          mergeIds(
            response,
            base.overlayIds
          );

        base.consent =
          getConsentStatus(
            bestRequest
          );

        base.hbBids =
          collectHbBids(base);

        base.pbWinningBid =
          findPbWinningBid(base);

        base.hbDetected =
          Boolean(
            base.hbRequest ||
            base.hbBids.length ||
            Object.keys(
              getHbTargeting(
                targeting
              )
            ).length
          );

        const requestBidder =
          base.hbRequest
            ? base.hbRequest.bidder
            : "";

        const topBid =
          base.hbBids.length
            ? base.hbBids[0]
            : null;

        base.topBid =
          topBid;

        base.hbWinnerLikely =
          Boolean(
            base.pbWinningBid ||
            (
              topBid &&
              requestBidder &&
              topBid.bidder ===
                requestBidder
            )
          );

        base.winner =
          classifyWinner(base);

        if (element) {
          try {
            const rect =
              element.getBoundingClientRect();

            base.domSize =
              `${Math.round(rect.width)}x${Math.round(rect.height)}`;
          } catch (_) {
            base.domSize =
              "—";
          }
        } else {
          base.domSize =
            "OUT OF PAGE";
        }

        state.slots.push(base);
      }
    );

    $("#slotCount").textContent =
      `${state.slots.length} active`;

    $("#ignoredBtn").textContent =
      state.showIgnored
        ? `Hide ignored (${state.ignored.length})`
        : `Ignored: ${state.ignored.length}`;

    select.innerHTML = "";

    if (!state.slots.length) {
      renderEmpty(
        "No active GPT slots found."
      );

      return;
    }

    state.slots.forEach(
      (slotData, index) => {
        const option =
          document.createElement(
            "option"
          );

        const li =
          slotData.ids.lineItemId ===
            null ||
          slotData.ids.lineItemId ===
            undefined
            ? "?"
            : slotData.ids.lineItemId;

        option.value =
          String(index);

        option.textContent =
          `${index + 1}. ` +
          `${slotData.adUnitPath || slotData.divId || "slot"}` +
          `${slotData.oop ? " · OOP" : ""}` +
          ` · LI ${li}`;

        select.appendChild(
          option
        );
      }
    );

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

  function renderEmpty(message) {
    body.innerHTML = `
      <div class="empty">
        ${esc(message)}
      </div>
    `;

    $("#footer").textContent =
      `GPT ${getGoogletag() ? "✓" : "✕"}`;
  }

  function renderBidTable(
    slotData
  ) {
    const bids =
      slotData.hbBids || [];

    if (!bids.length) {
      if (slotData.hbRequest) {
        return `
          <div class="grid">
            ${kv(
              "Bidder",
              esc(
                slotData.hbRequest.bidder ||
                "—"
              )
            )}

            ${kv(
              "GAM bucket",
              slotData.hbRequest.bucket !== ""
                ? esc(
                    money(
                      slotData.hbRequest.bucket,
                      "USD"
                    )
                  )
                : "—"
            )}

            ${kv(
              "Size",
              esc(
                slotData.hbRequest.size ||
                "—"
              )
            )}

            ${kv(
              "Status",
              `<span class="yes">SENT TO GAM</span>`
            )}
          </div>
        `;
      }

      return `
        <div class="empty">
          No bidder-level bid data found.
        </div>
      `;
    }

    const top =
      bids.find(
        bid =>
          bid.cpm !== null
      ) || null;

    const rows =
      bids.map(bid => {
        const isTop =
          top === bid;

        let price = "—";

        if (
          bid.cpm !== null
        ) {
          price =
            money(
              bid.cpm,
              bid.currency
            );
        }

        let bucket =
          bid.bucket || "";

        if (
          !bucket &&
          slotData.hbRequest &&
          slotData.hbRequest.bidder ===
            bid.bidder
        ) {
          bucket =
            slotData.hbRequest.bucket ||
            "";
        }

        let response = "—";

        if (
          bid.responseTime !== null
        ) {
          response =
            `${Math.round(
              bid.responseTime
            )} ms`;
        } else if (
          bid.status
        ) {
          response =
            bid.status;
        }

        return `
          <tr class="${isTop ? "winner-row" : ""}">
            <td>
              ${isTop ? "★ " : ""}
              ${esc(bid.bidder)}
            </td>

            <td>
              ${esc(price)}
            </td>

            <td>
              ${
                bucket !== ""
                  ? esc(
                      money(
                        bucket,
                        "USD"
                      )
                    )
                  : "—"
              }
            </td>

            <td>
              ${esc(
                bid.size || "—"
              )}
            </td>

            <td>
              ${esc(response)}
            </td>
          </tr>
        `;
      }).join("");

    return `
      <table class="bidtable">
        <thead>
          <tr>
            <th>Bidder</th>
            <th>Bid</th>
            <th>GAM bucket</th>
            <th>Size</th>
            <th>Response</th>
          </tr>
        </thead>

        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  function renderIgnored() {
    if (!state.showIgnored) {
      return "";
    }

    if (!state.ignored.length) {
      return `
        <div class="section">
          <div class="section-title">
            Ignored slots
          </div>

          <div class="empty">
            None
          </div>
        </div>
      `;
    }

    return `
      <div class="section">
        <div class="section-title">
          Ignored slots
        </div>

        ${state.ignored.map(item => `
          <div class="ignored">
            ${esc(item.adUnitPath || "Unknown slot")}
            <br>
            ${esc(item.divId || "No DIV")}
            · ${esc(item.reason)}
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderSelected() {
    const s =
      state.slots[
        state.selected
      ];

    if (!s) {
      return;
    }

    const ids =
      s.ids;

    const request =
      s.bestRequest;

    const hb =
      s.hbRequest;

    const consent =
      s.consent;

    const troubleshootUrl =
      buildTroubleshootingUrl(
        s
      );

    const queryValue =
      ids.queryId
        ? `
          ${esc(ids.queryId)}
          ${copyButton(ids.queryId)}
          ${
            troubleshootUrl
              ? `<br><a class="link" href="${esc(troubleshootUrl)}" target="_blank" rel="noopener noreferrer">Open in GAM Troubleshooting ↗</a>`
              : ""
          }
        `
        : `<span class="muted">Not available</span>`;

    let hbSummary = "";

    if (!s.hbDetected) {
      hbSummary +=
        kv(
          "HB detected",
          `<span class="no">NO</span>`
        );
    } else {
      hbSummary +=
        kv(
          "HB detected",
          `<span class="yes">YES</span>`
        );

      const bidder =
        hb && hb.bidder
          ? hb.bidder
          : (
              s.topBid
                ? s.topBid.bidder
                : ""
            );

      hbSummary +=
        kv(
          "Bidder sent to GAM",
          bidder
            ? `<span class="hb">${esc(bidder)}</span>`
            : "—"
        );

      const exactBid =
        s.topBid &&
        s.topBid.cpm !== null
          ? money(
              s.topBid.cpm,
              s.topBid.currency
            )
          : "";

      hbSummary +=
        kv(
          "Highest exact bid",
          exactBid
            ? esc(exactBid)
            : `<span class="muted">Not exposed</span>`
        );

      hbSummary +=
        kv(
          "GAM price bucket",
          hb &&
          hb.bucket !== ""
            ? esc(
                money(
                  hb.bucket,
                  "USD"
                )
              )
            : "—"
        );

      hbSummary +=
        kv(
          "Size",
          esc(
            (
              hb &&
              hb.size
            ) ||
            (
              s.topBid &&
              s.topBid.size
            ) ||
            "—"
          )
        );

      hbSummary +=
        kv(
          "Format",
          esc(
            (
              hb &&
              hb.format
            ) ||
            "—"
          )
        );

      hbSummary +=
        kv(
          "HB Ad ID",
          hb &&
          hb.adId
            ? `${esc(hb.adId)}${copyButton(hb.adId)}`
            : "—"
        );
    }

    const privacyRows = [
      kv(
        "GDPR applies",
        yesNo(
          consent.gdprApplies
        )
      ),

      kv(
        "TCF CMP",
        yesNo(
          consent.cmpPresent
        )
      ),

      kv(
        "Consent string",
        consent.consentString === null
          ? `<span class="muted">UNKNOWN</span>`
          : yesNo(
              consent.consentString
            )
      ),

      kv(
        "GPP",
        consent.gpp === null
          ? `<span class="muted">UNKNOWN</span>`
          : yesNo(
              consent.gpp
            )
      ),

      kv(
        "US Privacy",
        consent.usPrivacy === null
          ? `<span class="muted">UNKNOWN</span>`
          : yesNo(
              consent.usPrivacy
            )
      )
    ].join("");

    const requestInfo =
      request
        ? {
            match:
              request.match.reason,
            duration:
              Math.round(
                request.duration
              ),
            startTime:
              Math.round(
                request.startTime
              ),
            adUnitPath:
              getRequestAdUnitPath(
                request.parsed
              ),
            dids:
              request.parsed.params.dids ||
              "",
            prev_scp:
              request.parsed.prevScp,
            cust_params:
              request.parsed.custParams
          }
        : null;

    body.innerHTML = `
      <div class="section">
        <div class="section-title">
          Slot
        </div>

        <div class="grid">
          ${kv(
            "Ad unit",
            `${esc(s.adUnitPath)}${copyButton(s.adUnitPath)}`
          )}

          ${kv(
            "DIV",
            s.oop
              ? `<span class="hb">OUT OF PAGE</span>`
              : `${esc(s.divId)}${copyButton(s.divId)}`
          )}

          ${kv(
            "Configured sizes",
            esc(
              s.sizes.join(", ") ||
              "—"
            )
          )}

          ${kv(
            "DOM size",
            esc(
              s.domSize
            )
          )}

          ${kv(
            "GAM request",
            request
              ? `<span class="yes">YES</span>`
              : `<span class="no">NOT MATCHED</span>`
          )}
        </div>
      </div>

      <div class="section">
        <div class="section-title">
          Auction result
        </div>

        <div class="grid">
          ${kv(
            "Winner",
            `<span class="${s.winner.cls}">
              ${esc(s.winner.label)}
            </span>`
          )}

          ${kv(
            "Line item ID",
            ids.lineItemId !== null
              ? `${esc(ids.lineItemId)}${copyButton(ids.lineItemId)}`
              : `<span class="muted">Not available</span>`
          )}

          ${kv(
            "Creative ID",
            ids.creativeId !== null
              ? `${esc(ids.creativeId)}${copyButton(ids.creativeId)}`
              : `<span class="muted">Not available</span>`
          )}

          ${kv(
            "Advertiser ID",
            ids.advertiserId !== null
              ? `${esc(ids.advertiserId)}${copyButton(ids.advertiserId)}`
              : `<span class="muted">Not available</span>`
          )}

          ${kv(
            "Order ID",
            ids.orderId !== null
              ? `${esc(ids.orderId)}${copyButton(ids.orderId)}`
              : `<span class="muted">Not available</span>`
          )}

          ${kv(
            "Query ID",
            queryValue
          )}
        </div>
      </div>

      <div class="section">
        <div class="section-title">
          Header Bidding
        </div>

        <div class="grid">
          ${hbSummary}
        </div>
      </div>

      <div class="section">
        <div class="section-title">
          HB bids
        </div>

        ${renderBidTable(s)}
      </div>

      <div class="section">
        <div class="section-title">
          Privacy
        </div>

        <div class="grid">
          ${privacyRows}
        </div>
      </div>

      ${renderIgnored()}

      <div class="section">
        <details>
          <summary>
            Advanced
          </summary>

          <div class="section-title">
            GAM request match
          </div>

          <pre>${esc(
            stringify(
              requestInfo
            )
          )}</pre>

          <div class="section-title">
            GPT responseInformation
          </div>

          <pre>${esc(
            stringify(
              s.response
            )
          )}</pre>

          <div class="section-title">
            Debug overlay IDs
          </div>

          <pre>${esc(
            stringify(
              s.overlayIds
            )
          )}</pre>

          <div class="section-title">
            Slot targeting
          </div>

          <pre>${esc(
            stringify(
              s.targeting
            )
          )}</pre>

          <div class="section-title">
            Page targeting
          </div>

          <pre>${esc(
            stringify(
              s.pageTargeting
            )
          )}</pre>

          <div class="section-title">
            Header bidding request data
          </div>

          <pre>${esc(
            stringify(
              s.hbRequest
            )
          )}</pre>

          <div class="section-title">
            Bid objects
          </div>

          <pre>${esc(
            stringify(
              s.hbBids
            )
          )}</pre>

          <div class="section-title">
            Privacy raw
          </div>

          <pre>${esc(
            stringify({
              gdpr:
                consent.gdprValue,
              gdpr_consent_present:
                Boolean(
                  consent.consentValue
                ),
              gdpr_consent_length:
                String(
                  consent.consentValue || ""
                ).length,
              gpp_present:
                Boolean(
                  consent.gppValue
                ),
              gpp_length:
                String(
                  consent.gppValue || ""
                ).length,
              gpp_sid:
                consent.gppSid,
              us_privacy:
                consent.usPrivacyValue
            })
          )}</pre>
        </details>
      </div>
    `;

    bindCopyButtons();

    $("#footer").textContent =
      [
        `GPT ${getGoogletag() ? "✓" : "✕"}`,
        `HB ${s.hbDetected ? "✓" : "✕"}`,
        `GAM request ${request ? "✓" : "✕"}`,
        request
          ? request.match.reason
          : ""
      ]
        .filter(Boolean)
        .join(" · ");
  }

  function bindCopyButtons() {
    body
      .querySelectorAll(
        "[data-copy]"
      )
      .forEach(button => {
        button.addEventListener(
          "click",
          async event => {
            event.stopPropagation();

            const value =
              button.getAttribute(
                "data-copy"
              ) || "";

            const success =
              await copyText(
                value
              );

            if (success) {
              const old =
                button.textContent;

              button.textContent =
                "Copied";

              setTimeout(() => {
                button.textContent =
                  old;
              }, 800);
            }
          }
        );
      });
  }

  function refresh() {
    const current =
      state.slots[
        state.selected
      ];

    const previousDiv =
      current
        ? current.divId
        : "";

    const previousPath =
      current
        ? current.adUnitPath
        : "";

    collectSlots();

    if (
      previousDiv ||
      previousPath
    ) {
      const index =
        state.slots.findIndex(
          slot =>
            (
              previousDiv &&
              slot.divId ===
                previousDiv
            ) ||
            (
              previousPath &&
              slot.adUnitPath ===
                previousPath
            )
        );

      if (index >= 0) {
        state.selected =
          index;

        select.value =
          String(index);

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

  $("#refreshBtn")
    .addEventListener(
      "click",
      refresh
    );

  $("#copyJsonBtn")
    .addEventListener(
      "click",
      async () => {
        const slotData =
          state.slots[
            state.selected
          ];

        if (!slotData) {
          return;
        }

        const data =
          buildDiagnosticExport(
            slotData
          );

        const text =
          JSON.stringify(
            data,
            null,
            2
          );

        const button =
          $("#copyJsonBtn");

        const old =
          button.textContent;

        const success =
          await copyText(text);

        button.textContent =
          success
            ? "JSON copied ✓"
            : "Copy failed";

        setTimeout(() => {
          button.textContent =
            old;
        }, 1400);
      }
    );

  $("#ignoredBtn")
    .addEventListener(
      "click",
      () => {
        state.showIgnored =
          !state.showIgnored;

        $("#ignoredBtn")
          .textContent =
          state.showIgnored
            ? `Hide ignored (${state.ignored.length})`
            : `Ignored: ${state.ignored.length}`;

        renderSelected();
      }
    );

  $("#autoBtn")
    .addEventListener(
      "click",
      () => {
        state.auto =
          !state.auto;

        $("#autoBtn")
          .textContent =
          `Auto: ${
            state.auto
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

        if (state.auto) {
          state.timer =
            setInterval(
              refresh,
              2000
            );
        }
      }
    );

  $("#consoleBtn")
    .addEventListener(
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

  $("#closeBtn")
    .addEventListener(
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

  collectSlots();
})();
