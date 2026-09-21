(() => {
  "use strict";

  const SW = {
    VERSION: "2026-09-21-postmessage",
    PANEL_ID: "__sw_inspector_panel__",
    STYLE_ID: "__sw_inspector_style__",
    MSG_TYPE: "SW_INSPECTOR_RESULT",
    SIMILARWEB_RE: /(^|\.)similarweb\.com$/i
  };

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function cleanHost(v) {
    return String(v || "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "")
      .replace(/:\d+$/, "");
  }

  function isSimilarweb() {
    return SW.SIMILARWEB_RE.test(cleanHost(location.hostname));
  }

  function targetDomain() {
    if (!isSimilarweb()) return cleanHost(location.hostname);

    const m = location.pathname.match(/\/website\/([^/]+)/i);

    if (m?.[1]) {
      try {
        return cleanHost(decodeURIComponent(m[1]));
      } catch (_) {
        return cleanHost(m[1]);
      }
    }

    return "";
  }

  function esc(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function css() {
    if (document.getElementById(SW.STYLE_ID)) return;

    const s = document.createElement("style");
    s.id = SW.STYLE_ID;

    s.textContent = `
      #${SW.PANEL_ID},
      #${SW.PANEL_ID} * {
        box-sizing: border-box !important;
      }

      #${SW.PANEL_ID} {
        position: fixed !important;
        top: 12px !important;
        right: 12px !important;
        width: min(430px, calc(100vw - 24px)) !important;
        max-height: calc(100vh - 24px) !important;
        overflow: auto !important;
        z-index: 2147483647 !important;

        background: #101114 !important;
        color: #f4f5f7 !important;

        border: 1px solid rgba(255,255,255,.14) !important;
        border-radius: 16px !important;

        box-shadow: 0 18px 60px rgba(0,0,0,.45) !important;

        font-family:
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          Roboto,
          Arial,
          sans-serif !important;

        font-size: 13px !important;
        line-height: 1.35 !important;
        text-align: left !important;
      }

      #${SW.PANEL_ID} button {
        font: inherit !important;
      }

      .sw-head {
        position: sticky !important;
        top: 0 !important;
        z-index: 2 !important;

        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;

        gap: 12px !important;
        padding: 14px !important;

        background: rgba(16,17,20,.96) !important;
        border-bottom: 1px solid rgba(255,255,255,.08) !important;
      }

      .sw-title {
        font-weight: 800 !important;
        font-size: 15px !important;
      }

      .sw-sub {
        margin-top: 2px !important;
        color: #9da3ad !important;
        font-size: 11px !important;
      }

      .sw-x {
        width: 30px !important;
        height: 30px !important;

        border: 0 !important;
        border-radius: 9px !important;

        background: rgba(255,255,255,.08) !important;
        color: #fff !important;

        cursor: pointer !important;
      }

      .sw-body {
        padding: 14px !important;
      }

      .sw-status {
        padding: 12px !important;
        border-radius: 12px !important;

        background: rgba(255,255,255,.055) !important;
        color: #d8dce3 !important;
      }

      .sw-error {
        color: #ffb7b7 !important;
      }

      .sw-grid {
        display: grid !important;
        grid-template-columns: 1.2fr .8fr .8fr !important;
        gap: 8px !important;
      }

      .sw-ranks {
        display: grid !important;
        grid-template-columns: repeat(3, 1fr) !important;
        gap: 8px !important;
      }

      .sw-card {
        min-width: 0 !important;
        padding: 11px !important;

        border-radius: 12px !important;

        background: rgba(255,255,255,.055) !important;
        border: 1px solid rgba(255,255,255,.07) !important;
      }

      .sw-k {
        color: #9da3ad !important;
        font-size: 10px !important;

        text-transform: uppercase !important;
        letter-spacing: .06em !important;

        margin-bottom: 5px !important;
      }

      .sw-v {
        font-weight: 800 !important;
        font-size: 18px !important;
        overflow-wrap: anywhere !important;
      }

      .sw-small {
        font-size: 14px !important;
      }

      .sw-section {
        margin-top: 14px !important;
      }

      .sw-section-title {
        margin: 0 0 7px !important;

        color: #d8dce3 !important;
        font-size: 11px !important;
        font-weight: 800 !important;

        text-transform: uppercase !important;
        letter-spacing: .07em !important;
      }

      .sw-row {
        display: grid !important;
        grid-template-columns: minmax(0,1fr) auto !important;

        gap: 12px !important;
        padding: 6px 0 !important;

        border-bottom: 1px solid rgba(255,255,255,.055) !important;
      }

      .sw-row:last-child {
        border-bottom: 0 !important;
      }

      .sw-label {
        min-width: 0 !important;
        overflow-wrap: anywhere !important;
      }

      .sw-value {
        font-variant-numeric: tabular-nums !important;
        white-space: nowrap !important;
      }

      .sw-actions {
        display: flex !important;
        flex-wrap: wrap !important;

        gap: 8px !important;
        margin-top: 15px !important;
      }

      .sw-btn {
        appearance: none !important;

        border: 1px solid rgba(255,255,255,.11) !important;
        border-radius: 10px !important;

        padding: 8px 10px !important;

        background: rgba(255,255,255,.07) !important;
        color: #fff !important;

        cursor: pointer !important;
        font-weight: 700 !important;
      }

      .sw-btn:hover {
        background: rgba(255,255,255,.12) !important;
      }

      .sw-foot {
        margin-top: 10px !important;
        color: #747b87 !important;
        font-size: 10px !important;
      }

      @media(max-width:560px) {
        #${SW.PANEL_ID} {
          top: 8px !important;
          right: 8px !important;

          width: calc(100vw - 16px) !important;
          max-height: calc(100vh - 16px) !important;
        }

        .sw-grid {
          grid-template-columns: 1fr 1fr !important;
        }

        .sw-grid .sw-card:first-child {
          grid-column: 1 / -1 !important;
        }
      }
    `;

    document.documentElement.appendChild(s);
  }

  function panel(domain, subtitle) {
    css();

    let p = document.getElementById(SW.PANEL_ID);

    if (!p) {
      p = document.createElement("div");
      p.id = SW.PANEL_ID;

      p.innerHTML = `
        <div class="sw-head">
          <div>
            <div class="sw-title"></div>
            <div class="sw-sub"></div>
          </div>

          <button
            class="sw-x"
            type="button"
          >
            ✕
          </button>
        </div>

        <div class="sw-body"></div>
      `;

      p.querySelector(".sw-x").onclick = () => p.remove();

      document.documentElement.appendChild(p);
    }

    p.querySelector(".sw-title").textContent =
      `SW · ${domain || "Similarweb"}`;

    p.querySelector(".sw-sub").textContent =
      subtitle || "";

    return p;
  }

  function status(domain, msg, error = false) {
    const p = panel(
      domain,
      "Similarweb public data"
    );

    p.querySelector(".sw-body").innerHTML = `
      <div class="sw-status ${error ? "sw-error" : ""}">
        ${esc(msg)}
      </div>
    `;

    return p;
  }

  function lines() {
    return (
      (document.body && document.body.innerText) ||
      ""
    )
      .split(/\n+/)
      .map(x =>
        x
          .replace(/\s+/g, " ")
          .trim()
      )
      .filter(Boolean);
  }

  const looksPercent = s =>
    /^<?\s*\d+(?:[.,]\d+)?\s*%$/.test(
      String(s).trim()
    );

  const looksTraffic = s =>
    /^\d+(?:[.,]\d+)?\s*[KMBT]?$/i.test(
      String(s).trim()
    );

  const looksDuration = s =>
    /^\d{1,2}:\d{2}(?::\d{2})?$/.test(
      String(s).trim()
    );

  const looksRank = s =>
    /^(?:--|N\/A|#?\s*[\d,]+)$/i.test(
      String(s).trim()
    );

  function after(
    a,
    labels,
    test,
    look = 7
  ) {
    const ls =
      labels.map(x =>
        x.toLowerCase()
      );

    for (
      let i = 0;
      i < a.length;
      i++
    ) {
      const t =
        a[i].toLowerCase();

      if (
        !ls.some(x =>
          t === x ||
          t.includes(x)
        )
      ) {
        continue;
      }

      for (
        let j = i + 1;
        j <
        Math.min(
          a.length,
          i + 1 + look
        );
        j++
      ) {
        if (
          !test ||
          test(a[j])
        ) {
          return a[j];
        }
      }
    }

    return "";
  }

  function section(
    a,
    starts,
    stops
  ) {
    let start = -1;

    for (
      let i = 0;
      i < a.length;
      i++
    ) {
      const t =
        a[i].toLowerCase();

      if (
        starts.some(x =>
          t === x.toLowerCase() ||
          t.includes(
            x.toLowerCase()
          )
        )
      ) {
        start = i;
        break;
      }
    }

    if (start < 0) {
      return [];
    }

    let end =
      Math.min(
        a.length,
        start + 100
      );

    for (
      let i = start + 1;
      i < end;
      i++
    ) {
      const t =
        a[i].toLowerCase();

      if (
        stops.some(x =>
          t === x.toLowerCase() ||
          t.startsWith(
            x.toLowerCase()
          )
        )
      ) {
        end = i;
        break;
      }
    }

    return a.slice(
      start + 1,
      end
    );
  }

  function extractCountries(a) {
    const s =
      section(
        a,
        [
          "Geography",
          "Top 5 Countries"
        ],
        [
          "Traffic Sources",
          "Marketing Mix",
          "Ranking",
          "Top Keywords",
          "AI Traffic"
        ]
      );

    const out = [];

    for (
      let i = 0;
      i < s.length - 1;
      i++
    ) {
      const name = s[i];
      const value = s[i + 1];

      if (
        /^[A-Z][A-Za-z .,'’()-]{2,50}$/.test(
          name
        ) &&
        looksPercent(value) &&
        !/^(Worldwide|Desktop Only|Country|Traffic|Top \d+ Countries)$/i.test(
          name
        )
      ) {
        out.push({
          name,
          share: value
        });

        i++;
      }

      if (
        out.length >= 5
      ) {
        break;
      }
    }

    return out;
  }

  const SOURCE_NAMES =
    new Set([
      "Direct",
      "Email",
      "Social Organic",
      "Referrals",
      "Search Organic",
      "Gen AI",
      "Display Ads",
      "Affiliate",
      "Search Paid",
      "Social Paid",
      "Organic Search",
      "Paid Search",
      "Social",
      "Display"
    ]);

  function extractSources(a) {
    const s =
      section(
        a,
        [
          "Traffic Sources",
          "Marketing Mix"
        ],
        [
          "Want to see more insights",
          "Geography",
          "Ranking",
          "Top Keywords",
          "AI Traffic"
        ]
      );

    const out = [];

    for (
      let i = 0;
      i < s.length - 1;
      i++
    ) {
      if (
        SOURCE_NAMES.has(
          s[i]
        ) &&
        looksPercent(
          s[i + 1]
        )
      ) {
        out.push({
          name: s[i],
          share: s[i + 1]
        });

        i++;
      }
    }

    return out;
  }

  function extractKeywords(a) {
    const s =
      section(
        a,
        ["Top Keywords"],
        [
          "AI Traffic",
          "Top Prompts",
          "Ranking",
          "Geography",
          "Traffic Sources"
        ]
      )
        .filter(x =>
          !/^(Worldwide|Desktop Only|Keyword|Traffic|Cost per Click|Organic & Paid|Branded & Non-Branded)$/i.test(
            x
          )
        );

    const out = [];

    for (
      let i = 0;
      i < s.length;
      i++
    ) {
      const keyword =
        s[i];

      if (
        !keyword ||
        looksTraffic(keyword) ||
        /^\$\d/.test(keyword) ||
        looksPercent(keyword)
      ) {
        continue;
      }

      if (
        i + 1 <
          s.length &&
        looksTraffic(
          s[i + 1]
        )
      ) {
        const traffic =
          s[++i];

        let cpc = "";

        if (
          i + 1 <
            s.length &&
          /^\$\d+(?:[.,]\d+)?$/.test(
            s[i + 1]
          )
        ) {
          cpc =
            s[++i];
        }

        out.push({
          keyword,
          traffic,
          cpc
        });
      }

      if (
        out.length >= 5
      ) {
        break;
      }
    }

    return out;
  }

  function extractAi(a) {
    const s =
      section(
        a,
        [
          "AI Traffic Distribution Over Time"
        ],
        [
          "Top Prompts",
          "Ranking",
          "Geography",
          "Traffic Sources",
          "Top Keywords"
        ]
      );

    const out = [];

    for (
      let i = 0;
      i < s.length - 1;
      i++
    ) {
      if (
        /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(
          s[i]
        ) &&
        looksPercent(
          s[i + 1]
        )
      ) {
        out.push({
          name: s[i],
          share: s[i + 1]
        });

        i++;
      }
    }

    return out;
  }

  function extract(domain) {
    const a =
      lines();

    let month = "";

    for (
      const x of a
    ) {
      if (
        /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+20\d{2}$/i.test(
          x
        )
      ) {
        month = x;
        break;
      }
    }

    return {
      source: "page",
      domain,
      month,

      metrics: {
        monthlyVisits:
          after(
            a,
            ["Monthly Visits"],
            looksTraffic
          ),

        bounceRate:
          after(
            a,
            ["Bounce Rate"],
            looksPercent
          ),

        pagesPerVisit:
          after(
            a,
            [
              "Pages per Visit",
              "Pages / Visit"
            ],
            x =>
              /^\d+(?:[.,]\d+)?$/.test(
                x
              )
          ),

        avgVisitDuration:
          after(
            a,
            [
              "Avg. Visit Duration",
              "Average Visit Duration"
            ],
            looksDuration
          )
      },

      ranks: {
        global:
          after(
            a,
            ["Global Rank"],
            looksRank
          ),

        country:
          after(
            a,
            ["Country Rank"],
            looksRank
          ),

        category:
          after(
            a,
            [
              "Category Rank",
              "Industry Rank"
            ],
            looksRank
          )
      },

      countries:
        extractCountries(a),

      trafficSources:
        extractSources(a),

      keywords:
        extractKeywords(a),

      aiTraffic:
        extractAi(a)
    };
  }

  function useful(d) {
    return !!d && (
      !!d.metrics?.monthlyVisits ||
      !!d.metrics?.bounceRate ||
      !!d.metrics?.pagesPerVisit ||
      !!d.metrics?.avgVisitDuration ||
      d.countries?.length ||
      d.trafficSources?.length ||
      d.keywords?.length ||
      d.aiTraffic?.length
    );
  }

  function fmtRank(v) {
    if (
      !v ||
      v === "--" ||
      /^N\/A$/i.test(v)
    ) {
      return "—";
    }

    if (
      String(v).startsWith("#")
    ) {
      return v;
    }

    return /^[\d,]+$/.test(
      String(v)
    )
      ? `#${v}`
      : v;
  }

  function row(k, v) {
    return `
      <div class="sw-row">
        <div class="sw-label">
          ${esc(k)}
        </div>

        <div class="sw-value">
          ${esc(v || "—")}
        </div>
      </div>
    `;
  }

  function render(d) {
    const p =
      panel(
        d.domain,
        [
          d.month,
          "Similarweb free data"
        ]
          .filter(Boolean)
          .join(" · ")
      );

    const m =
      d.metrics || {};

    const r =
      d.ranks || {};

    p.querySelector(
      ".sw-body"
    ).innerHTML = `
      <div class="sw-grid">

        <div class="sw-card">
          <div class="sw-k">
            Monthly Visits
          </div>

          <div class="sw-v">
            ${esc(
              m.monthlyVisits ||
              "—"
            )}
          </div>
        </div>

        <div class="sw-card">
          <div class="sw-k">
            Bounce Rate
          </div>

          <div class="sw-v sw-small">
            ${esc(
              m.bounceRate ||
              "—"
            )}
          </div>
        </div>

        <div class="sw-card">
          <div class="sw-k">
            Pages / Visit
          </div>

          <div class="sw-v sw-small">
            ${esc(
              m.pagesPerVisit ||
              "—"
            )}
          </div>
        </div>

      </div>

      <div class="sw-section">

        <div class="sw-card">
          <div class="sw-k">
            Avg. Visit Duration
          </div>

          <div class="sw-v sw-small">
            ${esc(
              m.avgVisitDuration ||
              "—"
            )}
          </div>
        </div>

      </div>

      <div class="sw-section">

        <div class="sw-section-title">
          Ranking
        </div>

        <div class="sw-ranks">

          <div class="sw-card">
            <div class="sw-k">
              Global
            </div>

            <div class="sw-v sw-small">
              ${esc(
                fmtRank(
                  r.global
                )
              )}
            </div>
          </div>

          <div class="sw-card">
            <div class="sw-k">
              Country
            </div>

            <div class="sw-v sw-small">
              ${esc(
                fmtRank(
                  r.country
                )
              )}
            </div>
          </div>

          <div class="sw-card">
            <div class="sw-k">
              Category
            </div>

            <div class="sw-v sw-small">
              ${esc(
                fmtRank(
                  r.category
                )
              )}
            </div>
          </div>

        </div>
      </div>

      <div class="sw-section">

        <div class="sw-section-title">
          Top Countries
        </div>

        ${
          d.countries?.length
            ? d.countries
                .map(x =>
                  row(
                    x.name,
                    x.share
                  )
                )
                .join("")
            : row(
                "No public country data found",
                ""
              )
        }

      </div>

      <div class="sw-section">

        <div class="sw-section-title">
          Traffic Sources
        </div>

        ${
          d.trafficSources?.length
            ? d.trafficSources
                .map(x =>
                  row(
                    x.name,
                    x.share
                  )
                )
                .join("")
            : row(
                "No public traffic source data found",
                ""
              )
        }

      </div>

      ${
        d.keywords?.length
          ? `
            <div class="sw-section">

              <div class="sw-section-title">
                Top Keywords
              </div>

              ${d.keywords
                .map(x =>
                  row(
                    x.keyword,
                    [
                      x.traffic,
                      x.cpc
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  )
                )
                .join("")}

            </div>
          `
          : ""
      }

      ${
        d.aiTraffic?.length
          ? `
            <div class="sw-section">

              <div class="sw-section-title">
                AI Traffic
              </div>

              ${d.aiTraffic
                .map(x =>
                  row(
                    x.name,
                    x.share
                  )
                )
                .join("")}

            </div>
          `
          : ""
      }

      <div class="sw-actions">

        <button
          class="sw-btn"
          data-a="copy"
        >
          COPY
        </button>

        <button
          class="sw-btn"
          data-a="json"
        >
          COPY JSON
        </button>

        <button
          class="sw-btn"
          data-a="open"
        >
          OPEN SIMILARWEB
        </button>

      </div>

      <div class="sw-foot">
        SW Inspector · ${esc(
          SW.VERSION
        )}
      </div>
    `;

    const b =
      p.querySelector(
        ".sw-body"
      );

    b.querySelector(
      '[data-a="copy"]'
    ).onclick = () =>
      copyText(
        toText(d)
      );

    b.querySelector(
      '[data-a="json"]'
    ).onclick = () =>
      copyText(
        JSON.stringify(
          d,
          null,
          2
        )
      );

    b.querySelector(
      '[data-a="open"]'
    ).onclick = () =>
      openSimilarweb(
        d.domain
      );
  }

  function toText(d) {
    const m =
      d.metrics || {};

    const r =
      d.ranks || {};

    const o = [
      `Similarweb · ${d.domain}`
    ];

    if (d.month) {
      o.push(d.month);
    }

    o.push(
      "",
      `Monthly Visits: ${
        m.monthlyVisits ||
        "—"
      }`,
      `Bounce Rate: ${
        m.bounceRate ||
        "—"
      }`,
      `Pages / Visit: ${
        m.pagesPerVisit ||
        "—"
      }`,
      `Avg. Visit Duration: ${
        m.avgVisitDuration ||
        "—"
      }`,
      "",
      `Global Rank: ${
        fmtRank(
          r.global
        )
      }`,
      `Country Rank: ${
        fmtRank(
          r.country
        )
      }`,
      `Category Rank: ${
        fmtRank(
          r.category
        )
      }`
    );

    if (
      d.countries?.length
    ) {
      o.push(
        "",
        "Top Countries:"
      );

      d.countries.forEach(
        x =>
          o.push(
            `${x.name}: ${x.share}`
          )
      );
    }

    if (
      d.trafficSources?.length
    ) {
      o.push(
        "",
        "Traffic Sources:"
      );

      d.trafficSources.forEach(
        x =>
          o.push(
            `${x.name}: ${x.share}`
          )
      );
    }

    if (
      d.keywords?.length
    ) {
      o.push(
        "",
        "Top Keywords:"
      );

      d.keywords.forEach(
        x =>
          o.push(
            `${x.keyword}: ${
              [
                x.traffic,
                x.cpc
              ]
                .filter(Boolean)
                .join(" · ")
            }`
          )
      );
    }

    if (
      d.aiTraffic?.length
    ) {
      o.push(
        "",
        "AI Traffic:"
      );

      d.aiTraffic.forEach(
        x =>
          o.push(
            `${x.name}: ${x.share}`
          )
      );
    }

    return o.join("\n");
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(
        text
      );

      return;
    } catch (_) {}

    const t =
      document.createElement(
        "textarea"
      );

    t.value =
      text;

    t.style.position =
      "fixed";

    t.style.left =
      "-9999px";

    document.body.appendChild(
      t
    );

    t.select();

    document.execCommand(
      "copy"
    );

    t.remove();
  }

  function installReceiver() {
    if (
      window.__SW_RECEIVER_INSTALLED__
    ) {
      return;
    }

    window.__SW_RECEIVER_INSTALLED__ =
      true;

    window.addEventListener(
      "message",
      e => {
        if (
          !/^https:\/\/([a-z0-9-]+\.)*similarweb\.com$/i.test(
            e.origin
          )
        ) {
          return;
        }

        if (
          !e.data ||
          e.data.type !==
            SW.MSG_TYPE ||
          !e.data.payload
        ) {
          return;
        }

        render(
          e.data.payload
        );

        try {
          sessionStorage.setItem(
            "__sw_last_result__",
            JSON.stringify(
              e.data.payload
            )
          );
        } catch (_) {}
      }
    );
  }

  function openSimilarweb(domain) {
    const url =
      `https://www.similarweb.com/website/${encodeURIComponent(
        domain
      )}/#overview`;

    const child =
      window.open(
        url,
        "_blank"
      );

    if (!child) {
      status(
        domain,
        "Browser blocked the Similarweb tab. Allow pop-ups for this site and press SW again.",
        true
      );
    }
  }

  async function onPublisher(
    domain
  ) {
    installReceiver();

    status(
      domain,
      "Opening Similarweb… When it loads, press SW there once. The result will return here automatically."
    );

    openSimilarweb(
      domain
    );
  }

  async function onSimilarweb(
    domain
  ) {
    status(
      domain,
      "Reading visible Similarweb data…"
    );

    await sleep(700);

    let d =
      extract(domain);

    if (!useful(d)) {
      await sleep(1400);

      d =
        extract(domain);
    }

    if (!useful(d)) {
      status(
        domain,
        "No free metrics found yet. Scroll until the free report blocks are loaded, then press SW again.",
        true
      );

      return;
    }

    if (
      window.opener &&
      !window.opener.closed
    ) {
      try {
        window.opener.postMessage(
          {
            type:
              SW.MSG_TYPE,
            payload: d
          },
          "*"
        );

        status(
          domain,
          "Data sent back to the original page. Closing this tab…"
        );

        await sleep(450);

        window.close();

        return;
      } catch (_) {}
    }

    render(d);
  }

  async function main() {
    const domain =
      targetDomain();

    if (!domain) {
      status(
        "Similarweb",
        "Could not detect the target domain.",
        true
      );

      return;
    }

    if (isSimilarweb()) {
      await onSimilarweb(
        domain
      );
    } else {
      await onPublisher(
        domain
      );
    }
  }

  main().catch(err => {
    console.error(
      "[SW Inspector]",
      err
    );

    status(
      targetDomain() ||
        "SW",
      `SW error: ${
        err?.message ||
        String(err)
      }`,
      true
    );
  });
})();
