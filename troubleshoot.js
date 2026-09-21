(() => {
  "use strict";

  const APP_ID = "__debugr_troubleshooting__";
  const HIGHLIGHT_ID = "__debugr_slot_highlight__";
  const CAPTURE_KEY = "__DEBUGR_HB_CAPTURE__";
  const BIDMATIC_URL_RE = /https:\/\/sghb\.bidmatic\.io\/adunit\/v2\/multitracking/i;

  // ---------------------------------------------------------------------------
  // Persistent network capture. Installed once per page and survives UI closing.
  // It captures FUTURE Bidmatic multitracking POST bodies from fetch/XHR/beacon.
  // ---------------------------------------------------------------------------

  function ensureCaptureStore() {
    if (window[CAPTURE_KEY]) return window[CAPTURE_KEY];

    const store = {
      installedAt: Date.now(),
      packets: [],
      listeners: new Set(),
      originals: {},
      installed: false,
      stats: {
        fetch: 0,
        xhr: 0,
        beacon: 0,
        parseErrors: 0
      }
    };

    window[CAPTURE_KEY] = store;

    const notify = () => {
      for (const fn of store.listeners) {
        try {
          fn();
        } catch (_) {}
      }
    };

    const bodyToText = async body => {
      if (body == null) return "";

      if (typeof body === "string") {
        return body;
      }

      if (body instanceof URLSearchParams) {
        return body.toString();
      }

      if (
        typeof Blob !== "undefined" &&
        body instanceof Blob
      ) {
        try {
          return await body.text();
        } catch (_) {
          return "";
        }
      }

      if (
        typeof ArrayBuffer !== "undefined" &&
        body instanceof ArrayBuffer
      ) {
        try {
          return new TextDecoder().decode(body);
        } catch (_) {
          return "";
        }
      }

      if (
        typeof ArrayBuffer !== "undefined" &&
        ArrayBuffer.isView(body)
      ) {
        try {
          return new TextDecoder().decode(body);
        } catch (_) {
          return "";
        }
      }

      if (
        typeof FormData !== "undefined" &&
        body instanceof FormData
      ) {
        const obj = {};

        try {
          body.forEach((value, key) => {
            obj[key] =
              typeof value === "string"
                ? value
                : `[${value?.constructor?.name || "Blob"}]`;
          });

          return JSON.stringify(obj);
        } catch (_) {
          return "";
        }
      }

      try {
        return JSON.stringify(body);
      } catch (_) {
        return String(body);
      }
    };

    const ingest = async (url, body, transport) => {
      const u = String(url || "");

      if (!BIDMATIC_URL_RE.test(u)) {
        return;
      }

      const text = await bodyToText(body);

      let json = null;

      try {
        json = JSON.parse(text);
      } catch (_) {
        store.stats.parseErrors++;
      }

      store.packets.push({
        capturedAt: Date.now(),
        transport,
        url: u,
        text,
        json
      });

      if (store.packets.length > 100) {
        store.packets.splice(
          0,
          store.packets.length - 100
        );
      }

      notify();
    };

    // FETCH

    try {
      if (typeof window.fetch === "function") {
        store.originals.fetch = window.fetch;

        const originalFetch = window.fetch;

        window.fetch = function(input, init) {
          try {
            const url =
              typeof input === "string"
                ? input
                : input?.url;

            const body =
              init?.body;

            if (
              BIDMATIC_URL_RE.test(
                String(url || "")
              )
            ) {
              store.stats.fetch++;

              ingest(
                url,
                body,
                "fetch"
              );
            }
          } catch (_) {}

          return originalFetch.apply(
            this,
            arguments
          );
        };
      }
    } catch (_) {}

    // XHR

    try {
      const proto =
        XMLHttpRequest.prototype;

      store.originals.xhrOpen =
        proto.open;

      store.originals.xhrSend =
        proto.send;

      proto.open = function(method, url) {
        try {
          this.__debugrMethod =
            method;

          this.__debugrUrl =
            url;
        } catch (_) {}

        return store.originals.xhrOpen.apply(
          this,
          arguments
        );
      };

      proto.send = function(body) {
        try {
          if (
            BIDMATIC_URL_RE.test(
              String(
                this.__debugrUrl ||
                ""
              )
            )
          ) {
            store.stats.xhr++;

            ingest(
              this.__debugrUrl,
              body,
              "xhr"
            );
          }
        } catch (_) {}

        return store.originals.xhrSend.apply(
          this,
          arguments
        );
      };
    } catch (_) {}

    // SEND BEACON

    try {
      if (
        navigator &&
        typeof navigator.sendBeacon ===
          "function"
      ) {
        store.originals.sendBeacon =
          navigator.sendBeacon.bind(
            navigator
          );

        const originalBeacon =
          navigator.sendBeacon.bind(
            navigator
          );

        navigator.sendBeacon =
          function(url, data) {
            try {
              if (
                BIDMATIC_URL_RE.test(
                  String(url || "")
                )
              ) {
                store.stats.beacon++;

                ingest(
                  url,
                  data,
                  "beacon"
                );
              }
            } catch (_) {}

            return originalBeacon(
              url,
              data
            );
          };
      }
    } catch (_) {}

    store.ingest = ingest;
    store.installed = true;

    return store;
  }

  const captureStore =
    ensureCaptureStore();

  // Toggle existing UI off.
  // Capture stays armed.

  const old =
    document.getElementById(APP_ID);

  if (old) {
    old.remove();

    const oldHighlight =
      document.getElementById(
        HIGHLIGHT_ID
      );

    if (oldHighlight) {
      oldHighlight.remove();
    }

    return;
  }

  const state = {
    slots: [],
    ignored: [],
    selected: 0,
    timer: null,
    auto: false,
    tcData: null,
    tcDataLoaded: false
  };

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------

  const host =
    document.createElement("div");

  host.id = APP_ID;

  host.style.cssText =
    "all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;";

  document.documentElement
    .appendChild(host);

  const root =
    host.attachShadow({
      mode: "open"
    });

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

        width:
          min(
            700px,
            calc(100vw - 24px)
          );

        max-height:
          calc(100vh - 24px);

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

        background:
          rgba(15,21,30,.72);

        border:
          1px solid
          rgba(100,120,145,.58);

        border-radius: 14px;

        box-shadow:
          0 18px 60px
          rgba(0,0,0,.45);

        backdrop-filter:
          blur(5px);

        -webkit-backdrop-filter:
          blur(5px);
      }

      .header {
        display: flex;
        align-items: center;
        gap: 8px;

        padding:
          10px 11px;

        background:
          rgba(22,30,41,.76);

        border-bottom:
          1px solid
          rgba(90,110,135,.4);
      }

      .title {
        font-size: 15px;
        font-weight: 800;
      }

      .spacer {
        flex: 1;
      }

      .pill {
        border:
          1px solid
          rgba(100,125,155,.6);

        border-radius: 999px;

        padding:
          2px 7px;

        font-size: 11px;

        color: #c1ccda;

        background:
          rgba(10,15,22,.3);
      }

      button,
      select {
        font: inherit;
      }

      button {
        cursor: pointer;

        color: #edf3fb;

        background:
          rgba(28,38,51,.86);

        border:
          1px solid
          rgba(90,110,140,.7);

        border-radius: 8px;

        padding:
          6px 9px;
      }

      button:hover {
        background:
          rgba(45,59,78,.96);
      }

      .danger {
        background:
          rgba(70,26,36,.88);

        border-color:
          rgba(160,60,80,.75);
      }

      .copy-json {
        background:
          rgba(23,60,50,.92);

        border-color:
          rgba(55,145,115,.75);
      }

      .highlight-btn {
        background:
          rgba(87,62,10,.92);

        border-color:
          rgba(210,155,35,.85);
      }

      .controls {
        display: grid;

        grid-template-columns:
          minmax(0,1fr)
          auto;

        gap: 8px;

        padding:
          9px 10px;

        background:
          rgba(17,25,35,.70);

        border-bottom:
          1px solid
          rgba(90,110,135,.35);
      }

      select {
        width: 100%;
        min-width: 0;

        padding:
          7px 9px;

        color: #edf3fb;

        background:
          rgba(8,14,21,.80);

        border:
          1px solid
          rgba(85,105,135,.7);

        border-radius: 8px;
      }

      .subcontrols {
        display: flex;

        gap: 7px;

        padding:
          0 10px 9px;

        background:
          rgba(17,25,35,.70);

        border-bottom:
          1px solid
          rgba(90,110,135,.35);

        flex-wrap: wrap;
      }

      .capture-status {
        padding:
          7px 10px;

        background:
          rgba(9,15,22,.58);

        border-bottom:
          1px solid
          rgba(90,110,135,.28);

        font-size: 11px;

        color: #aab8c8;
      }

      .capture-ok {
        color: #63e6a1;
        font-weight: 750;
      }

      .capture-wait {
        color: #ffd06b;
        font-weight: 750;
      }

      .body {
        overflow: auto;

        max-height:
          calc(100vh - 193px);

        padding: 10px;
      }

      .section {
        margin-bottom: 10px;

        overflow: hidden;

        background:
          rgba(17,25,35,.66);

        border:
          1px solid
          rgba(80,100,125,.45);

        border-radius: 10px;
      }

      .section-title {
        padding:
          7px 10px;

        font-size: 11px;
        font-weight: 800;

        letter-spacing: .7px;

        text-transform:
          uppercase;

        color: #b5c1d0;

        background:
          rgba(24,33,45,.80);

        border-bottom:
          1px solid
          rgba(80,100,125,.4);
      }

      .grid {
        display: grid;

        grid-template-columns:
          165px
          minmax(0,1fr);
      }

      .k,
      .v {
        padding:
          7px 9px;

        border-bottom:
          1px solid
          rgba(65,80,100,.32);
      }

      .k {
        color: #9aa9bb;
      }

      .v {
        color: #eef4fb;

        overflow-wrap:
          anywhere;

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
        color: #8997a8;
      }

      .copy {
        padding:
          2px 6px;

        margin-left: 5px;

        font-size: 10px;
      }

      .id-link {
        color: #eef4fb;

        text-decoration: none;

        border-bottom:
          1px dotted
          rgba(131,181,255,.7);
      }

      .id-link:hover,
      .open-link:hover {
        color: #83b5ff;
      }

      .open-link {
        display: inline-block;

        margin-top: 3px;

        color: #83b5ff;

        text-decoration: none;

        font-size: 11px;
      }

      .bidtable {
        width: 100%;

        border-collapse:
          collapse;
      }

      .bidtable th,
      .bidtable td {
        padding:
          7px 8px;

        text-align: left;
        vertical-align: top;

        border-bottom:
          1px solid
          rgba(65,80,100,.32);
      }

      .bidtable th {
        color: #96a5b8;

        font-size: 11px;
        font-weight: 650;
      }

      .bidtable tr:last-child td {
        border-bottom: none;
      }

      .winner-row {
        background:
          rgba(53,201,175,.11);
      }

      .timeout-row {
        background:
          rgba(255,127,135,.06);
      }

      .empty {
        padding: 14px;

        text-align: center;

        color: #8c9bad;
      }

      details {
        background:
          rgba(8,14,21,.42);
      }

      summary {
        cursor: pointer;

        padding:
          9px 10px;

        font-weight: 700;

        color: #b6c1cf;

        background:
          rgba(24,33,45,.7);
      }

      pre {
        margin: 0;

        padding: 10px;

        max-height: 320px;

        overflow: auto;

        white-space:
          pre-wrap;

        word-break:
          break-word;

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

      .footer {
        padding:
          7px 10px;

        border-top:
          1px solid
          rgba(90,110,135,.35);

        color: #91a0b2;

        font-size: 11px;

        background:
          rgba(17,25,35,.72);
      }

      @media(max-width:650px) {
        .panel {
          top: 5px;
          right: 5px;

          width:
            calc(100vw - 10px);

          max-height:
            calc(100vh - 10px);
        }

        .grid {
          grid-template-columns:
            125px
            minmax(0,1fr);
        }

        .body {
          max-height:
            calc(100vh - 205px);
        }

        .bidtable {
          font-size: 11px;
        }
      }
    </style>

    <div class="panel">

      <div class="header">

        <div class="title">
          Debugr · Troubleshooting
        </div>

        <div
          class="pill"
          id="slotCount"
        >
          0 slots
        </div>

        <div class="spacer"></div>

        <button id="refreshBtn">
          Refresh
        </button>

        <button
          id="closeBtn"
          class="danger"
        >
          ×
        </button>

      </div>

      <div class="controls">

        <select id="slotSelect">
        </select>

        <button id="autoBtn">
          Auto: off
        </button>

      </div>

      <div class="subcontrols">

        <button
          id="highlightBtn"
          class="highlight-btn"
        >
          Highlight slot
        </button>

        <button
          id="copyJsonBtn"
          class="copy-json"
        >
          Copy JSON
        </button>

        <button id="consoleBtn">
          Publisher Console
        </button>

      </div>

      <div
        class="capture-status"
        id="captureStatus"
      ></div>

      <div
        class="body"
        id="body"
      ></div>

      <div
        class="footer"
        id="footer"
      >
        Ready
      </div>

    </div>
  `;

  const $ =
    selector =>
      root.querySelector(
        selector
      );

  const body =
    $("#body");

  const select =
    $("#slotSelect");

  // ---------------------------------------------------------------------------
  // Generic helpers
  // ---------------------------------------------------------------------------

  function esc(value) {
    return String(
      value ?? ""
    )
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      );
  }

  function stringify(value) {
    try {
      return JSON.stringify(
        value,
        null,
        2
      );
    } catch (_) {
      return String(value);
    }
  }

  function safeNumber(value) {
    if (
      value === "" ||
      value == null
    ) {
      return null;
    }

    const n =
      Number(value);

    return Number.isFinite(n)
      ? n
      : null;
  }

  function formatNumber(
    value,
    max = 6
  ) {
    const n =
      safeNumber(value);

    if (n == null) {
      return "—";
    }

    return n
      .toFixed(max)
      .replace(
        /0+$/,
        ""
      )
      .replace(
        /\.$/,
        ""
      );
  }

  function money(
    value,
    currency = ""
  ) {
    const n =
      safeNumber(value);

    if (n == null) {
      return "—";
    }

    const max =
      Math.abs(n) < 0.1
        ? 6
        : 4;

    return (
      `${formatNumber(n, max)}` +
      `${currency ? " " + currency : ""}`
    );
  }

  function kv(
    key,
    value
  ) {
    return `
      <div class="k">
        ${esc(key)}
      </div>

      <div class="v">
        ${value}
      </div>
    `;
  }

  function yesNo(value) {
    if (value === true) {
      return `
        <span class="yes">
          YES
        </span>
      `;
    }

    if (value === false) {
      return `
        <span class="no">
          NO
        </span>
      `;
    }

    return `
      <span class="muted">
        UNKNOWN
      </span>
    `;
  }

  function copyButton(value) {
    if (
      value == null ||
      value === ""
    ) {
      return "";
    }

    return `
      <button
        class="copy"
        data-copy="${esc(
          String(value)
        )}"
      >
        Copy
      </button>
    `;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard
        .writeText(text);

      return true;
    } catch (_) {}

    try {
      const ta =
        document.createElement(
          "textarea"
        );

      ta.value =
        text;

      ta.style.cssText =
        "position:fixed;left:-9999px;top:0";

      document.body
        .appendChild(ta);

      ta.select();

      const ok =
        document.execCommand(
          "copy"
        );

      ta.remove();

      return ok;
    } catch (_) {
      return false;
    }
  }

  function getGoogletag() {
    try {
      return (
        window.googletag &&
        window.googletag.apiReady
          ? window.googletag
          : null
      );
    } catch (_) {
      return null;
    }
  }

  function getPbjs() {
    try {
      return (
        window.pbjs &&
        typeof window.pbjs ===
          "object"
          ? window.pbjs
          : null
      );
    } catch (_) {
      return null;
    }
  }

  function getNetworkCode(
    adUnitPath
  ) {
    const m =
      String(
        adUnitPath ||
        ""
      ).match(
        /^\/(\d+)\//
      );

    return m
      ? m[1]
      : "";
  }

  function firstTarget(
    targeting,
    key
  ) {
    const value =
      targeting?.[key];

    return Array.isArray(value)
      ? (
          value[0] ??
          ""
        )
      : (
          value ??
          ""
        );
  }

  // ---------------------------------------------------------------------------
  // GPT helpers
  // ---------------------------------------------------------------------------

  function getSlotDivId(slot) {
    try {
      return (
        slot.getSlotElementId() ||
        ""
      );
    } catch (_) {
      return "";
    }
  }

  function getAdUnitPath(slot) {
    try {
      return (
        slot.getAdUnitPath() ||
        ""
      );
    } catch (_) {
      return "";
    }
  }

  function getSlotSizes(slot) {
    try {
      const sizes =
        typeof slot.getSizes ===
          "function"
          ? slot.getSizes()
          : [];

      return sizes.map(
        size => {
          if (
            typeof size ===
            "string"
          ) {
            return size;
          }

          if (
            size &&
            typeof size.getWidth ===
              "function" &&
            typeof size.getHeight ===
              "function"
          ) {
            return (
              `${size.getWidth()}` +
              "x" +
              `${size.getHeight()}`
            );
          }

          return String(size);
        }
      );
    } catch (_) {
      return [];
    }
  }

  function getTargeting(slot) {
    const out = {};

    try {
      const keys =
        typeof slot.getTargetingKeys ===
          "function"
          ? slot.getTargetingKeys()
          : [];

      for (
        const key of keys
      ) {
        try {
          out[key] =
            slot.getTargeting(
              key
            );
        } catch (_) {}
      }
    } catch (_) {}

    return out;
  }

  function getPageTargeting() {
    const out = {};

    const gt =
      getGoogletag();

    if (!gt) {
      return out;
    }

    try {
      const pubads =
        gt.pubads();

      const keys =
        typeof pubads.getTargetingKeys ===
          "function"
          ? pubads.getTargetingKeys()
          : [];

      for (
        const key of keys
      ) {
        try {
          out[key] =
            pubads.getTargeting(
              key
            );
        } catch (_) {}
      }
    } catch (_) {}

    return out;
  }

  function getResponseInfo(slot) {
    try {
      return (
        typeof slot.getResponseInformation ===
          "function"
          ? (
              slot.getResponseInformation() ||
              null
            )
          : null
      );
    } catch (_) {
      return null;
    }
  }

  function isOutOfPage(
    slot,
    path,
    divId
  ) {
    try {
      if (
        typeof slot.getOutOfPage ===
          "function" &&
        slot.getOutOfPage()
      ) {
        return true;
      }
    } catch (_) {}

    return (
      /\b(interstitial|anchor|rewarded|out[-_ ]?of[-_ ]?page|oop)\b/i
        .test(
          `${path || ""} ${divId || ""}`
        )
    );
  }

  function getIdsFromResponse(
    response
  ) {
    return {
      lineItemId:
        response?.lineItemId ??
        null,

      creativeId:
        response?.creativeId ??
        null,

      advertiserId:
        response?.advertiserId ??
        null,

      orderId:
        response?.campaignId ??
        null,

      sourceAgnosticLineItemId:
        response?.sourceAgnosticLineItemId ??
        null,

      sourceAgnosticCreativeId:
        response?.sourceAgnosticCreativeId ??
        null,

      creativeTemplateId:
        response?.creativeTemplateId ??
        null,

      queryId:
        ""
    };
  }

  // ---------------------------------------------------------------------------
  // GAM request matching
  // ---------------------------------------------------------------------------

  function parseNestedParams(raw) {
    const out = {};

    if (!raw) {
      return out;
    }

    let decoded =
      String(raw);

    for (
      let i = 0;
      i < 3;
      i++
    ) {
      try {
        const next =
          decodeURIComponent(
            decoded
          );

        if (
          next === decoded
        ) {
          break;
        }

        decoded = next;
      } catch (_) {
        break;
      }
    }

    for (
      const part of
      decoded
        .replace(
          /^\?/,
          ""
        )
        .split("&")
    ) {
      if (!part) {
        continue;
      }

      const idx =
        part.indexOf("=");

      let key =
        idx === -1
          ? part
          : part.slice(
              0,
              idx
            );

      let val =
        idx === -1
          ? ""
          : part.slice(
              idx + 1
            );

      try {
        key =
          decodeURIComponent(
            key
          );
      } catch (_) {}

      try {
        val =
          decodeURIComponent(
            val
          );
      } catch (_) {}

      if (key) {
        out[key] =
          val;
      }
    }

    return out;
  }

  function getPerformanceResources() {
    try {
      return performance
        .getEntriesByType(
          "resource"
        )
        .map(
          entry => ({
            url:
              String(
                entry.name ||
                ""
              ),

            startTime:
              entry.startTime ||
              0,

            duration:
              entry.duration ||
              0,

            transferSize:
              entry.transferSize ||
              0
          })
        );
    } catch (_) {
      return [];
    }
  }

  function isGamRequestUrl(url) {
    return (
      /\/gampad\/ads|\/pagead\/ads/i
        .test(
          String(
            url ||
            ""
          )
        )
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
      const parsed =
        new URL(url);

      parsed.searchParams
        .forEach(
          (
            value,
            key
          ) => {
            out.params[key] =
              value;
          }
        );

      out.prevScp =
        parseNestedParams(
          out.params.prev_scp ||
          ""
        );

      out.custParams =
        parseNestedParams(
          out.params.cust_params ||
          ""
        );
    } catch (_) {}

    return out;
  }

  function getRequestAdUnitPath(
    parsed
  ) {
    const p =
      parsed?.params ||
      {};

    if (p.iu) {
      try {
        return decodeURIComponent(
          p.iu
        );
      } catch (_) {
        return p.iu;
      }
    }

    if (p.iu_parts) {
      const parts =
        String(
          p.iu_parts
        )
          .split(",")
          .filter(Boolean);

      if (
        parts.length
      ) {
        return (
          "/" +
          parts.join("/")
        );
      }
    }

    return "";
  }

  function requestMatchesSlot(
    parsed,
    slotData
  ) {
    const p =
      parsed?.params ||
      {};

    const prev =
      parsed?.prevScp ||
      {};

    const divId =
      String(
        slotData.divId ||
        ""
      );

    const path =
      String(
        slotData.adUnitPath ||
        ""
      );

    if (
      divId &&
      p.dids &&
      String(
        p.dids
      )
        .split(",")
        .includes(
          divId
        )
    ) {
      return {
        matched: true,
        score: 100,
        reason:
          "dids exact DIV match"
      };
    }

    if (
      divId &&
      prev.hb_div_id ===
        divId
    ) {
      return {
        matched: true,
        score: 95,
        reason:
          "prev_scp hb_div_id exact match"
      };
    }

    const reqPath =
      getRequestAdUnitPath(
        parsed
      );

    if (
      reqPath &&
      path &&
      reqPath ===
        path
    ) {
      return {
        matched: true,
        score: 90,
        reason:
          "exact ad unit path match"
      };
    }

    if (
      reqPath &&
      path &&
      (
        reqPath.endsWith(
          path
        ) ||
        path.endsWith(
          reqPath
        )
      )
    ) {
      return {
        matched: true,
        score: 70,
        reason:
          "ad unit path suffix match"
      };
    }

    return {
      matched: false,
      score: 0,
      reason: ""
    };
  }

  function findGamRequests(
    slotData
  ) {
    return getPerformanceResources()
      .filter(
        r =>
          isGamRequestUrl(
            r.url
          )
      )
      .map(
        r => {
          const parsed =
            parseGamRequest(
              r.url
            );

          return {
            ...r,

            parsed,

            match:
              requestMatchesSlot(
                parsed,
                slotData
              )
          };
        }
      )
      .filter(
        r =>
          r.match.matched
      )
      .sort(
        (
          a,
          b
        ) =>
          b.match.score -
            a.match.score ||
          b.startTime -
            a.startTime
      );
  }

  function getBestGamRequest(
    slotData
  ) {
    return (
      findGamRequests(
        slotData
      )[0] ||
      null
    );
  }

  // ---------------------------------------------------------------------------
  // Header bidding targeting + Prebid fallback
  // ---------------------------------------------------------------------------

  function getHbFromRequest(
    request
  ) {
    if (
      !request?.parsed
    ) {
      return null;
    }

    const p =
      request.parsed.params ||
      {};

    const prev =
      request.parsed.prevScp ||
      {};

    const cust =
      request.parsed.custParams ||
      {};

    const get =
      key => {
        if (
          prev[key] !==
            undefined &&
          prev[key] !== ""
        ) {
          return prev[key];
        }

        if (
          p[key] !==
            undefined &&
          p[key] !== ""
        ) {
          return p[key];
        }

        if (
          cust[key] !==
            undefined &&
          cust[key] !== ""
        ) {
          return cust[key];
        }

        return "";
      };

    const data = {
      bidder:
        get("hb_bidder"),

      bucket:
        get("hb_pb"),

      adId:
        get("hb_adid"),

      size:
        get("hb_size"),

      format:
        get("hb_format"),

      version:
        get("hb_ver"),

      divId:
        get("hb_div_id"),

      siteId:
        get("hb_site_id"),

      buyerId:
        get("hb_buyer_id"),

      overrideId:
        get("hb_override_id"),

      requestId:
        get("hb_r_id"),

      rfBid:
        get("hb_rfBid"),

      strategy:
        get("hb_strategy") ||
        cust.hb_strategy ||
        "",

      vmhbmp:
        get("is_vmhbmp")
    };

    data.detected =
      Object
        .values(data)
        .some(
          v =>
            v !== "" &&
            v != null &&
            v !== false
        );

    return data.detected
      ? data
      : null;
  }

  function getHbTargeting(
    targeting
  ) {
    const out = {};

    for (
      const key of
      Object.keys(
        targeting ||
        {}
      )
    ) {
      if (
        /^hb_/i.test(key) ||
        /^is_vmhbmp$/i
          .test(key)
      ) {
        out[key] =
          targeting[key];
      }
    }

    return out;
  }

  function getHbWrapperEvidence(
    slotData
  ) {
    const evidence = [];

    const inspect =
      (
        obj,
        source
      ) => {
        for (
          const key of
          Object.keys(
            obj ||
            {}
          )
        ) {
          if (
            /^hb/i.test(key) ||
            /header.?bid/i
              .test(key) ||
            /^is_vmhbmp$/i
              .test(key)
          ) {
            evidence.push({
              source,
              key,
              value:
                obj[key]
            });
          }
        }
      };

    inspect(
      slotData.pageTargeting,
      "pageTargeting"
    );

    inspect(
      slotData.targeting,
      "slotTargeting"
    );

    if (
      slotData.hbRequest
    ) {
      evidence.push({
        source:
          "GAM request",

        key:
          "hbRequest",

        value:
          true
      });
    }

    if (
      getPbjs()
    ) {
      evidence.push({
        source:
          "runtime",

        key:
          "pbjs",

        value:
          true
      });
    }

    if (
      slotData.bidmaticBids?.length
    ) {
      evidence.push({
        source:
          "Bidmatic multitracking",

        key:
          "capturedBids",

        value:
          slotData.bidmaticBids
            .length
      });
    }

    return evidence;
  }

  function getPbjsBidsForSlot(
    slotData
  ) {
    const pbjs =
      getPbjs();

    if (
      !pbjs ||
      typeof pbjs.getBidResponses !==
        "function"
    ) {
      return [];
    }

    const out = [];

    try {
      const responses =
        pbjs.getBidResponses() ||
        {};

      for (
        const [
          adUnitCode,
          group
        ] of
        Object.entries(
          responses
        )
      ) {
        const bids =
          Array.isArray(
            group?.bids
          )
            ? group.bids
            : [];

        const match =
          adUnitCode ===
            slotData.divId ||
          adUnitCode ===
            slotData.adUnitPath;

        if (!match) {
          continue;
        }

        for (
          const bid of bids
        ) {
          out.push({
            bidder:
              bid.bidder ||
              bid.bidderCode ||
              "Unknown",

            originalBid:
              safeNumber(
                bid.cpm
              ),

            originalCurrency:
              bid.currency ||
              "USD",

            bid:
              safeNumber(
                bid.cpm
              ),

            currency:
              bid.currency ||
              "USD",

            pubBid:
              null,

            grossBid:
              null,

            netBid:
              null,

            gamBucket:
              bid.adserverTargeting
                ?.hb_pb ||
              "",

            hbAdId:
              bid.adId ||
              "",

            creativeId:
              bid.creativeId ||
              "",

            size:
              bid.size ||
              (
                bid.width &&
                bid.height
                  ? (
                      `${bid.width}` +
                      "x" +
                      `${bid.height}`
                    )
                  : ""
              ),

            winner:
              false,

            timeout:
              false,

            tte:
              safeNumber(
                bid.timeToRespond
              ),

            source:
              "Prebid runtime"
          });
        }
      }
    } catch (_) {}

    return out;
  }

  // ---------------------------------------------------------------------------
  // Bidmatic multitracking parser
  // ---------------------------------------------------------------------------

  function buildBidmaticRegistry() {
    const byHbAdId =
      new Map();

    const byId =
      new Map();

    for (
      const packet of
      captureStore.packets
    ) {
      const events =
        Array.isArray(
          packet.json?.events
        )
          ? packet.json.events
          : [];

      for (
        const event of events
      ) {
        const adUnitCode =
          event?.adUnitCode ||
          "";

        const bidders =
          Array.isArray(
            event?.bidders
          )
            ? event.bidders
            : [];

        for (
          const bidder of bidders
        ) {
          const name =
            bidder?.bidName ||
            "";

          if (
            bidder?.hbAdId &&
            name
          ) {
            byHbAdId.set(
              `${adUnitCode}|${bidder.hbAdId}`,
              name
            );
          }

          if (
            bidder?.id != null &&
            name
          ) {
            byId.set(
              `${adUnitCode}|${bidder.id}`,
              name
            );
          }
        }
      }
    }

    return {
      byHbAdId,
      byId
    };
  }

  function getBidmaticBidsForSlot(
    adUnitPath
  ) {
    const path =
      String(
        adUnitPath ||
        ""
      );

    if (!path) {
      return [];
    }

    const registry =
      buildBidmaticRegistry();

    const groups =
      new Map();

    let packetCurrency =
      "";

    for (
      const packet of
      captureStore.packets
    ) {
      const json =
        packet.json;

      if (
        !json ||
        !Array.isArray(
          json.events
        )
      ) {
        continue;
      }

      if (
        json.cur
      ) {
        packetCurrency =
          json.cur;
      }

      for (
        const event of
        json.events
      ) {
        if (
          event?.adUnitCode !==
          path
        ) {
          continue;
        }

        const bidders =
          Array.isArray(
            event?.bidders
          )
            ? event.bidders
            : [];

        for (
          const raw of bidders
        ) {
          const hbAdId =
            raw?.hbAdId ||
            "";

          const id =
            raw?.id ??
            "";

          const name =
            raw?.bidName ||
            (
              hbAdId
                ? registry.byHbAdId
                    .get(
                      `${path}|${hbAdId}`
                    )
                : ""
            ) ||
            (
              id !== ""
                ? registry.byId
                    .get(
                      `${path}|${id}`
                    )
                : ""
            ) ||
            (
              id !== ""
                ? `bidder_${id}`
                : "Unknown"
            );

          const key =
            hbAdId ||
            `${id}|${name}`;

          const current =
            groups.get(key) ||
            {
              bidder:
                name,

              bidderId:
                id,

              hbAdId,

              overrideId:
                raw?.overrideId ??
                null,

              originalBid:
                null,

              originalCurrency:
                "",

              bid:
                null,

              pubBid:
                null,

              grossBid:
                null,

              netBid:
                null,

              currency:
                packetCurrency ||
                "",

              winner:
                false,

              timeout:
                false,

              tte:
                null,

              bidFloored:
                null,

              bidCeiled:
                null,

              creativeId:
                "",

              sizes:
                [],

              source:
                "Bidmatic multitracking",

              eventTypes:
                []
            };

          if (
            raw?.bidName
          ) {
            current.bidder =
              raw.bidName;
          }

          if (
            raw?.id != null
          ) {
            current.bidderId =
              raw.id;
          }

          if (
            raw?.hbAdId
          ) {
            current.hbAdId =
              raw.hbAdId;
          }

          if (
            raw?.overrideId != null
          ) {
            current.overrideId =
              raw.overrideId;
          }

          if (
            safeNumber(
              raw?.originalBid
            ) != null
          ) {
            current.originalBid =
              safeNumber(
                raw.originalBid
              );
          }

          if (
            raw?.originalCurrency
          ) {
            current.originalCurrency =
              raw.originalCurrency;
          }

          if (
            safeNumber(
              raw?.bid
            ) != null
          ) {
            current.bid =
              safeNumber(
                raw.bid
              );
          }

          if (
            safeNumber(
              raw?.pubBid
            ) != null
          ) {
            current.pubBid =
              safeNumber(
                raw.pubBid
              );
          }

          if (
            safeNumber(
              raw?.grossBid
            ) != null
          ) {
            current.grossBid =
              safeNumber(
                raw.grossBid
              );
          }

          if (
            safeNumber(
              raw?.netBid
            ) != null
          ) {
            current.netBid =
              safeNumber(
                raw.netBid
              );
          }

          if (
            raw?.currency
          ) {
            current.currency =
              raw.currency;
          }

          if (
            raw?.winner === true
          ) {
            current.winner =
              true;
          }

          if (
            raw?.timeout === true
          ) {
            current.timeout =
              true;
          }

          if (
            safeNumber(
              raw?.tte
            ) != null
          ) {
            current.tte =
              safeNumber(
                raw.tte
              );
          }

          if (
            typeof raw?.bidFloored ===
            "boolean"
          ) {
            current.bidFloored =
              raw.bidFloored;
          }

          if (
            typeof raw?.bidCeiled ===
            "boolean"
          ) {
            current.bidCeiled =
              raw.bidCeiled;
          }

          if (
            raw?.creativeId
          ) {
            current.creativeId =
              raw.creativeId;
          }

          if (
            Array.isArray(
              raw?.sizes
            ) &&
            raw.sizes.length
          ) {
            current.sizes =
              raw.sizes;
          }

          if (
            event?.event != null &&
            !current.eventTypes
              .includes(
                event.event
              )
          ) {
            current.eventTypes
              .push(
                event.event
              );
          }

          groups.set(
            key,
            current
          );
        }
      }
    }

    return Array.from(
      groups.values()
    )
      .filter(
        b =>
          b.originalBid != null ||
          b.bid != null ||
          b.pubBid != null ||
          b.timeout ||
          b.winner
      )
      .sort(
        (
          a,
          b
        ) => {
          if (
            a.winner !==
            b.winner
          ) {
            return a.winner
              ? -1
              : 1;
          }

          if (
            a.timeout !==
            b.timeout
          ) {
            return a.timeout
              ? 1
              : -1;
          }

          return (
            (
              b.bid ??
              b.originalBid ??
              -1
            ) -
            (
              a.bid ??
              a.originalBid ??
              -1
            )
          );
        }
      );
  }

  function getBidmaticPacketSummary() {
    const valid =
      captureStore.packets
        .filter(
          p =>
            p.json &&
            Array.isArray(
              p.json.events
            )
        );

    const adUnits =
      new Set();

    let bidRows =
      0;

    for (
      const p of valid
    ) {
      for (
        const e of
        p.json.events ||
        []
      ) {
        if (
          e?.adUnitCode
        ) {
          adUnits.add(
            e.adUnitCode
          );
        }

        if (
          Array.isArray(
            e?.bidders
          )
        ) {
          bidRows +=
            e.bidders.length;
        }
      }
    }

    return {
      packets:
        valid.length,

      adUnits:
        adUnits.size,

      bidRows
    };
  }

  // ---------------------------------------------------------------------------
  // Privacy
  // ---------------------------------------------------------------------------

  function readTcData() {
    return new Promise(
      resolve => {
        try {
          if (
            typeof window.__tcfapi !==
            "function"
          ) {
            state.tcDataLoaded =
              true;

            state.tcData =
              null;

            resolve(null);

            return;
          }

          let done =
            false;

          const timer =
            setTimeout(
              () => {
                if (done) {
                  return;
                }

                done =
                  true;

                state.tcDataLoaded =
                  true;

                resolve(
                  state.tcData
                );
              },
              1000
            );

          window.__tcfapi(
            "getTCData",
            2,
            (
              tcData,
              success
            ) => {
              if (done) {
                return;
              }

              done =
                true;

              clearTimeout(
                timer
              );

              state.tcDataLoaded =
                true;

              state.tcData =
                success
                  ? tcData
                  : null;

              resolve(
                state.tcData
              );
            }
          );
        } catch (_) {
          state.tcDataLoaded =
            true;

          state.tcData =
            null;

          resolve(null);
        }
      }
    );
  }

  function getConsentStatus(
    request
  ) {
    const result = {
      gdprApplies:
        null,

      consentString:
        null,

      cmpPresent:
        typeof window.__tcfapi ===
        "function",

      cmpId:
        null,

      cmpVersion:
        null,

      tcfPolicyVersion:
        null,

      eventStatus:
        "",

      cmpStatus:
        "",

      gpp:
        null,

      usPrivacy:
        null,

      consentValue:
        "",

      gppValue:
        "",

      gppSid:
        "",

      usPrivacyValue:
        ""
    };

    const tc =
      state.tcData;

    if (tc) {
      if (
        typeof tc.gdprApplies ===
        "boolean"
      ) {
        result.gdprApplies =
          tc.gdprApplies;
      }

      result.consentValue =
        tc.tcString ||
        "";

      result.consentString =
        Boolean(
          tc.tcString
        );

      result.cmpId =
        tc.cmpId ??
        null;

      result.cmpVersion =
        tc.cmpVersion ??
        null;

      result.tcfPolicyVersion =
        tc.tcfPolicyVersion ??
        null;

      result.eventStatus =
        tc.eventStatus ||
        "";

      result.cmpStatus =
        tc.cmpStatus ||
        "";
    }

    const p =
      request?.parsed
        ?.params ||
      {};

    if (
      result.gdprApplies ==
      null
    ) {
      if (
        p.gdpr === "1"
      ) {
        result.gdprApplies =
          true;
      }

      if (
        p.gdpr === "0"
      ) {
        result.gdprApplies =
          false;
      }
    }

    if (
      result.consentString ==
        null &&
      "gdpr_consent" in p
    ) {
      result.consentString =
        Boolean(
          p.gdpr_consent
        );

      result.consentValue =
        p.gdpr_consent ||
        "";
    }

    if (p.gpp) {
      result.gpp =
        true;

      result.gppValue =
        p.gpp;
    } else if (
      p.gpp_sid &&
      p.gpp_sid !==
        "-1"
    ) {
      result.gpp =
        true;
    } else if (
      p.gpp_sid ===
      "-1"
    ) {
      result.gpp =
        false;
    }

    result.gppSid =
      p.gpp_sid ||
      "";

    if (
      p.us_privacy
    ) {
      result.usPrivacy =
        true;

      result.usPrivacyValue =
        p.us_privacy;
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Winner classification
  // ---------------------------------------------------------------------------

  function classifyWinner(
    slotData
  ) {
    const response =
      slotData.response;

    const raw =
      slotData.ids
        .lineItemId;

    const li =
      raw == null ||
      raw === ""
        ? null
        : Number(raw);

    if (
      response?.isBackfill ===
      true
    ) {
      return {
        label:
          "AdX",

        cls:
          "adx",

        type:
          "adx",

        reason:
          "GPT response isBackfill = true"
      };
    }

    if (
      li === -1
    ) {
      return {
        label:
          "AdX",

        cls:
          "adx",

        type:
          "adx",

        reason:
          "Line item ID = -1"
      };
    }

    if (
      li === -2
    ) {
      return {
        label:
          "UNFILLED",

        cls:
          "no",

        type:
          "unfilled",

        reason:
          "Line item ID = -2"
      };
    }

    if (
      Number.isFinite(li) &&
      li > 0
    ) {
      if (
        slotData.hbDetected
      ) {
        return {
          label:
            "HEADER BIDDING",

          cls:
            "hb",

          type:
            "hb",

          reason:
            "Positive line item with Header Bidding evidence"
        };
      }

      return {
        label:
          "OTHER LINE ITEM",

        cls:
          "yes",

        type:
          "other",

        reason:
          "Positive line item without Header Bidding evidence"
      };
    }

    if (
      slotData.hbDetected &&
      (
        firstTarget(
          slotData.targeting,
          "hb_bidder"
        ) ||
        slotData.hbRequest
          ?.bidder
      )
    ) {
      return {
        label:
          "HEADER BIDDING",

        cls:
          "hb",

        type:
          "hb",

        reason:
          "HB winner targeting detected"
      };
    }

    return {
      label:
        "UNRESOLVED",

      cls:
        "warn",

      type:
        "unresolved",

      reason:
        "No decisive winner signal"
    };
  }

  // ---------------------------------------------------------------------------
  // GAM links
  // ---------------------------------------------------------------------------

  function buildLineItemUrl(
    s,
    id
  ) {
    if (
      !s.networkCode ||
      !id ||
      Number(id) <= 0
    ) {
      return "";
    }

    return (
      `https://admanager.google.com/` +
      `${encodeURIComponent(s.networkCode)}` +
      `#delivery/line_item/detail/line_item_id=` +
      `${encodeURIComponent(id)}` +
      `&line_item=true&li_tab=settings`
    );
  }

  function buildAdvertiserUrl(
    s,
    id
  ) {
    if (
      !s.networkCode ||
      !id
    ) {
      return "";
    }

    return (
      `https://admanager.google.com/` +
      `${encodeURIComponent(s.networkCode)}` +
      `#admin/company/detail/company_id=` +
      `${encodeURIComponent(id)}`
    );
  }

  function buildOrderUrl(
    s,
    id
  ) {
    if (
      !s.networkCode ||
      !id
    ) {
      return "";
    }

    return (
      `https://admanager.google.com/` +
      `${encodeURIComponent(s.networkCode)}` +
      `#delivery/order/order_overview/order_id=` +
      `${encodeURIComponent(id)}`
    );
  }

  function buildTroubleshootingUrl(
    s
  ) {
    if (
      !s.networkCode ||
      !s.ids.queryId
    ) {
      return "";
    }

    return (
      `https://admanager.google.com/` +
      `${encodeURIComponent(s.networkCode)}` +
      `#troubleshooting/screenshot/query_id=` +
      `${encodeURIComponent(s.ids.queryId)}`
    );
  }

  function linkedId(
    value,
    url,
    label
  ) {
    if (
      value == null ||
      value === ""
    ) {
      return `
        <span class="muted">
          Not available
        </span>
      `;
    }

    if (!url) {
      return `
        ${esc(value)}
        ${copyButton(value)}
      `;
    }

    return `
      <a
        class="id-link"
        href="${esc(url)}"
        target="_blank"
        rel="noopener noreferrer"
      >
        ${esc(value)}
      </a>

      ${copyButton(value)}

      <br>

      <a
        class="open-link"
        href="${esc(url)}"
        target="_blank"
        rel="noopener noreferrer"
      >
        Open ${esc(label)} in GAM ↗
      </a>
    `;
  }

  // ---------------------------------------------------------------------------
  // Slot collection
  // ---------------------------------------------------------------------------

  function collectSlots() {
    const gt =
      getGoogletag();

    state.slots = [];
    state.ignored = [];

    if (!gt) {
      body.innerHTML = `
        <div class="empty">
          GPT API is not available.
        </div>
      `;

      return;
    }

    let rawSlots = [];

    try {
      rawSlots =
        gt.pubads()
          .getSlots() ||
        [];
    } catch (_) {}

    const pageTargeting =
      getPageTargeting();

    rawSlots.forEach(
      (
        slot,
        originalIndex
      ) => {
        const divId =
          getSlotDivId(
            slot
          );

        const adUnitPath =
          getAdUnitPath(
            slot
          );

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
            adUnitPath,
            divId,

            reason:
              !divId
                ? "No DIV ID"
                : "DIV not found in DOM"
          });

          return;
        }

        const targeting =
          getTargeting(
            slot
          );

        const response =
          getResponseInfo(
            slot
          );

        const data = {
          originalIndex,
          slot,
          divId,
          adUnitPath,
          oop,
          element,
          targeting,
          pageTargeting,
          response,

          networkCode:
            getNetworkCode(
              adUnitPath
            ),

          sizes:
            getSlotSizes(
              slot
            )
        };

        data.bestRequest =
          getBestGamRequest(
            data
          );

        data.hbRequest =
          getHbFromRequest(
            data.bestRequest
          );

        data.ids =
          getIdsFromResponse(
            response
          );

        data.bidmaticBids =
          getBidmaticBidsForSlot(
            adUnitPath
          );

        data.prebidBids =
          getPbjsBidsForSlot(
            data
          );

        data.hbDetected =
          Boolean(
            data.hbRequest ||
            data.bidmaticBids
              .length ||
            data.prebidBids
              .length ||
            Object.keys(
              getHbTargeting(
                targeting
              )
            ).length ||
            Object.keys(
              pageTargeting
            )
              .some(
                k =>
                  /^hb/i
                    .test(k)
              )
          );

        data.hbWrapperEvidence =
          getHbWrapperEvidence(
            data
          );

        data.consent =
          getConsentStatus(
            data.bestRequest
          );

        data.winner =
          classifyWinner(
            data
          );

        if (element) {
          try {
            const r =
              element
                .getBoundingClientRect();

            data.domSize =
              `${Math.round(r.width)}` +
              "x" +
              `${Math.round(r.height)}`;
          } catch (_) {
            data.domSize =
              "—";
          }
        } else {
          data.domSize =
            "OUT OF PAGE";
        }

        state.slots.push(
          data
        );
      }
    );

    $("#slotCount")
      .textContent =
      `${state.slots.length} active`;

    select.innerHTML =
      "";

    state.slots.forEach(
      (
        s,
        index
      ) => {
        const option =
          document.createElement(
            "option"
          );

        option.value =
          String(index);

        option.textContent =
          `${index + 1}. ` +
          `${s.adUnitPath}` +
          `${s.oop ? " · OOP" : ""}` +
          ` · ${s.winner.label}`;

        select.appendChild(
          option
        );
      }
    );

    if (
      state.selected >=
      state.slots.length
    ) {
      state.selected =
        0;
    }

    select.value =
      String(
        state.selected
      );

    renderCaptureStatus();
    renderSelected();
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  function renderCaptureStatus() {
    const sum =
      getBidmaticPacketSummary();

    const selected =
      state.slots[
        state.selected
      ];

    const selectedCount =
      selected
        ? getBidmaticBidsForSlot(
            selected.adUnitPath
          ).length
        : 0;

    if (
      sum.packets > 0
    ) {
      $("#captureStatus")
        .innerHTML = `
          <span class="capture-ok">
            Bidmatic capture active
          </span>

          · packets ${sum.packets}
          · ad units ${sum.adUnits}
          · bidder rows ${sum.bidRows}
          ${
            selected
              ? `· selected bids ${selectedCount}`
              : ""
          }
        `;
    } else {
      $("#captureStatus")
        .innerHTML = `
          <span class="capture-wait">
            Bidmatic capture armed
          </span>

          · no multitracking payload captured yet.
          It will capture the next auction / refresh after Debugr was opened.
        `;
    }
  }

  function getWinnerBidder(s) {
    return (
      firstTarget(
        s.targeting,
        "hb_bidder"
      ) ||
      s.hbRequest?.bidder ||
      s.bidmaticBids
        .find(
          b =>
            b.winner
        )
        ?.bidder ||
      ""
    );
  }

  function getGamBucket(s) {
    return (
      firstTarget(
        s.targeting,
        "hb_pb"
      ) ||
      s.hbRequest?.bucket ||
      ""
    );
  }

  function renderBidTable(s) {
    const bids =
      s.bidmaticBids.length
        ? s.bidmaticBids
        : s.prebidBids;

    if (
      !bids.length
    ) {
      const bidder =
        getWinnerBidder(s);

      const bucket =
        getGamBucket(s);

      if (
        s.hbDetected &&
        bidder
      ) {
        return `
          <div class="grid">

            ${kv(
              "Bidder sent to GAM",
              `
                <span class="hb">
                  ${esc(bidder)}
                </span>
              `
            )}

            ${kv(
              "GAM bucket",
              bucket !== ""
                ? esc(
                    money(
                      bucket,
                      ""
                    )
                  )
                : "—"
            )}

            ${kv(
              "Auction capture",
              `
                <span class="warn">
                  WAITING FOR NEXT AUCTION
                </span>
              `
            )}

          </div>
        `;
      }

      return `
        <div class="empty">
          No captured bidder rows yet.
          Debugr is armed for the next Bidmatic multitracking event.
        </div>
      `;
    }

    const packetCurrency =
      captureStore.packets
        .slice()
        .reverse()
        .find(
          p =>
            p.json?.cur
        )
        ?.json?.cur ||
      "";

    const rows =
      bids.map(
        b => {
          const sizes =
            Array.isArray(
              b.sizes
            )
              ? b.sizes
                  .map(
                    x =>
                      x &&
                      typeof x ===
                        "object"
                        ? `${x.w}x${x.h}`
                        : String(x)
                  )
                  .join(", ")
              : (
                  b.size ||
                  "—"
                );

          const status =
            b.timeout
              ? "TIMEOUT"
              : b.winner
                ? "HB WINNER"
                : "BID";

          const rowClass =
            b.timeout
              ? "timeout-row"
              : b.winner
                ? "winner-row"
                : "";

          return `
            <tr class="${rowClass}">

              <td>
                ${b.winner ? "★ " : ""}
                ${esc(b.bidder)}
              </td>

              <td>
                ${esc(
                  money(
                    b.originalBid,
                    b.originalCurrency ||
                    ""
                  )
                )}
              </td>

              <td>
                ${esc(
                  money(
                    b.bid,
                    b.currency ||
                    packetCurrency
                  )
                )}
              </td>

              <td>
                ${esc(
                  money(
                    b.pubBid,
                    b.currency ||
                    packetCurrency
                  )
                )}
              </td>

              <td>
                ${esc(
                  b.tte != null
                    ? `${Math.round(b.tte)} ms`
                    : "—"
                )}
              </td>

              <td>
                ${esc(sizes)}
              </td>

              <td>
                ${
                  b.timeout
                    ? `
                        <span class="no">
                          ${status}
                        </span>
                      `
                    : b.winner
                      ? `
                          <span class="hb">
                            ${status}
                          </span>
                        `
                      : esc(status)
                }
              </td>

            </tr>
          `;
        }
      )
      .join("");

    return `
      <table class="bidtable">

        <thead>
          <tr>
            <th>Bidder</th>
            <th>Original bid</th>
            <th>Adjusted bid</th>
            <th>Publisher bid</th>
            <th>TTE</th>
            <th>Size</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          ${rows}
        </tbody>

      </table>
    `;
  }

  function sanitizeParams(params) {
    const out = {};

    for (
      const [
        k,
        v
      ] of
      Object.entries(
        params ||
        {}
      )
    ) {
      if (
        k === "gdpr_consent" ||
        k === "gpp" ||
        k === "addtl_consent" ||
        k === "cookie" ||
        k === "gpic" ||
        k === "eo_id_str"
      ) {
        out[k] = {
          present:
            Boolean(v),

          length:
            String(
              v ||
              ""
            ).length
        };
      } else {
        out[k] =
          v;
      }
    }

    return out;
  }

  function buildDiagnosticExport(s) {
    const ids =
      s.ids;

    return {
      debugr: {
        tool:
          "Debugr Troubleshooting",

        exportedAt:
          new Date()
            .toISOString(),

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

        tcfApiAvailable:
          typeof window.__tcfapi ===
          "function",

        totalActiveSlots:
          state.slots.length,

        totalIgnoredSlots:
          state.ignored.length,

        bidmaticCapture: {
          installed:
            captureStore.installed,

          installedAt:
            new Date(
              captureStore.installedAt
            ).toISOString(),

          stats:
            captureStore.stats,

          summary:
            getBidmaticPacketSummary()
        }
      },

      selectedSlot: {
        index:
          state.selected,

        originalIndex:
          s.originalIndex,

        adUnitPath:
          s.adUnitPath,

        divId:
          s.divId,

        networkCode:
          s.networkCode,

        outOfPage:
          s.oop,

        configuredSizes:
          s.sizes,

        domSize:
          s.domSize,

        elementExists:
          Boolean(
            s.element
          )
      },

      auction: {
        winner:
          s.winner,

        ids,

        isBackfill:
          s.response
            ?.isBackfill ??
          null,

        gamLinks: {
          lineItem:
            buildLineItemUrl(
              s,
              ids.lineItemId
            ),

          advertiser:
            buildAdvertiserUrl(
              s,
              ids.advertiserId
            ),

          order:
            buildOrderUrl(
              s,
              ids.orderId
            ),

          troubleshooting:
            buildTroubleshootingUrl(
              s
            )
        }
      },

      gpt: {
        responseInformation:
          s.response,

        slotTargeting:
          s.targeting,

        pageTargeting:
          s.pageTargeting
      },

      gamRequest:
        s.bestRequest
          ? {
              found:
                true,

              match:
                s.bestRequest
                  .match,

              params:
                sanitizeParams(
                  s.bestRequest
                    .parsed
                    .params
                ),

              prevScp:
                s.bestRequest
                  .parsed
                  .prevScp,

              custParams:
                s.bestRequest
                  .parsed
                  .custParams
            }
          : {
              found:
                false
            },

      headerBidding: {
        detected:
          s.hbDetected,

        bidderSentToGam:
          getWinnerBidder(s),

        gamPriceBucket:
          getGamBucket(s),

        requestData:
          s.hbRequest,

        wrapperEvidence:
          s.hbWrapperEvidence,

        bidmaticBids:
          s.bidmaticBids,

        prebidBids:
          s.prebidBids,

        hbTargeting:
          getHbTargeting(
            s.targeting
          )
      },

      privacy: {
        gdprApplies:
          s.consent.gdprApplies,

        cmpPresent:
          s.consent.cmpPresent,

        cmpId:
          s.consent.cmpId,

        cmpVersion:
          s.consent.cmpVersion,

        tcfPolicyVersion:
          s.consent.tcfPolicyVersion,

        eventStatus:
          s.consent.eventStatus,

        cmpStatus:
          s.consent.cmpStatus,

        consentStringPresent:
          s.consent.consentString,

        consentStringLength:
          String(
            s.consent.consentValue ||
            ""
          ).length,

        gpp:
          s.consent.gpp,

        gppSid:
          s.consent.gppSid,

        usPrivacy:
          s.consent.usPrivacy
      },

      ignoredSlots:
        state.ignored
    };
  }

  function renderSelected() {
    const s =
      state.slots[
        state.selected
      ];

    if (!s) {
      body.innerHTML = `
        <div class="empty">
          No active slot selected.
        </div>
      `;

      return;
    }

    const ids =
      s.ids;

    const winnerBidder =
      getWinnerBidder(s);

    const bucket =
      getGamBucket(s);

    const bidmaticWinner =
      s.bidmaticBids
        .find(
          b =>
            b.winner
        ) ||
      null;

    const winnerRows = [
      kv(
        "Winner",
        `
          <span class="${s.winner.cls}">
            ${esc(
              s.winner.label
            )}
          </span>
        `
      )
    ];

    if (
      s.winner.type ===
        "hb" &&
      winnerBidder
    ) {
      winnerRows.push(
        kv(
          "HB bidder",
          `
            <span class="hb">
              ${esc(
                winnerBidder
              )}
            </span>
          `
        )
      );
    }

    if (
      s.response?.isBackfill ===
      true
    ) {
      winnerRows.push(
        kv(
          "Backfill",
          `
            <span class="yes">
              YES
            </span>
          `
        )
      );
    }

    if (
      Number(
        ids.lineItemId
      ) > 0
    ) {
      winnerRows.push(
        kv(
          "Line item ID",
          linkedId(
            ids.lineItemId,
            buildLineItemUrl(
              s,
              ids.lineItemId
            ),
            "line item"
          )
        )
      );
    }

    if (
      ids.creativeId != null
    ) {
      winnerRows.push(
        kv(
          "Creative ID",
          `
            ${esc(
              ids.creativeId
            )}

            ${copyButton(
              ids.creativeId
            )}
          `
        )
      );
    }

    if (
      ids.sourceAgnosticLineItemId !=
        null &&
      ids.sourceAgnosticLineItemId !==
        ids.lineItemId
    ) {
      winnerRows.push(
        kv(
          "Source Line Item ID",
          `
            ${esc(
              ids.sourceAgnosticLineItemId
            )}

            ${copyButton(
              ids.sourceAgnosticLineItemId
            )}
          `
        )
      );
    }

    if (
      ids.sourceAgnosticCreativeId !=
        null &&
      ids.sourceAgnosticCreativeId !==
        ids.creativeId
    ) {
      winnerRows.push(
        kv(
          "Source Creative ID",
          `
            ${esc(
              ids.sourceAgnosticCreativeId
            )}

            ${copyButton(
              ids.sourceAgnosticCreativeId
            )}
          `
        )
      );
    }

    if (
      ids.advertiserId !=
      null
    ) {
      winnerRows.push(
        kv(
          "Advertiser ID",
          linkedId(
            ids.advertiserId,
            buildAdvertiserUrl(
              s,
              ids.advertiserId
            ),
            "advertiser"
          )
        )
      );
    }

    if (
      ids.orderId !=
      null
    ) {
      winnerRows.push(
        kv(
          "Order ID",
          linkedId(
            ids.orderId,
            buildOrderUrl(
              s,
              ids.orderId
            ),
            "order"
          )
        )
      );
    }

    winnerRows.push(
      kv(
        "Query ID",
        ids.queryId
          ? linkedId(
              ids.queryId,
              buildTroubleshootingUrl(
                s
              ),
              "Troubleshooting"
            )
          : `
              <span class="muted">
                Not available
              </span>
            `
      )
    );

    const hbRows = [
      kv(
        "HB detected",
        yesNo(
          s.hbDetected
        )
      ),

      kv(
        "Bidmatic capture",
        s.bidmaticBids.length
          ? `
              <span class="yes">
                ${s.bidmaticBids.length} BIDDER ROWS
              </span>
            `
          : `
              <span class="warn">
                WAITING FOR NEXT AUCTION
              </span>
            `
      )
    ];

    if (
      winnerBidder
    ) {
      hbRows.push(
        kv(
          "Bidder sent to GAM",
          `
            <span class="hb">
              ${esc(
                winnerBidder
              )}
            </span>
          `
        )
      );
    }

    if (
      bucket !== ""
    ) {
      hbRows.push(
        kv(
          "GAM price bucket",
          esc(
            money(
              bucket,
              ""
            )
          )
        )
      );
    }

    if (
      bidmaticWinner
    ) {
      hbRows.push(
        kv(
          "HB auction winner",
          `
            <span class="hb">
              ${esc(
                bidmaticWinner.bidder
              )}
            </span>
          `
        )
      );

      hbRows.push(
        kv(
          "Original bid",
          esc(
            money(
              bidmaticWinner.originalBid,
              bidmaticWinner.originalCurrency ||
              ""
            )
          )
        )
      );

      hbRows.push(
        kv(
          "Adjusted bid",
          esc(
            money(
              bidmaticWinner.bid,
              bidmaticWinner.currency ||
              ""
            )
          )
        )
      );

      hbRows.push(
        kv(
          "Publisher bid",
          esc(
            money(
              bidmaticWinner.pubBid,
              bidmaticWinner.currency ||
              ""
            )
          )
        )
      );
    }

    body.innerHTML = `
      <div class="section">

        <div class="section-title">
          Slot
        </div>

        <div class="grid">

          ${kv(
            "Ad unit",
            `
              ${esc(
                s.adUnitPath
              )}

              ${copyButton(
                s.adUnitPath
              )}
            `
          )}

          ${kv(
            "DIV",
            s.oop
              ? `
                  <span class="hb">
                    OUT OF PAGE
                  </span>
                `
              : `
                  ${esc(
                    s.divId
                  )}

                  ${copyButton(
                    s.divId
                  )}
                `
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
            s.bestRequest
              ? `
                  <span class="yes">
                    YES
                  </span>
                `
              : `
                  <span class="warn">
                    NOT MATCHED
                  </span>
                `
          )}

        </div>

      </div>

      <div class="section">

        <div class="section-title">
          Auction result
        </div>

        <div class="grid">
          ${winnerRows.join("")}
        </div>

      </div>

      <div class="section">

        <div class="section-title">
          Header Bidding
        </div>

        <div class="grid">
          ${hbRows.join("")}
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

          ${kv(
            "GDPR applies",
            yesNo(
              s.consent.gdprApplies
            )
          )}

          ${kv(
            "TCF CMP",
            yesNo(
              s.consent.cmpPresent
            )
          )}

          ${kv(
            "Consent string",
            s.consent.consentString ==
              null
              ? `
                  <span class="muted">
                    UNKNOWN
                  </span>
                `
              : yesNo(
                  s.consent.consentString
                )
          )}

          ${kv(
            "CMP ID",
            esc(
              s.consent.cmpId ??
              "—"
            )
          )}

          ${kv(
            "TCF version",
            esc(
              s.consent.tcfPolicyVersion ??
              "—"
            )
          )}

          ${kv(
            "CMP status",
            esc(
              s.consent.cmpStatus ||
              "—"
            )
          )}

        </div>

      </div>

      <div class="section">

        <details>

          <summary>
            Advanced
          </summary>

          <div class="section-title">
            Bidmatic bids
          </div>

          <pre>${esc(
            stringify(
              s.bidmaticBids
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
            HB wrapper evidence
          </div>

          <pre>${esc(
            stringify(
              s.hbWrapperEvidence
            )
          )}</pre>

          <div class="section-title">
            GAM request
          </div>

          <pre>${esc(
            stringify(
              s.bestRequest
                ? {
                    match:
                      s.bestRequest
                        .match,

                    params:
                      sanitizeParams(
                        s.bestRequest
                          .parsed
                          .params
                      ),

                    prevScp:
                      s.bestRequest
                        .parsed
                        .prevScp,

                    custParams:
                      s.bestRequest
                        .parsed
                        .custParams
                  }
                : null
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

        </details>

      </div>
    `;

    bindCopyButtons();

    $("#footer")
      .textContent =
      `GPT ${getGoogletag() ? "✓" : "✕"}` +
      ` · Winner ${s.winner.label}` +
      ` · HB ${s.hbDetected ? "✓" : "✕"}` +
      ` · Bidmatic ${s.bidmaticBids.length ? "✓" : "waiting"}`;
  }

  function bindCopyButtons() {
    body
      .querySelectorAll(
        "[data-copy]"
      )
      .forEach(
        button => {
          button.addEventListener(
            "click",
            async event => {
              event.stopPropagation();

              const value =
                button.getAttribute(
                  "data-copy"
                ) ||
                "";

              const old =
                button.textContent;

              if (
                await copyText(
                  value
                )
              ) {
                button.textContent =
                  "Copied";

                setTimeout(
                  () => {
                    button.textContent =
                      old;
                  },
                  800
                );
              }
            }
          );
        }
      );
  }

  // ---------------------------------------------------------------------------
  // Highlight
  // ---------------------------------------------------------------------------

  function highlightSelectedSlot() {
    const s =
      state.slots[
        state.selected
      ];

    document
      .getElementById(
        HIGHLIGHT_ID
      )
      ?.remove();

    if (
      !s ||
      s.oop ||
      !s.element
    ) {
      $("#footer")
        .textContent =
        "Highlight unavailable for this slot";

      return;
    }

    try {
      s.element
        .scrollIntoView({
          behavior:
            "smooth",

          block:
            "center",

          inline:
            "center"
        });
    } catch (_) {}

    setTimeout(
      () => {
        try {
          const rect =
            s.element
              .getBoundingClientRect();

          const overlay =
            document.createElement(
              "div"
            );

          overlay.id =
            HIGHLIGHT_ID;

          overlay.style.cssText =
            [
              "position:fixed",

              `left:${Math.max(
                0,
                rect.left - 4
              )}px`,

              `top:${Math.max(
                0,
                rect.top - 4
              )}px`,

              `width:${Math.max(
                10,
                rect.width + 8
              )}px`,

              `height:${Math.max(
                10,
                rect.height + 8
              )}px`,

              "z-index:2147483646",

              "pointer-events:none",

              "border:4px solid #ffcc00",

              "box-shadow:0 0 0 2px rgba(0,0,0,.8),0 0 24px rgba(255,204,0,.95)",

              "border-radius:6px"
            ]
              .join(";");

          const label =
            document.createElement(
              "div"
            );

          label.textContent =
            s.adUnitPath;

          label.style.cssText =
            "position:absolute;left:0;top:-30px;max-width:500px;padding:5px 8px;font:700 12px Arial,sans-serif;color:#111;background:#ffcc00;border-radius:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 8px rgba(0,0,0,.35)";

          overlay
            .appendChild(
              label
            );

          document.documentElement
            .appendChild(
              overlay
            );

          setTimeout(
            () =>
              overlay.remove(),
            5000
          );
        } catch (_) {}
      },
      350
    );
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  async function refresh() {
    const current =
      state.slots[
        state.selected
      ];

    const previousDiv =
      current?.divId ||
      "";

    const previousPath =
      current?.adUnitPath ||
      "";

    await readTcData();

    collectSlots();

    const idx =
      state.slots
        .findIndex(
          s =>
            (
              previousDiv &&
              s.divId ===
                previousDiv
            ) ||
            (
              previousPath &&
              s.adUnitPath ===
                previousPath
            )
        );

    if (
      idx >= 0
    ) {
      state.selected =
        idx;

      select.value =
        String(idx);

      renderCaptureStatus();
      renderSelected();
    }
  }

  select.addEventListener(
    "change",
    () => {
      state.selected =
        Number(
          select.value
        ) ||
        0;

      renderCaptureStatus();
      renderSelected();
    }
  );

  $("#highlightBtn")
    .addEventListener(
      "click",
      highlightSelectedSlot
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
        const s =
          state.slots[
            state.selected
          ];

        if (!s) {
          return;
        }

        const button =
          $("#copyJsonBtn");

        const old =
          button.textContent;

        const ok =
          await copyText(
            JSON.stringify(
              buildDiagnosticExport(
                s
              ),
              null,
              2
            )
          );

        button.textContent =
          ok
            ? "JSON copied ✓"
            : "Copy failed";

        setTimeout(
          () => {
            button.textContent =
              old;
          },
          1300
        );
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

        if (
          state.timer
        ) {
          clearInterval(
            state.timer
          );
        }

        state.timer =
          state.auto
            ? setInterval(
                refresh,
                2000
              )
            : null;
      }
    );

  $("#consoleBtn")
    .addEventListener(
      "click",
      () => {
        const gt =
          getGoogletag();

        try {
          if (
            gt &&
            typeof gt.openConsole ===
              "function"
          ) {
            gt.openConsole();
          }
        } catch (_) {}
      }
    );

  $("#closeBtn")
    .addEventListener(
      "click",
      () => {
        if (
          state.timer
        ) {
          clearInterval(
            state.timer
          );
        }

        captureStore.listeners
          .delete(
            onCapture
          );

        document
          .getElementById(
            HIGHLIGHT_ID
          )
          ?.remove();

        host.remove();
      }
    );

  function onCapture() {
    collectSlots();
  }

  captureStore.listeners
    .add(
      onCapture
    );

  (async () => {
    await readTcData();

    collectSlots();
  })();

})();
