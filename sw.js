(() => {
  "use strict";

  const SW = {
    VERSION: "2026-09-21",
    PANEL_ID: "__sw_inspector_panel__",
    STYLE_ID: "__sw_inspector_style__",
    DIRECT_ENDPOINT: "https://data.similarweb.com/api/v1/data?domain=",
    SIMILARWEB_HOST_RE: /(^|\.)similarweb\.com$/i
  };

  if (document.getElementById(SW.PANEL_ID)) {
    document.getElementById(SW.PANEL_ID).remove();
    return;
  }

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function cleanHost(host) {
    return String(host || "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "")
      .replace(/:\d+$/, "");
  }

  function currentTargetDomain() {
    const host = cleanHost(location.hostname);

    if (!SW.SIMILARWEB_HOST_RE.test(host)) {
      return host;
    }

    const pathMatch = location.pathname.match(/\/website\/([^/]+)/i);
    if (pathMatch && pathMatch[1]) {
      try {
        return cleanHost(decodeURIComponent(pathMatch[1]));
      } catch (_) {
        return cleanHost(pathMatch[1]);
      }
    }

    const candidates = [
      new URLSearchParams(location.search).get("q"),
      new URLSearchParams(location.search).get("domain"),
      new URLSearchParams(location.search).get("website")
    ].filter(Boolean);

    for (const value of candidates) {
      const d = cleanHost(value);
      if (d && !SW.SIMILARWEB_HOST_RE.test(d)) return d;
    }

    return "";
  }

  function formatNumber(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return value == null ? "—" : String(value);

    const abs = Math.abs(n);
    if (abs >= 1e9) return stripZero((n / 1e9).toFixed(abs >= 1e10 ? 1 : 2)) + "B";
    if (abs >= 1e6) return stripZero((n / 1e6).toFixed(abs >= 1e7 ? 1 : 2)) + "M";
    if (abs >= 1e3) return stripZero((n / 1e3).toFixed(abs >= 1e4 ? 1 : 2)) + "K";
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 2
    }).format(n);
  }

  function stripZero(s) {
    return String(s)
      .replace(/\.00$/, "")
      .replace(/(\.\d)0$/, "$1");
  }

  function formatPercent(value) {
    if (value == null || value === "") return "—";

    if (typeof value === "string" && value.includes("%")) {
      return value.trim();
    }

    let n = Number(value);
    if (!Number.isFinite(n)) return String(value);

    if (Math.abs(n) <= 1) n *= 100;

    return stripZero(n.toFixed(2)) + "%";
  }

  function formatDuration(value) {
    if (value == null || value === "") return "—";

    if (
      typeof value === "string" &&
      /^\d{1,2}:\d{2}(:\d{2})?$/.test(value.trim())
    ) {
      const p = value.trim().split(":");

      return p.length === 2
        ? `00:${p[0].padStart(2, "0")}:${p[1]}`
        : value.trim();
    }

    const total = Math.max(0, Math.round(Number(value)));

    if (!Number.isFinite(total)) {
      return String(value);
    }

    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;

    return [h, m, s]
      .map(v => String(v).padStart(2, "0"))
      .join(":");
  }

  function normalizeRank(value) {
    if (
      value == null ||
      value === "" ||
      value === 0 ||
      value === "0"
    ) {
      return "—";
    }

    const n = Number(String(value).replace(/[#,]/g, ""));

    if (Number.isFinite(n)) {
      return "#" + new Intl.NumberFormat("en-US").format(n);
    }

    return String(value).trim();
  }

  function normalizeMonth(value) {
    if (!value) return "";

    const s = String(value).trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const d = new Date(s + "T00:00:00Z");

      return d.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
        timeZone: "UTC"
      });
    }

    if (/^\d{4}-\d{2}$/.test(s)) {
      const d = new Date(s + "-01T00:00:00Z");

      return d.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
        timeZone: "UTC"
      });
    }

    return s;
  }

  function objectValues(obj) {
    return obj && typeof obj === "object"
      ? Object.values(obj)
      : [];
  }

  function firstDefined(obj, paths) {
    for (const path of paths) {
      const parts = path.split(".");
      let cur = obj;
      let ok = true;

      for (const part of parts) {
        if (
          cur == null ||
          !(part in Object(cur))
        ) {
          ok = false;
          break;
        }

        cur = cur[part];
      }

      if (
        ok &&
        cur != null &&
        cur !== ""
      ) {
        return cur;
      }
    }

    return null;
  }

  function arrayFromUnknown(value) {
    if (!value) return [];

    if (Array.isArray(value)) {
      return value;
    }

    if (typeof value === "object") {
      return Object.entries(value).map(([key, val]) => {
        if (
          val &&
          typeof val === "object"
        ) {
          return {
            key,
            ...val
          };
        }

        return {
          key,
          value: val
        };
      });
    }

    return [];
  }

  function normalizeDirectJson(raw, domain) {
    const data =
      raw && raw.SiteInfo
        ? raw.SiteInfo
        : raw || {};

    const engagement =
      firstDefined(data, [
        "Engagments",
        "Engagements",
        "engagement",
        "engagements",
        "TrafficAndEngagement"
      ]) || {};

    const trafficSources =
      firstDefined(data, [
        "TrafficSources",
        "trafficSources",
        "MarketingChannels",
        "marketingChannels"
      ]) || {};

    const topCountriesRaw =
      firstDefined(data, [
        "TopCountryShares",
        "topCountryShares",
        "TopCountries",
        "topCountries",
        "Geography"
      ]);

    const keywordsRaw =
      firstDefined(data, [
        "TopKeywords",
        "topKeywords",
        "SearchKeywords",
        "searchKeywords"
      ]);

    const aiRaw =
      firstDefined(data, [
        "AITraffic",
        "aiTraffic",
        "AiTraffic",
        "GenAITraffic",
        "genAiTraffic"
      ]);

    const visitsSeries =
      firstDefined(data, [
        "EstimatedMonthlyVisits",
        "estimatedMonthlyVisits",
        "MonthlyVisits",
        "monthlyVisits"
      ]);

    let latestVisits =
      firstDefined(data, [
        "Visits",
        "visits",
        "TotalVisits",
        "totalVisits"
      ]);

    let month =
      firstDefined(data, [
        "Month",
        "month",
        "Date",
        "date",
        "DataMonth",
        "dataMonth"
      ]);

    if (
      visitsSeries &&
      typeof visitsSeries === "object" &&
      !Array.isArray(visitsSeries)
    ) {
      const entries = Object.entries(visitsSeries)
        .filter(([, v]) => Number.isFinite(Number(v)))
        .sort((a, b) =>
          String(a[0]).localeCompare(String(b[0]))
        );

      if (entries.length) {
        month =
          month ||
          entries[entries.length - 1][0];

        latestVisits =
          latestVisits ??
          entries[entries.length - 1][1];
      }
    }

    const result = {
      source: "direct",
      domain,
      month: normalizeMonth(month),

      metrics: {
        monthlyVisits: latestVisits,

        bounceRate:
          firstDefined(engagement, [
            "BounceRate",
            "bounceRate",
            "bounce_rate"
          ]) ??
          firstDefined(data, [
            "BounceRate",
            "bounceRate",
            "bounce_rate"
          ]),

        pagesPerVisit:
          firstDefined(engagement, [
            "PagePerVisit",
            "PagesPerVisit",
            "pagesPerVisit",
            "pages_per_visit"
          ]) ??
          firstDefined(data, [
            "PagePerVisit",
            "PagesPerVisit",
            "pagesPerVisit",
            "pages_per_visit"
          ]),

        avgVisitDuration:
          firstDefined(engagement, [
            "TimeOnSite",
            "AvgVisitDuration",
            "AverageVisitDuration",
            "timeOnSite",
            "average_visit_duration"
          ]) ??
          firstDefined(data, [
            "TimeOnSite",
            "AvgVisitDuration",
            "AverageVisitDuration",
            "timeOnSite",
            "average_visit_duration"
          ])
      },

      ranks: {
        global:
          firstDefined(data, [
            "GlobalRank.Rank",
            "GlobalRank",
            "globalRank.rank",
            "globalRank"
          ]),

        country:
          firstDefined(data, [
            "CountryRank.Rank",
            "CountryRank",
            "countryRank.rank",
            "countryRank"
          ]),

        category:
          firstDefined(data, [
            "CategoryRank.Rank",
            "CategoryRank",
            "categoryRank.rank",
            "categoryRank"
          ])
      },

      countries: [],
      trafficSources: [],
      keywords: [],
      aiTraffic: []
    };

    for (
      const item of arrayFromUnknown(topCountriesRaw)
    ) {
      const country =
        item.CountryCode ||
        item.countryCode ||
        item.Country ||
        item.country ||
        item.CountryName ||
        item.countryName ||
        item.key;

      const share =
        item.Value ??
        item.value ??
        item.Share ??
        item.share ??
        item.TrafficShare ??
        item.trafficShare;

      if (
        country &&
        share != null
      ) {
        result.countries.push({
          name: String(country),
          share
        });
      }
    }

    const trafficNameMap = {
      Direct: "Direct",
      Mail: "Email",
      Email: "Email",
      Social: "Social Organic",
      OrganicSearch: "Search Organic",
      SearchOrganic: "Search Organic",
      PaidSearch: "Search Paid",
      SearchPaid: "Search Paid",
      Referrals: "Referrals",
      Referral: "Referrals",
      DisplayAds: "Display Ads",
      Display: "Display Ads",
      GenAI: "Gen AI",
      GenAi: "Gen AI",
      Affiliate: "Affiliate",
      SocialPaid: "Social Paid",
      PaidSocial: "Social Paid"
    };

    for (
      const [key, value]
      of Object.entries(trafficSources || {})
    ) {
      let numeric = value;

      if (
        value &&
        typeof value === "object"
      ) {
        numeric =
          value.Value ??
          value.value ??
          value.Share ??
          value.share;
      }

      if (numeric == null) {
        continue;
      }

      result.trafficSources.push({
        name:
          trafficNameMap[key] ||
          splitCamel(key),
        share: numeric
      });
    }

    for (
      const item of arrayFromUnknown(keywordsRaw)
    ) {
      const keyword =
        item.Keyword ||
        item.keyword ||
        item.Term ||
        item.term ||
        item.key;

      const traffic =
        item.Traffic ??
        item.traffic ??
        item.Visits ??
        item.visits ??
        item.Volume ??
        item.volume;

      const cpc =
        item.CPC ??
        item.cpc ??
        item.CostPerClick ??
        item.costPerClick;

      if (keyword) {
        result.keywords.push({
          keyword: String(keyword),
          traffic,
          cpc
        });
      }
    }

    for (
      const item of arrayFromUnknown(aiRaw)
    ) {
      const name =
        item.Domain ||
        item.domain ||
        item.Source ||
        item.source ||
        item.key;

      const share =
        item.Share ??
        item.share ??
        item.Value ??
        item.value;

      if (
        name &&
        share != null
      ) {
        result.aiTraffic.push({
          name: String(name),
          share
        });
      }
    }

    return result;
  }

  function splitCamel(s) {
    return String(s)
      .replace(/[_-]+/g, " ")
      .replace(
        /([a-z0-9])([A-Z])/g,
        "$1 $2"
      )
      .replace(/\s+/g, " ")
      .trim();
  }

  async function tryDirect(domain) {
    const url =
      SW.DIRECT_ENDPOINT +
      encodeURIComponent(domain);

    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () => controller.abort(),
        6500
      );

    try {
      const res = await fetch(url, {
        method: "GET",
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept:
            "application/json, text/plain, */*"
        }
      });

      if (!res.ok) {
        throw new Error(
          `HTTP ${res.status}`
        );
      }

      const type =
        res.headers.get(
          "content-type"
        ) || "";

      if (!type.includes("json")) {
        const text =
          await res.text();

        const parsed =
          JSON.parse(text);

        return normalizeDirectJson(
          parsed,
          domain
        );
      }

      return normalizeDirectJson(
        await res.json(),
        domain
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  function textLines() {
    const raw =
      (document.body &&
        document.body.innerText) ||
      "";

    return raw
      .split(/\n+/)
      .map(s =>
        s
          .replace(/\s+/g, " ")
          .trim()
      )
      .filter(Boolean);
  }

  function findAfter(
    lines,
    labels,
    options = {}
  ) {
    const normalizedLabels =
      labels.map(v =>
        v.toLowerCase()
      );

    for (
      let i = 0;
      i < lines.length;
      i++
    ) {
      const lower =
        lines[i].toLowerCase();

      const hit =
        normalizedLabels.some(label =>
          options.exact
            ? lower === label
            : lower.includes(label)
        );

      if (!hit) {
        continue;
      }

      for (
        let j = i + 1;
        j <
        Math.min(
          lines.length,
          i +
            1 +
            (options.lookAhead || 8)
        );
        j++
      ) {
        const candidate =
          lines[j];

        if (
          options.reject &&
          options.reject(candidate)
        ) {
          continue;
        }

        if (
          !options.accept ||
          options.accept(candidate)
        ) {
          return candidate;
        }
      }
    }

    return "";
  }

  function looksPercent(s) {
    return /^<?\s*\d+(?:[.,]\d+)?\s*%$/.test(
      String(s).trim()
    );
  }

  function looksDuration(s) {
    return /^\d{1,2}:\d{2}(?::\d{2})?$/.test(
      String(s).trim()
    );
  }

  function looksTrafficNumber(s) {
    return /^\d+(?:[.,]\d+)?\s*[KMBT]?$/i.test(
      String(s).trim()
    );
  }

  function looksRank(s) {
    return /^(?:--|N\/A|#?\s*[\d,]+)$/i.test(
      String(s).trim()
    );
  }

  function parsePercentText(s) {
    if (!s) {
      return null;
    }

    const t =
      String(s).trim();

    if (
      /^<\s*0\.01%$/.test(t)
    ) {
      return "<0.01%";
    }

    return t;
  }

  function findSection(
    lines,
    headings,
    stopHeadings
  ) {
    let start = -1;

    for (
      let i = 0;
      i < lines.length;
      i++
    ) {
      const l =
        lines[i].toLowerCase();

      if (
        headings.some(h =>
          l === h.toLowerCase() ||
          l.includes(
            h.toLowerCase()
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
        lines.length,
        start + 80
      );

    for (
      let i = start + 1;
      i < end;
      i++
    ) {
      const l =
        lines[i].toLowerCase();

      if (
        stopHeadings.some(h =>
          l === h.toLowerCase() ||
          l.startsWith(
            h.toLowerCase()
          )
        )
      ) {
        end = i;
        break;
      }
    }

    return lines.slice(
      start + 1,
      end
    );
  }

  const COUNTRIES = new Set([
    "United States",
    "United Kingdom",
    "India",
    "Japan",
    "Brazil",
    "Germany",
    "France",
    "Canada",
    "Australia",
    "Italy",
    "Spain",
    "Mexico",
    "Indonesia",
    "Turkey",
    "Poland",
    "Ukraine",
    "Netherlands",
    "Sweden",
    "Norway",
    "Denmark",
    "Finland",
    "Belgium",
    "Switzerland",
    "Austria",
    "Portugal",
    "Greece",
    "Romania",
    "Bulgaria",
    "Czech Republic",
    "Czechia",
    "Slovakia",
    "Hungary",
    "Ireland",
    "Israel",
    "Saudi Arabia",
    "United Arab Emirates",
    "South Africa",
    "Nigeria",
    "Egypt",
    "Argentina",
    "Colombia",
    "Chile",
    "Peru",
    "Malaysia",
    "Singapore",
    "Thailand",
    "Vietnam",
    "Philippines",
    "South Korea",
    "Korea, Republic of",
    "Taiwan",
    "Hong Kong",
    "China",
    "New Zealand",
    "Pakistan",
    "Bangladesh",
    "Russia",
    "Russian Federation"
  ]);

  function extractCountries(lines) {
    const section =
      findSection(
        lines,
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
      i < section.length - 1;
      i++
    ) {
      const name =
        section[i];

      const value =
        section[i + 1];

      if (
        COUNTRIES.has(name) &&
        looksPercent(value)
      ) {
        out.push({
          name,
          share:
            parsePercentText(value)
        });

        i++;
      }

      if (out.length >= 5) {
        break;
      }
    }

    if (!out.length) {
      for (
        let i = 0;
        i < section.length - 1;
        i++
      ) {
        const name =
          section[i];

        const value =
          section[i + 1];

        if (
          /^[A-Z][A-Za-z .,'’()-]{2,40}$/.test(
            name
          ) &&
          looksPercent(value) &&
          !/^(Desktop Only|Worldwide|Country|Traffic|Top \d+ Countries)$/i.test(
            name
          )
        ) {
          out.push({
            name,
            share:
              parsePercentText(value)
          });

          i++;
        }

        if (out.length >= 5) {
          break;
        }
      }
    }

    return out;
  }

  const SOURCE_NAMES = [
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
  ];

  function extractTrafficSources(lines) {
    const section =
      findSection(
        lines,
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
      i < section.length - 1;
      i++
    ) {
      const name =
        section[i];

      const value =
        section[i + 1];

      if (
        SOURCE_NAMES.includes(name) &&
        (
          looksPercent(value) ||
          /^<\s*0\.01%$/.test(value)
        )
      ) {
        out.push({
          name,
          share:
            parsePercentText(value)
        });

        i++;
      }
    }

    return dedupeBy(
      out,
      x => x.name
    );
  }

  function extractKeywords(lines) {
    const section =
      findSection(
        lines,
        ["Top Keywords"],
        [
          "AI Traffic",
          "Top Prompts",
          "Ranking",
          "Geography",
          "Traffic Sources"
        ]
      );

    const cleaned =
      section.filter(x =>
        !/^(Worldwide|Desktop Only|Keyword|Traffic|Cost per Click|Organic & Paid|Branded & Non-Branded)$/i.test(
          x
        ) &&
        !/^[A-Z][a-z]{2}\s+\d{4}$/.test(
          x
        )
      );

    const out = [];

    for (
      let i = 0;
      i < cleaned.length;
      i++
    ) {
      const keyword =
        cleaned[i];

      if (
        !keyword ||
        looksTrafficNumber(keyword) ||
        /^\$\d/.test(keyword)
      ) {
        continue;
      }

      let traffic = null;
      let cpc = null;

      if (
        i + 1 < cleaned.length &&
        looksTrafficNumber(
          cleaned[i + 1]
        )
      ) {
        traffic =
          cleaned[i + 1];

        i++;
      }

      if (
        i + 1 < cleaned.length &&
        /^\$\d+(?:[.,]\d+)?$/.test(
          cleaned[i + 1]
        )
      ) {
        cpc =
          cleaned[i + 1];

        i++;
      }

      if (traffic != null) {
        out.push({
          keyword,
          traffic,
          cpc
        });
      }

      if (out.length >= 5) {
        break;
      }
    }

    return out;
  }

  function extractAiTraffic(lines) {
    const section =
      findSection(
        lines,
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
      i < section.length - 1;
      i++
    ) {
      const name =
        section[i];

      const value =
        section[i + 1];

      if (
        /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(
          name
        ) &&
        looksPercent(value)
      ) {
        out.push({
          name,
          share:
            parsePercentText(value)
        });

        i++;
      }
    }

    return out.slice(0, 10);
  }

  function dedupeBy(
    arr,
    keyFn
  ) {
    const seen =
      new Set();

    return arr.filter(item => {
      const key =
        keyFn(item);

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }

  function extractFromDom(domain) {
    const lines =
      textLines();

    const monthlyVisits =
      findAfter(
        lines,
        ["Monthly Visits"],
        {
          lookAhead: 5,
          accept:
            looksTrafficNumber
        }
      );

    const bounceRate =
      findAfter(
        lines,
        ["Bounce Rate"],
        {
          lookAhead: 5,
          accept:
            looksPercent
        }
      );

    const pagesPerVisit =
      findAfter(
        lines,
        [
          "Pages per Visit",
          "Pages / Visit"
        ],
        {
          lookAhead: 5,
          accept: s =>
            /^\d+(?:[.,]\d+)?$/.test(
              s
            )
        }
      );

    const avgVisitDuration =
      findAfter(
        lines,
        [
          "Avg. Visit Duration",
          "Average Visit Duration"
        ],
        {
          lookAhead: 5,
          accept:
            looksDuration
        }
      );

    const globalRank =
      findAfter(
        lines,
        ["Global Rank"],
        {
          exact: true,
          lookAhead: 5,
          accept:
            looksRank,
          reject: s =>
            /^Worldwide$/i.test(
              s
            )
        }
      );

    const countryRank =
      findAfter(
        lines,
        ["Country Rank"],
        {
          exact: true,
          lookAhead: 5,
          accept:
            looksRank,
          reject: s =>
            /^N\/A$/i.test(
              s
            )
        }
      );

    const categoryRank =
      findAfter(
        lines,
        [
          "Category Rank",
          "Industry Rank"
        ],
        {
          exact: true,
          lookAhead: 5,
          accept:
            looksRank,
          reject: s =>
            /^N\/A$/i.test(
              s
            )
        }
      );

    let month = "";

    for (const line of lines) {
      if (
        /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+20\d{2}$/i.test(
          line
        )
      ) {
        month = line;
        break;
      }
    }

    return {
      source: "page",
      domain,
      month,

      metrics: {
        monthlyVisits,
        bounceRate,
        pagesPerVisit,
        avgVisitDuration
      },

      ranks: {
        global:
          globalRank,
        country:
          countryRank,
        category:
          categoryRank
      },

      countries:
        extractCountries(lines),

      trafficSources:
        extractTrafficSources(lines),

      keywords:
        extractKeywords(lines),

      aiTraffic:
        extractAiTraffic(lines)
    };
  }

  function hasUsefulData(data) {
    if (!data) {
      return false;
    }

    const metricValues =
      objectValues(
        data.metrics
      );

    return Boolean(
      metricValues.some(
        v =>
          v != null &&
          v !== "" &&
          v !== "—"
      ) ||
      data.countries?.length ||
      data.trafficSources?.length ||
      data.keywords?.length ||
      data.aiTraffic?.length
    );
  }

  function css() {
    if (
      document.getElementById(
        SW.STYLE_ID
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      SW.STYLE_ID;

    style.textContent = `
      #${SW.PANEL_ID},
      #${SW.PANEL_ID} * {
        box-sizing: border-box !important;
      }

      #${SW.PANEL_ID} {
        position: fixed !important;
        top: 16px !important;
        right: 16px !important;
        width: min(430px, calc(100vw - 24px)) !important;
        max-height: calc(100vh - 32px) !important;
        overflow: auto !important;
        z-index: 2147483647 !important;
        background: #101114 !important;
        color: #f4f5f7 !important;
        border: 1px solid rgba(255,255,255,.14) !important;
        border-radius: 16px !important;
        box-shadow: 0 18px 60px rgba(0,0,0,.45) !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif !important;
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
        align-items: center !important;
        justify-content: space-between !important;
        gap: 12px !important;
        padding: 14px 14px 12px !important;
        background: rgba(16,17,20,.96) !important;
        backdrop-filter: blur(12px) !important;
        border-bottom: 1px solid rgba(255,255,255,.08) !important;
      }

      .sw-title {
        font-weight: 800 !important;
        font-size: 15px !important;
        letter-spacing: -.01em !important;
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

      .sw-hero {
        display: grid !important;
        grid-template-columns: 1.2fr .8fr .8fr !important;
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
        color: #fff !important;
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
        color: #e8eaf0 !important;
        overflow-wrap: anywhere !important;
      }

      .sw-value {
        color: #fff !important;
        font-variant-numeric: tabular-nums !important;
        white-space: nowrap !important;
      }

      .sw-ranks {
        display: grid !important;
        grid-template-columns: repeat(3, 1fr) !important;
        gap: 8px !important;
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

      .sw-status {
        padding: 11px !important;
        border-radius: 12px !important;
        background: rgba(255,255,255,.055) !important;
        color: #c9ced7 !important;
      }

      .sw-error {
        color: #ffb7b7 !important;
      }

      .sw-foot {
        margin-top: 10px !important;
        color: #747b87 !important;
        font-size: 10px !important;
      }

      @media (max-width: 560px) {
        #${SW.PANEL_ID} {
          top: 8px !important;
          right: 8px !important;
          width: calc(100vw - 16px) !important;
          max-height: calc(100vh - 16px) !important;
        }

        .sw-hero {
          grid-template-columns: 1fr 1fr !important;
        }

        .sw-hero .sw-card:first-child {
          grid-column: 1 / -1 !important;
        }
      }
    `;

    document.documentElement.appendChild(
      style
    );
  }

  function esc(value) {
    return String(
      value == null
        ? ""
        : value
    )
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function createPanelShell(
    domain,
    subtitle
  ) {
    css();

    const panel =
      document.createElement(
        "div"
      );

    panel.id =
      SW.PANEL_ID;

    panel.innerHTML = `
      <div class="sw-head">
        <div>
          <div class="sw-title">
            SW · ${esc(domain || "Similarweb")}
          </div>

          <div class="sw-sub">
            ${esc(subtitle || "")}
          </div>
        </div>

        <button
          class="sw-x"
          type="button"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div class="sw-body"></div>
    `;

    panel
      .querySelector(".sw-x")
      .onclick = () =>
        panel.remove();

    document.documentElement
      .appendChild(panel);

    return panel;
  }

  function showStatus(
    domain,
    message,
    isError = false
  ) {
    let panel =
      document.getElementById(
        SW.PANEL_ID
      );

    if (!panel) {
      panel =
        createPanelShell(
          domain,
          "Similarweb public data"
        );
    }

    const body =
      panel.querySelector(
        ".sw-body"
      );

    body.innerHTML = `
      <div class="sw-status ${
        isError
          ? "sw-error"
          : ""
      }">
        ${esc(message)}
      </div>
    `;

    return panel;
  }

  function row(
    label,
    value
  ) {
    return `
      <div class="sw-row">
        <div class="sw-label">
          ${esc(label)}
        </div>

        <div class="sw-value">
          ${esc(value ?? "—")}
        </div>
      </div>
    `;
  }

  function render(data) {
    const domain =
      data.domain ||
      currentTargetDomain() ||
      "Unknown domain";

    const sourceLabel =
      data.source === "direct"
        ? "direct public data"
        : "data visible on Similarweb";

    let panel =
      document.getElementById(
        SW.PANEL_ID
      );

    if (!panel) {
      panel =
        createPanelShell(
          domain,
          sourceLabel
        );
    }

    panel.querySelector(
      ".sw-title"
    ).textContent =
      `SW · ${domain}`;

    panel.querySelector(
      ".sw-sub"
    ).textContent =
      [
        data.month,
        sourceLabel
      ]
        .filter(Boolean)
        .join(" · ");

    const m =
      data.metrics || {};

    const r =
      data.ranks || {};

    const countries =
      (data.countries || [])
        .slice(0, 5);

    const sources =
      data.trafficSources || [];

    const keywords =
      (data.keywords || [])
        .slice(0, 5);

    const ai =
      data.aiTraffic || [];

    const countriesHtml =
      countries.length
        ? countries
            .map(x =>
              row(
                x.name,
                formatPercent(
                  x.share
                )
              )
            )
            .join("")
        : row(
            "No public country data found",
            ""
          );

    const sourcesHtml =
      sources.length
        ? sources
            .map(x =>
              row(
                x.name,
                formatPercent(
                  x.share
                )
              )
            )
            .join("")
        : row(
            "No public traffic source data found",
            ""
          );

    const keywordsHtml =
      keywords.length
        ? keywords
            .map(x => {
              const parts = [];

              if (
                x.traffic != null &&
                x.traffic !== ""
              ) {
                parts.push(
                  typeof x.traffic ===
                  "number"
                    ? formatNumber(
                        x.traffic
                      )
                    : x.traffic
                );
              }

              if (
                x.cpc != null &&
                x.cpc !== ""
              ) {
                const cpc =
                  typeof x.cpc ===
                  "number"
                    ? "$" +
                      stripZero(
                        x.cpc.toFixed(
                          2
                        )
                      )
                    : x.cpc;

                parts.push(cpc);
              }

              return row(
                x.keyword,
                parts.join(" · ") ||
                  "—"
              );
            })
            .join("")
        : "";

    const aiHtml =
      ai.length
        ? ai
            .map(x =>
              row(
                x.name,
                formatPercent(
                  x.share
                )
              )
            )
            .join("")
        : "";

    const body =
      panel.querySelector(
        ".sw-body"
      );

    body.innerHTML = `
      <div class="sw-hero">

        <div class="sw-card">
          <div class="sw-k">
            Monthly Visits
          </div>

          <div class="sw-v">
            ${esc(
              m.monthlyVisits
                ? typeof m.monthlyVisits ===
                  "number"
                  ? formatNumber(
                      m.monthlyVisits
                    )
                  : m.monthlyVisits
                : "—"
            )}
          </div>
        </div>

        <div class="sw-card">
          <div class="sw-k">
            Bounce Rate
          </div>

          <div class="sw-v sw-small">
            ${esc(
              formatPercent(
                m.bounceRate
              )
            )}
          </div>
        </div>

        <div class="sw-card">
          <div class="sw-k">
            Pages / Visit
          </div>

          <div class="sw-v sw-small">
            ${esc(
              m.pagesPerVisit ??
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
              formatDuration(
                m.avgVisitDuration
              )
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
                normalizeRank(
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
                normalizeRank(
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
                normalizeRank(
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

        ${countriesHtml}
      </div>

      <div class="sw-section">
        <div class="sw-section-title">
          Traffic Sources
        </div>

        ${sourcesHtml}
      </div>

      ${
        keywordsHtml
          ? `
        <div class="sw-section">

          <div class="sw-section-title">
            Top Keywords
          </div>

          ${keywordsHtml}

        </div>
      `
          : ""
      }

      ${
        aiHtml
          ? `
        <div class="sw-section">

          <div class="sw-section-title">
            AI Traffic
          </div>

          ${aiHtml}

        </div>
      `
          : ""
      }

      <div class="sw-actions">

        <button
          class="sw-btn"
          data-action="copy"
          type="button"
        >
          COPY
        </button>

        <button
          class="sw-btn"
          data-action="json"
          type="button"
        >
          COPY JSON
        </button>

        <button
          class="sw-btn"
          data-action="open"
          type="button"
        >
          OPEN SIMILARWEB
        </button>

        <button
          class="sw-btn"
          data-action="refresh"
          type="button"
        >
          REFRESH
        </button>

      </div>

      <div class="sw-foot">
        SW Inspector · ${esc(
          SW.VERSION
        )}
      </div>
    `;

    panel.__swData =
      data;

    body
      .querySelector(
        '[data-action="copy"]'
      )
      .onclick = async () => {
        await copyText(
          toPlainText(data)
        );

        flashButton(
          body.querySelector(
            '[data-action="copy"]'
          ),
          "COPIED"
        );
      };

    body
      .querySelector(
        '[data-action="json"]'
      )
      .onclick = async () => {
        await copyText(
          JSON.stringify(
            data,
            null,
            2
          )
        );

        flashButton(
          body.querySelector(
            '[data-action="json"]'
          ),
          "COPIED"
        );
      };

    body
      .querySelector(
        '[data-action="open"]'
      )
      .onclick = () =>
        openSimilarweb(
          domain
        );

    body
      .querySelector(
        '[data-action="refresh"]'
      )
      .onclick = async () => {
        panel.remove();

        await main(true);
      };
  }

  function toPlainText(data) {
    const m =
      data.metrics || {};

    const r =
      data.ranks || {};

    const out = [];

    out.push(
      `Similarweb · ${data.domain}`
    );

    if (data.month) {
      out.push(data.month);
    }

    out.push("");

    out.push(
      `Monthly Visits: ${
        m.monthlyVisits
          ? typeof m.monthlyVisits ===
            "number"
            ? formatNumber(
                m.monthlyVisits
              )
            : m.monthlyVisits
          : "—"
      }`
    );

    out.push(
      `Bounce Rate: ${formatPercent(
        m.bounceRate
      )}`
    );

    out.push(
      `Pages / Visit: ${
        m.pagesPerVisit ?? "—"
      }`
    );

    out.push(
      `Avg. Visit Duration: ${formatDuration(
        m.avgVisitDuration
      )}`
    );

    out.push("");

    out.push(
      `Global Rank: ${normalizeRank(
        r.global
      )}`
    );

    out.push(
      `Country Rank: ${normalizeRank(
        r.country
      )}`
    );

    out.push(
      `Category Rank: ${normalizeRank(
        r.category
      )}`
    );

    if (
      data.countries?.length
    ) {
      out.push(
        "",
        "Top Countries:"
      );

      for (
        const x of data.countries.slice(
          0,
          5
        )
      ) {
        out.push(
          `${x.name}: ${formatPercent(
            x.share
          )}`
        );
      }
    }

    if (
      data.trafficSources?.length
    ) {
      out.push(
        "",
        "Traffic Sources:"
      );

      for (
        const x
        of data.trafficSources
      ) {
        out.push(
          `${x.name}: ${formatPercent(
            x.share
          )}`
        );
      }
    }

    if (
      data.keywords?.length
    ) {
      out.push(
        "",
        "Top Keywords:"
      );

      for (
        const x
        of data.keywords.slice(
          0,
          5
        )
      ) {
        const p = [
          x.keyword
        ];

        if (
          x.traffic != null &&
          x.traffic !== ""
        ) {
          p.push(
            typeof x.traffic ===
            "number"
              ? formatNumber(
                  x.traffic
                )
              : x.traffic
          );
        }

        if (
          x.cpc != null &&
          x.cpc !== ""
        ) {
          p.push(
            typeof x.cpc ===
            "number"
              ? "$" +
                stripZero(
                  x.cpc.toFixed(
                    2
                  )
                )
              : x.cpc
          );
        }

        out.push(
          p.join(" · ")
        );
      }
    }

    if (
      data.aiTraffic?.length
    ) {
      out.push(
        "",
        "AI Traffic:"
      );

      for (
        const x
        of data.aiTraffic
      ) {
        out.push(
          `${x.name}: ${formatPercent(
            x.share
          )}`
        );
      }
    }

    return out.join("\n");
  }

  async function copyText(text) {
    try {
      await navigator.clipboard
        .writeText(text);

      return;
    } catch (_) {}

    const ta =
      document.createElement(
        "textarea"
      );

    ta.value =
      text;

    ta.style.position =
      "fixed";

    ta.style.left =
      "-9999px";

    ta.style.top =
      "0";

    document.body
      .appendChild(ta);

    ta.focus();
    ta.select();

    document.execCommand(
      "copy"
    );

    ta.remove();
  }

  function flashButton(
    button,
    message
  ) {
    const old =
      button.textContent;

    button.textContent =
      message;

    setTimeout(() => {
      if (
        button.isConnected
      ) {
        button.textContent =
          old;
      }
    }, 1200);
  }

  function openSimilarweb(domain) {
    const url =
      `https://www.similarweb.com/website/${encodeURIComponent(
        domain
      )}/#overview`;

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function extractSimilarwebPage(
    domain,
    forceWait
  ) {
    if (forceWait) {
      showStatus(
        domain,
        "Waiting for Similarweb data…"
      );

      await sleep(1800);
    }

    let data =
      extractFromDom(domain);

    if (!hasUsefulData(data)) {
      showStatus(
        domain,
        "Waiting for Similarweb data…"
      );

      await sleep(1800);

      data =
        extractFromDom(domain);
    }

    return data;
  }

  async function main(
    forceRefresh = false
  ) {
    const domain =
      currentTargetDomain();

    if (!domain) {
      showStatus(
        "",
        "Could not detect the target domain on this Similarweb page.",
        true
      );

      return;
    }

    const onSimilarweb =
      SW.SIMILARWEB_HOST_RE.test(
        cleanHost(
          location.hostname
        )
      );

    if (onSimilarweb) {
      const data =
        await extractSimilarwebPage(
          domain,
          forceRefresh
        );

      if (
        hasUsefulData(data)
      ) {
        render(data);
      } else {
        showStatus(
          domain,
          "I can see the Similarweb page, but no public metrics are loaded yet. Scroll through the report once, wait for the blocks to load, then press SW again.",
          true
        );
      }

      return;
    }

    showStatus(
      domain,
      "Checking Similarweb public data…"
    );

    try {
      const direct =
        await tryDirect(domain);

      if (
        hasUsefulData(direct)
      ) {
        render(direct);
        return;
      }
    } catch (_) {
      // Expected on browsers where
      // the public Similarweb endpoint
      // is blocked by CORS.
    }

    const panel =
      document.getElementById(
        SW.PANEL_ID
      );

    if (panel) {
      const body =
        panel.querySelector(
          ".sw-body"
        );

      body.innerHTML = `
        <div class="sw-status">
          Direct access is blocked in this browser.
          Opening the public Similarweb report for
          <b>${esc(domain)}</b>.

          <br><br>

          When it loads, press <b>SW</b>
          once more to extract the visible free data.
        </div>
      `;
    }

    await sleep(650);

    openSimilarweb(
      domain
    );
  }

  main(false).catch(err => {
    console.error(
      "[SW Inspector]",
      err
    );

    showStatus(
      currentTargetDomain(),
      `SW error: ${
        err &&
        err.message
          ? err.message
          : String(err)
      }`,
      true
    );
  });
})();
