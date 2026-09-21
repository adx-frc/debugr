(() => {
  "use strict";

  const APP_ID = "__debugr_troubleshooting__";
  const HIGHLIGHT_ID = "__debugr_slot_highlight__";

  const old = document.getElementById(APP_ID);

  if (old) {
    old.remove();

    const oldHighlight =
      document.getElementById(HIGHLIGHT_ID);

    if (oldHighlight) {
      oldHighlight.remove();
    }

    return;
  }

  const state = {
    slots: [],
    selected: 0,
    showIgnored: false,
    ignored: [],
    timer: null,
    auto: false,
    tcData: null,
    tcDataLoaded: false
  };

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
            640px,
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
          rgba(15, 21, 30, 0.78);

        border:
          1px solid
          rgba(100,120,145,.58);

        border-radius: 14px;

        box-shadow:
          0 18px 60px
          rgba(0,0,0,.50);

        backdrop-filter:
          blur(7px);

        -webkit-backdrop-filter:
          blur(7px);
      }

      .header {
        display: flex;
        align-items: center;

        gap: 9px;

        padding:
          11px 12px;

        background:
          rgba(22,30,41,.82);

        border-bottom:
          1px solid
          rgba(90,110,135,.45);
      }

      .title {
        font-size: 15px;
        font-weight: 800;
      }

      .pill {
        border:
          1px solid
          rgba(100,125,155,.65);

        border-radius: 999px;

        padding: 2px 7px;

        font-size: 11px;

        color: #c1ccda;

        background:
          rgba(10,15,22,.35);
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

        background:
          rgba(28,38,51,.88);

        border:
          1px solid
          rgba(90,110,140,.72);

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
          rgba(17,25,35,.76);

        border-bottom:
          1px solid
          rgba(90,110,135,.40);
      }

      select {
        width: 100%;
        min-width: 0;

        padding:
          7px 9px;

        color: #edf3fb;

        background:
          rgba(8,14,21,.82);

        border:
          1px solid
          rgba(85,105,135,.72);

        border-radius: 8px;
      }

      .subcontrols {
        display: flex;

        gap: 7px;

        padding:
          0 10px 9px 10px;

        background:
          rgba(17,25,35,.76);

        border-bottom:
          1px solid
          rgba(90,110,135,.40);

        flex-wrap: wrap;
      }

      .body {
        overflow: auto;

        max-height:
          calc(100vh - 162px);

        padding: 10px;
      }

      .section {
        margin-bottom: 10px;

        overflow: hidden;

        background:
          rgba(17,25,35,.73);

        border:
          1px solid
          rgba(80,100,125,.48);

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
          rgba(24,33,45,.85);

        border-bottom:
          1px solid
          rgba(80,100,125,.45);
      }

      .grid {
        display: grid;

        grid-template-columns:
          158px
          minmax(0,1fr);
      }

      .k,
      .v {
        padding:
          7px 9px;

        border-bottom:
          1px solid
          rgba(65,80,100,.38);
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

        margin-left:
          5px;

        font-size:
          10px;
      }

      .link {
        color: #83b5ff;

        text-decoration:
          none;

        font-weight: 650;
      }

      .link:hover {
        text-decoration:
          underline;
      }

      .id-link {
        color: #eef4fb;

        text-decoration:
          none;

        border-bottom:
          1px dotted
          rgba(131,181,255,.7);
      }

      .id-link:hover {
        color: #83b5ff;
      }

      .open-link {
        display: inline-block;

        margin-top: 3px;

        color: #83b5ff;

        text-decoration:
          none;

        font-size:
          11px;
      }

      .open-link:hover {
        text-decoration:
          underline;
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

        text-align:
          left;

        vertical-align:
          top;

        border-bottom:
          1px solid
          rgba(65,80,100,.38);
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
          rgba(53,201,175,.10);
      }

      .empty {
        padding: 14px;

        text-align: center;

        color: #8c9bad;
      }

      details {
        background:
          rgba(8,14,21,.48);
      }

      summary {
        cursor: pointer;

        padding:
          9px 10px;

        font-weight:
          700;

        color:
          #b6c1cf;

        background:
          rgba(24,33,45,.75);
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

      .ignored {
        padding:
          8px 10px;

        color:
          #8f9bad;

        font-size:
          11px;
      }

      .footer {
        padding:
          7px 10px;

        border-top:
          1px solid
          rgba(90,110,135,.40);

        color:
          #91a0b2;

        font-size:
          11px;

        background:
          rgba(17,25,35,.78);
      }

      @media (max-width: 650px) {
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
            calc(100vh - 170px);
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

        <button id="ignoredBtn">
          Ignored: 0
        </button>

        <button id="consoleBtn">
          Publisher Console
        </button>

      </div>

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

  function esc(value) {
    return String(
      value ?? ""
    )
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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
    const n =
      Number(value);

    return Number.isFinite(n)
      ? n
      : null;
  }

  function money(
    value,
    currency = "USD"
  ) {
    const n =
      safeNumber(value);

    if (n === null) {
      return "—";
    }

    let out;

    if (n >= 1) {
      out =
        n.toFixed(2);
    } else if (n >= 0.01) {
      out =
        n
          .toFixed(3)
          .replace(/0+$/, "")
          .replace(/\.$/, "");
    } else {
      out =
        n
          .toFixed(4)
          .replace(/0+$/, "")
          .replace(/\.$/, "");
    }

    return (
      `${out} ${currency || ""}`
        .trim()
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
      value === undefined ||
      value === null ||
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
        typeof window.pbjs ===
          "object"
      ) {
        return window.pbjs;
      }
    } catch (_) {}

    return null;
  }

  function getNetworkCode(
    adUnitPath
  ) {
    const match =
      String(
        adUnitPath ||
        ""
      ).match(
        /^\/(\d+)\//
      );

    return match
      ? match[1]
      : "";
  }

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

          return String(
            size
          );
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

      keys.forEach(
        key => {
          try {
            out[key] =
              slot.getTargeting(
                key
              );
          } catch (_) {}
        }
      );
    } catch (_) {}

    return out;
  }

  function getPageTargeting() {
    const gt =
      getGoogletag();

    const out = {};

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

      keys.forEach(
        key => {
          try {
            out[key] =
              pubads.getTargeting(
                key
              );
          } catch (_) {}
        }
      );
    } catch (_) {}

    return out;
  }

  function getResponseInfo(slot) {
    try {
      if (
        typeof slot.getResponseInformation ===
        "function"
      ) {
        return (
          slot.getResponseInformation() ||
          null
        );
      }
    } catch (_) {}

    return null;
  }

  function firstTarget(
    targeting,
    key
  ) {
    const value =
      targeting &&
      targeting[key];

    if (
      Array.isArray(value)
    ) {
      return value.length
        ? value[0]
        : "";
    }

    return value ?? "";
  }

  function isOutOfPage(
    slot,
    adUnitPath,
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

    const text =
      `${adUnitPath || ""} ${divId || ""}`
        .toLowerCase();

    return (
      /\b(interstitial|anchor|rewarded|out[-_ ]?of[-_ ]?page|oop)\b/
        .test(text)
    );
  }

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

    decoded
      .replace(/^\?/, "")
      .split("&")
      .forEach(
        part => {
          if (!part) {
            return;
          }

          const eq =
            part.indexOf("=");

          let key;
          let value;

          if (eq === -1) {
            key = part;
            value = "";
          } else {
            key =
              part.slice(
                0,
                eq
              );

            value =
              part.slice(
                eq + 1
              );
          }

          try {
            key =
              decodeURIComponent(
                key
              );
          } catch (_) {}

          try {
            value =
              decodeURIComponent(
                value
              );
          } catch (_) {}

          if (key) {
            out[key] =
              value;
          }
        }
      );

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
      /gampad\/ads|pagead\/ads/i
        .test(url)
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
          (value, key) => {
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
      parsed.params ||
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
      parsed.params ||
      {};

    const prev =
      parsed.prevScp ||
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
      String(p.dids)
        .split(",")
        .includes(divId)
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

    const requestPath =
      getRequestAdUnitPath(
        parsed
      );

    if (
      requestPath &&
      path &&
      requestPath ===
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
      requestPath &&
      path &&
      (
        requestPath.endsWith(
          path
        ) ||
        path.endsWith(
          requestPath
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
        resource =>
          isGamRequestUrl(
            resource.url
          )
      )
      .map(
        resource => {
          const parsed =
            parseGamRequest(
              resource.url
            );

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
        }
      )
      .filter(
        item =>
          item.match.matched
      )
      .sort(
        (a, b) => {
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
        }
      );
  }

  function getBestGamRequest(
    slotData
  ) {
    const requests =
      findGamRequests(
        slotData
      );

    return requests.length
      ? requests[0]
      : null;
  }

  function getHbFromRequest(
    request
  ) {
    if (
      !request ||
      !request.parsed
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
      Object.values(data)
        .some(
          value =>
            value !== "" &&
            value !== false &&
            value !== null
        );

    return data.detected
      ? data
      : null;
  }

  function getHbWrapperEvidence(
    slotData
  ) {
    const evidence = [];

    const page =
      slotData.pageTargeting ||
      {};

    const slot =
      slotData.targeting ||
      {};

    const inspect =
      (
        obj,
        source
      ) => {
        Object.keys(obj)
          .forEach(
            key => {
              if (
                /^hb/i.test(key) ||
                /header.?bid/i
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
          );
      };

    inspect(
      page,
      "pageTargeting"
    );

    inspect(
      slot,
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

    return evidence;
  }

  function normalizePbResponseObject(
    raw
  ) {
    const bids = [];

    if (!raw) {
      return bids;
    }

    if (
      Array.isArray(raw)
    ) {
      raw.forEach(
        item => {
          if (
            item &&
            typeof item ===
              "object"
          ) {
            bids.push(item);
          }
        }
      );

      return bids;
    }

    if (
      Array.isArray(
        raw.bids
      )
    ) {
      raw.bids.forEach(
        item => {
          if (
            item &&
            typeof item ===
              "object"
          ) {
            bids.push(item);
          }
        }
      );
    }

    return bids;
  }

  function getPbjsBids() {
    const pbjs =
      getPbjs();

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
          pbjs.getBidResponses() ||
          {};

        Object.keys(
          responses
        ).forEach(
          adUnitCode => {
            normalizePbResponseObject(
              responses[
                adUnitCode
              ]
            ).forEach(
              bid => {
                bids.push({
                  ...bid,

                  __source:
                    "pbjs",

                  __adUnitCode:
                    bid.adUnitCode ||
                    adUnitCode
                });
              }
            );
          }
        );
      }
    } catch (_) {}

    return bids;
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
        bid.divId ||
        bid.slotId ||
        ""
      );

    const div =
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

    const bidAdId =
      String(
        bid.adId ||
        bid.bidId ||
        ""
      );

    const hbAdId =
      String(
        (
          slotData.hbRequest &&
          slotData.hbRequest.adId
        ) ||
        firstTarget(
          slotData.targeting,
          "hb_adid"
        ) ||
        ""
      );

    if (
      bidAdId &&
      hbAdId &&
      bidAdId === hbAdId
    ) {
      return true;
    }

    return false;
  }

  function collectHbBids(
    slotData
  ) {
    const bids = [];

    getPbjsBids()
      .forEach(
        bid => {
          if (
            !bidMatchesSlot(
              bid,
              slotData
            )
          ) {
            return;
          }

          bids.push({
            bidder:
              bid.bidder ||
              bid.bidderCode ||
              "Unknown",

            cpm:
              safeNumber(
                bid.cpm
              ),

            currency:
              bid.currency ||
              "USD",

            bucket:
              bid.adserverTargeting
                ? (
                    bid.adserverTargeting
                      .hb_pb ||
                    ""
                  )
                : "",

            size:
              bid.size ||
              (
                bid.width &&
                bid.height
                  ? `${bid.width}x${bid.height}`
                  : ""
              ),

            adId:
              bid.adId ||
              "",

            responseTime:
              safeNumber(
                bid.timeToRespond
              ),

            status:
              bid.statusMessage ||
              bid.status ||
              "",

            source:
              "Prebid runtime"
          });
        }
      );

    const targeting =
      slotData.targeting ||
      {};

    const targetBidder =
      firstTarget(
        targeting,
        "hb_bidder"
      );

    const targetBucket =
      firstTarget(
        targeting,
        "hb_pb"
      );

    const targetAdId =
      firstTarget(
        targeting,
        "hb_adid"
      );

    const targetSize =
      firstTarget(
        targeting,
        "hb_size"
      );

    if (
      targetBidder
    ) {
      const exists =
        bids.some(
          bid =>
            bid.bidder ===
            targetBidder
        );

      if (!exists) {
        bids.push({
          bidder:
            targetBidder,

          cpm:
            null,

          currency:
            "USD",

          bucket:
            targetBucket ||
            "",

          size:
            targetSize ||
            "",

          adId:
            targetAdId ||
            "",

          responseTime:
            null,

          status:
            "Slot targeting",

          source:
            "GPT targeting"
        });
      }
    }

    if (
      slotData.hbRequest &&
      slotData.hbRequest.bidder
    ) {
      const hr =
        slotData.hbRequest;

      const exists =
        bids.some(
          bid =>
            bid.bidder ===
            hr.bidder &&
            bid.bucket ===
            hr.bucket
        );

      if (!exists) {
        bids.push({
          bidder:
            hr.bidder,

          cpm:
            null,

          currency:
            "USD",

          bucket:
            hr.bucket || "",

          size:
            hr.size || "",

          adId:
            hr.adId || "",

          responseTime:
            null,

          status:
            "Sent to GAM",

          source:
            "GAM request"
        });
      }
    }

    return bids.sort(
      (a, b) =>
        (
          b.cpm ??
          safeNumber(
            b.bucket
          ) ??
          -1
        ) -
        (
          a.cpm ??
          safeNumber(
            a.bucket
          ) ??
          -1
        )
    );
  }

  function getHbTargeting(
    targeting
  ) {
    const out = {};

    Object.keys(
      targeting ||
      {}
    ).forEach(
      key => {
        if (
          /^hb_/i.test(key)
        ) {
          out[key] =
            targeting[key];
        }
      }
    );

    return out;
  }

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

          let finished =
            false;

          const timeout =
            setTimeout(
              () => {
                if (
                  !finished
                ) {
                  finished =
                    true;

                  state.tcDataLoaded =
                    true;

                  resolve(
                    state.tcData
                  );
                }
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
              if (
                finished
              ) {
                return;
              }

              finished =
                true;

              clearTimeout(
                timeout
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
      gdprApplies: null,
      consentString: null,
      cmpPresent: false,
      cmpId: null,
      cmpVersion: null,
      tcfPolicyVersion: null,
      eventStatus: "",
      cmpStatus: "",
      gpp: null,
      usPrivacy: null,
      consentValue: "",
      gppValue: "",
      gppSid: "",
      usPrivacyValue: ""
    };

    try {
      result.cmpPresent =
        typeof window.__tcfapi ===
        "function";
    } catch (_) {}

    if (
      state.tcData
    ) {
      const tc =
        state.tcData;

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

    if (
      request &&
      request.parsed
    ) {
      const p =
        request.parsed.params ||
        {};

      if (
        result.gdprApplies ===
          null
      ) {
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
      }

      if (
        result.consentString ===
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

      if (
        p.gpp
      ) {
        result.gpp =
          true;

        result.gppValue =
          p.gpp;
      } else if (
        p.gpp_sid &&
        p.gpp_sid !== "-1"
      ) {
        result.gpp =
          true;
      } else if (
        p.gpp_sid === "-1"
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
    }

    return result;
  }

  function getIdsFromResponse(
    response
  ) {
    return {
      lineItemId:
        response &&
        response.lineItemId !==
          undefined
          ? response.lineItemId
          : null,

      creativeId:
        response &&
        response.creativeId !==
          undefined
          ? response.creativeId
          : null,

      advertiserId:
        response &&
        response.advertiserId !==
          undefined
          ? response.advertiserId
          : null,

      orderId:
        response &&
        response.campaignId !==
          undefined
          ? response.campaignId
          : null,

      sourceAgnosticLineItemId:
        response &&
        response.sourceAgnosticLineItemId !==
          undefined
          ? response.sourceAgnosticLineItemId
          : null,

      sourceAgnosticCreativeId:
        response &&
        response.sourceAgnosticCreativeId !==
          undefined
          ? response.sourceAgnosticCreativeId
          : null,

      queryId:
        ""
    };
  }

  function classifyWinner(
    slotData
  ) {
    const response =
      slotData.response;

    const ids =
      slotData.ids;

    const rawLineItem =
      ids.lineItemId;

    const lineItem =
      rawLineItem === null ||
      rawLineItem === undefined ||
      rawLineItem === ""
        ? null
        : Number(
            rawLineItem
          );

    if (
      response &&
      response.isBackfill ===
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
      lineItem === -1
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
      lineItem === -2
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
      lineItem !== null &&
      Number.isFinite(
        lineItem
      ) &&
      lineItem > 0
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
        (
          slotData.hbRequest &&
          slotData.hbRequest.bidder
        )
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

  function buildLineItemUrl(
    slotData,
    lineItemId
  ) {
    if (
      !slotData.networkCode ||
      !lineItemId ||
      Number(lineItemId) <= 0
    ) {
      return "";
    }

    return (
      "https://admanager.google.com/" +
      encodeURIComponent(
        slotData.networkCode
      ) +
      "#delivery/line_item/detail/line_item_id=" +
      encodeURIComponent(
        lineItemId
      ) +
      "&line_item=true&li_tab=settings"
    );
  }

  function buildAdvertiserUrl(
    slotData,
    advertiserId
  ) {
    if (
      !slotData.networkCode ||
      !advertiserId
    ) {
      return "";
    }

    return (
      "https://admanager.google.com/" +
      encodeURIComponent(
        slotData.networkCode
      ) +
      "#admin/company/detail/company_id=" +
      encodeURIComponent(
        advertiserId
      )
    );
  }

  function buildOrderUrl(
    slotData,
    orderId
  ) {
    if (
      !slotData.networkCode ||
      !orderId
    ) {
      return "";
    }

    return (
      "https://admanager.google.com/" +
      encodeURIComponent(
        slotData.networkCode
      ) +
      "#delivery/order/order_overview/order_id=" +
      encodeURIComponent(
        orderId
      )
    );
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

  function linkedId(
    value,
    url,
    label
  ) {
    if (
      value === null ||
      value === undefined ||
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

  function highlightSelectedSlot() {
    const slot =
      state.slots[
        state.selected
      ];

    const old =
      document.getElementById(
        HIGHLIGHT_ID
      );

    if (old) {
      old.remove();
    }

    if (
      !slot ||
      slot.oop ||
      !slot.element
    ) {
      $("#footer")
        .textContent =
        "Highlight unavailable for this out-of-page slot";

      return;
    }

    try {
      slot.element
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
            slot.element
              .getBoundingClientRect();

          const overlay =
            document.createElement(
              "div"
            );

          overlay.id =
            HIGHLIGHT_ID;

          overlay.style.cssText = [
            "position:fixed",
            `left:${Math.max(0, rect.left - 4)}px`,
            `top:${Math.max(0, rect.top - 4)}px`,
            `width:${Math.max(10, rect.width + 8)}px`,
            `height:${Math.max(10, rect.height + 8)}px`,
            "z-index:2147483646",
            "pointer-events:none",
            "border:4px solid #ffcc00",
            "box-shadow:0 0 0 2px rgba(0,0,0,.8),0 0 24px rgba(255,204,0,.95)",
            "border-radius:6px"
          ].join(";");

          const label =
            document.createElement(
              "div"
            );

          label.textContent =
            slot.adUnitPath;

          label.style.cssText = [
            "position:absolute",
            "left:0",
            "top:-30px",
            "max-width:500px",
            "padding:5px 8px",
            "font:700 12px Arial,sans-serif",
            "color:#111",
            "background:#ffcc00",
            "border-radius:4px",
            "white-space:nowrap",
            "overflow:hidden",
            "text-overflow:ellipsis",
            "box-shadow:0 2px 8px rgba(0,0,0,.35)"
          ].join(";");

          overlay
            .appendChild(
              label
            );

          document.documentElement
            .appendChild(
              overlay
            );

          setTimeout(
            () => {
              if (
                overlay.isConnected
              ) {
                overlay.remove();
              }
            },
            5000
          );
        } catch (_) {}
      },
      350
    );
  }

  function renderBidTable(
    slotData
  ) {
    const bids =
      slotData.hbBids ||
      [];

    if (
      !bids.length
    ) {
      return `
        <div class="empty">
          ${
            slotData.hbDetected
              ? "HB wrapper detected, but bidder-level bid data was not exposed."
              : "No Header Bidding data detected."
          }
        </div>
      `;
    }

    const rows =
      bids.map(
        (bid, index) => {
          const exactPrice =
            bid.cpm !== null
              ? money(
                  bid.cpm,
                  bid.currency
                )
              : "—";

          const bucket =
            bid.bucket !== ""
              ? money(
                  bid.bucket,
                  "USD"
                )
              : "—";

          const response =
            bid.responseTime !== null
              ? `${Math.round(
                  bid.responseTime
                )} ms`
              : (
                  bid.status ||
                  "—"
                );

          return `
            <tr class="${
              index === 0
                ? "winner-row"
                : ""
            }">

              <td>
                ${
                  index === 0
                    ? "★ "
                    : ""
                }

                ${esc(
                  bid.bidder
                )}
              </td>

              <td>
                ${esc(
                  exactPrice
                )}
              </td>

              <td>
                ${esc(
                  bucket
                )}
              </td>

              <td>
                ${esc(
                  bid.size ||
                  "—"
                )}
              </td>

              <td>
                ${esc(
                  response
                )}
              </td>

            </tr>
          `;
        }
      ).join("");

    return `
      <table class="bidtable">

        <thead>
          <tr>
            <th>Bidder</th>
            <th>Exact bid</th>
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

  function buildDiagnosticExport(
    slotData
  ) {
    const consent =
      slotData.consent;

    const request =
      slotData.bestRequest;

    const ids =
      slotData.ids;

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
          ids,

        isBackfill:
          slotData.response
            ? slotData.response
                .isBackfill
            : null,

        gamLinks: {
          lineItem:
            buildLineItemUrl(
              slotData,
              ids.lineItemId
            ),

          advertiser:
            buildAdvertiserUrl(
              slotData,
              ids.advertiserId
            ),

          order:
            buildOrderUrl(
              slotData,
              ids.orderId
            ),

          troubleshooting:
            buildTroubleshootingUrl(
              slotData
            )
        }
      },

      gpt: {
        responseInformation:
          slotData.response,

        slotTargeting:
          slotData.targeting,

        pageTargeting:
          slotData.pageTargeting
      },

      gamRequest:
        request
          ? {
              found:
                true,

              match:
                request.match,

              params:
                request.parsed.params,

              prevScp:
                request.parsed.prevScp,

              custParams:
                request.parsed.custParams
            }
          : {
              found:
                false
            },

      headerBidding: {
        detected:
          slotData.hbDetected,

        wrapperEvidence:
          slotData.hbWrapperEvidence,

        requestData:
          slotData.hbRequest,

        bids:
          slotData.hbBids,

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

        cmpId:
          consent.cmpId,

        cmpVersion:
          consent.cmpVersion,

        tcfPolicyVersion:
          consent.tcfPolicyVersion,

        eventStatus:
          consent.eventStatus,

        cmpStatus:
          consent.cmpStatus,

        consentStringPresent:
          consent.consentString,

        consentStringLength:
          String(
            consent.consentValue ||
            ""
          ).length,

        gpp:
          consent.gpp,

        gppSid:
          consent.gppSid,

        usPrivacy:
          consent.usPrivacy,

        usPrivacyValue:
          consent.usPrivacyValue
      },

      ignoredSlots:
        state.ignored
    };
  }

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

        data.hbWrapperEvidence =
          getHbWrapperEvidence(
            data
          );

        data.hbDetected =
          Boolean(
            data.hbRequest ||
            data.hbWrapperEvidence
              .length
          );

        data.hbBids =
          collectHbBids(
            data
          );

        if (
          data.hbBids.length
        ) {
          data.hbDetected =
            true;
        }

        data.ids =
          getIdsFromResponse(
            response
          );

        data.consent =
          getConsentStatus(
            data.bestRequest
          );

        data.winner =
          classifyWinner(
            data
          );

        if (
          element
        ) {
          try {
            const rect =
              element
                .getBoundingClientRect();

            data.domSize =
              `${Math.round(
                rect.width
              )}x${Math.round(
                rect.height
              )}`;
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

    $("#ignoredBtn")
      .textContent =
      state.showIgnored
        ? `Hide ignored (${state.ignored.length})`
        : `Ignored: ${state.ignored.length}`;

    select.innerHTML =
      "";

    state.slots.forEach(
      (
        slot,
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
          `${slot.adUnitPath}` +
          `${slot.oop ? " · OOP" : ""}` +
          ` · ${slot.winner.label}`;

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

    renderSelected();
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

    const consent =
      s.consent;

    const lineItemUrl =
      buildLineItemUrl(
        s,
        ids.lineItemId
      );

    const advertiserUrl =
      buildAdvertiserUrl(
        s,
        ids.advertiserId
      );

    const orderUrl =
      buildOrderUrl(
        s,
        ids.orderId
      );

    const troubleshootingUrl =
      buildTroubleshootingUrl(
        s
      );

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

    const winnerBidder =
      firstTarget(
        s.targeting,
        "hb_bidder"
      ) ||
      (
        s.hbRequest &&
        s.hbRequest.bidder
      ) ||
      "";

    if (
      s.winner.type ===
        "hb" &&
      winnerBidder
    ) {
      winnerRows.push(
        kv(
          "Bidder",
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
      s.response &&
      s.response.isBackfill ===
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
      ids.lineItemId !== null &&
      Number(ids.lineItemId) >
        0
    ) {
      winnerRows.push(
        kv(
          "Line item ID",
          linkedId(
            ids.lineItemId,
            lineItemUrl,
            "line item"
          )
        )
      );
    }

    if (
      ids.creativeId !== null
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
      ids.sourceAgnosticLineItemId !==
        null &&
      (
        ids.lineItemId === null ||
        ids.sourceAgnosticLineItemId !==
          ids.lineItemId
      )
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
      ids.sourceAgnosticCreativeId !==
        null &&
      (
        ids.creativeId === null ||
        ids.sourceAgnosticCreativeId !==
          ids.creativeId
      )
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
      ids.advertiserId !==
        null
    ) {
      winnerRows.push(
        kv(
          "Advertiser ID",
          linkedId(
            ids.advertiserId,
            advertiserUrl,
            "advertiser"
          )
        )
      );
    }

    if (
      ids.orderId !==
        null
    ) {
      winnerRows.push(
        kv(
          "Order ID",
          linkedId(
            ids.orderId,
            orderUrl,
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
              troubleshootingUrl,
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
        "HB wrapper",
        yesNo(
          s.hbDetected
        )
      ),

      kv(
        "Bid data",
        s.hbBids.length
          ? `
              <span class="yes">
                AVAILABLE
              </span>
            `
          : (
              s.hbDetected
                ? `
                    <span class="warn">
                      NOT EXPOSED
                    </span>
                  `
                : `
                    <span class="no">
                      NO
                    </span>
                  `
            )
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

    const targetBucket =
      firstTarget(
        s.targeting,
        "hb_pb"
      ) ||
      (
        s.hbRequest &&
        s.hbRequest.bucket
      ) ||
      "";

    if (
      targetBucket !== ""
    ) {
      hbRows.push(
        kv(
          "GAM price bucket",
          esc(
            money(
              targetBucket,
              "USD"
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
              consent.gdprApplies
            )
          )}

          ${kv(
            "TCF CMP",
            yesNo(
              consent.cmpPresent
            )
          )}

          ${kv(
            "Consent string",
            consent.consentString ===
              null
              ? `
                  <span class="muted">
                    UNKNOWN
                  </span>
                `
              : yesNo(
                  consent.consentString
                )
          )}

          ${kv(
            "CMP ID",
            esc(
              consent.cmpId ??
              "—"
            )
          )}

          ${kv(
            "TCF version",
            esc(
              consent.tcfPolicyVersion ??
              "—"
            )
          )}

          ${kv(
            "CMP status",
            esc(
              consent.cmpStatus ||
              "—"
            )
          )}

          ${kv(
            "GPP",
            consent.gpp ===
              null
              ? `
                  <span class="muted">
                    UNKNOWN
                  </span>
                `
              : yesNo(
                  consent.gpp
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
            TC Data
          </div>

          <pre>${esc(
            stringify(
              state.tcData
            )
          )}</pre>

        </details>

      </div>
    `;

    bindCopyButtons();

    $("#footer")
      .textContent =
      [
        `GPT ${getGoogletag() ? "✓" : "✕"}`,
        `Winner ${s.winner.label}`,
        `HB ${s.hbDetected ? "✓" : "✕"}`,
        `Request ${s.bestRequest ? "✓" : "✕"}`
      ]
        .join(" · ");
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

              const ok =
                await copyText(
                  value
                );

              if (ok) {
                const old =
                  button.textContent;

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

  async function refresh() {
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

    await readTcData();

    collectSlots();

    const index =
      state.slots
        .findIndex(
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

    if (
      index >= 0
    ) {
      state.selected =
        index;

      select.value =
        String(index);

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
        const slot =
          state.slots[
            state.selected
          ];

        if (!slot) {
          return;
        }

        const data =
          buildDiagnosticExport(
            slot
          );

        const json =
          JSON.stringify(
            data,
            null,
            2
          );

        const button =
          $("#copyJsonBtn");

        const old =
          button.textContent;

        const ok =
          await copyText(
            json
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

          state.timer =
            null;
        }

        if (
          state.auto
        ) {
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
        if (
          state.timer
        ) {
          clearInterval(
            state.timer
          );
        }

        const highlight =
          document.getElementById(
            HIGHLIGHT_ID
          );

        if (
          highlight
        ) {
          highlight.remove();
        }

        host.remove();
      }
    );

  (async () => {
    await readTcData();

    collectSlots();
  })();

})();
