(() => {
  "use strict";

  const ID = "__sw_deep_probe__";
  const STYLE_ID = "__sw_deep_probe_style__";

  if (document.getElementById(ID)) {
    document.getElementById(ID).remove();
    return;
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function safeJson(value) {
    try {
      return JSON.stringify(value);
    } catch (_) {
      return "";
    }
  }

  function truncate(value, max = 5000) {
    const s = String(value ?? "");
    return s.length > max ? s.slice(0, max) + "…[TRUNCATED]" : s;
  }

  function looksInteresting(text) {
    const s = String(text || "").toLowerCase();

    return (
      s.includes("visit") ||
      s.includes("traffic") ||
      s.includes("bounce") ||
      s.includes("rank") ||
      s.includes("keyword") ||
      s.includes("country") ||
      s.includes("geograph") ||
      s.includes("duration") ||
      s.includes("pagepervisit") ||
      s.includes("pagespervisit") ||
      s.includes("marketing") ||
      s.includes("organic") ||
      s.includes("direct") ||
      s.includes("referral") ||
      s.includes("social") ||
      s.includes("display") ||
      s.includes("genai") ||
      s.includes("gen_ai") ||
      s.includes("32.3m")
    );
  }

  function cleanObject(value, depth = 0, seen = new WeakSet()) {
    if (depth > 5) return "[MAX_DEPTH]";

    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return value;
    }

    if (
      typeof value === "function" ||
      typeof value === "symbol" ||
      typeof value === "undefined"
    ) {
      return undefined;
    }

    if (typeof value !== "object") {
      return String(value);
    }

    if (seen.has(value)) {
      return "[CIRCULAR]";
    }

    seen.add(value);

    if (Array.isArray(value)) {
      return value.slice(0, 100).map(v =>
        cleanObject(v, depth + 1, seen)
      );
    }

    const out = {};
    let count = 0;

    for (const key of Object.keys(value)) {
      if (count >= 150) {
        out.__truncated__ = true;
        break;
      }

      try {
        const cleaned = cleanObject(
          value[key],
          depth + 1,
          seen
        );

        if (cleaned !== undefined) {
          out[key] = cleaned;
          count++;
        }
      } catch (_) {}
    }

    return out;
  }

  function collectScripts() {
    const out = [];

    document.querySelectorAll("script").forEach((script, index) => {
      try {
        const type = script.type || "";
        const id = script.id || "";
        const src = script.src || "";
        const text = script.textContent || "";

        if (
          type.includes("json") ||
          id.includes("NEXT") ||
          id.includes("DATA") ||
          looksInteresting(text) ||
          looksInteresting(src)
        ) {
          out.push({
            index,
            id,
            type,
            src,
            text: truncate(text, 15000)
          });
        }
      } catch (_) {}
    });

    return out;
  }

  function collectJsonScripts() {
    const out = [];

    document.querySelectorAll(
      'script[type="application/json"], script[type="application/ld+json"], #__NEXT_DATA__'
    ).forEach((script, index) => {
      const raw = script.textContent || "";

      if (!raw) return;

      try {
        const parsed = JSON.parse(raw);

        out.push({
          index,
          id: script.id || "",
          type: script.type || "",
          parsed: cleanObject(parsed)
        });
      } catch (e) {
        out.push({
          index,
          id: script.id || "",
          type: script.type || "",
          parseError: String(e),
          raw: truncate(raw, 10000)
        });
      }
    });

    return out;
  }

  function collectDataAttributes() {
    const out = [];

    document.querySelectorAll("*").forEach((el, index) => {
      try {
        const attrs = {};

        for (const attr of el.attributes || []) {
          if (
            attr.name.startsWith("data-") ||
            attr.name === "aria-label" ||
            attr.name === "aria-valuenow" ||
            attr.name === "aria-valuetext" ||
            attr.name === "title"
          ) {
            if (
              looksInteresting(attr.value) ||
              /\d/.test(attr.value)
            ) {
              attrs[attr.name] = attr.value;
            }
          }
        }

        if (Object.keys(attrs).length) {
          out.push({
            index,
            tag: el.tagName,
            class: truncate(el.className || "", 300),
            text: truncate(el.textContent || "", 500),
            attrs
          });
        }
      } catch (_) {}
    });

    return out.slice(0, 1000);
  }

  function collectSvg() {
    const out = [];

    document.querySelectorAll("svg").forEach((svg, index) => {
      try {
        const texts = Array.from(
          svg.querySelectorAll("text, title, desc")
        )
          .map(x => (x.textContent || "").trim())
          .filter(Boolean);

        const attrs = {};

        for (const attr of svg.attributes || []) {
          attrs[attr.name] = attr.value;
        }

        const childData = [];

        svg.querySelectorAll("*").forEach(el => {
          const item = {};

          for (const attr of el.attributes || []) {
            if (
              attr.name.startsWith("data-") ||
              attr.name.startsWith("aria-") ||
              attr.name === "value"
            ) {
              item[attr.name] = attr.value;
            }
          }

          const txt = (el.textContent || "").trim();

          if (
            Object.keys(item).length ||
            (
              txt &&
              /\d/.test(txt)
            )
          ) {
            childData.push({
              tag: el.tagName,
              text: truncate(txt, 300),
              attrs: item
            });
          }
        });

        if (
          texts.length ||
          childData.length ||
          looksInteresting(safeJson(attrs))
        ) {
          out.push({
            index,
            attrs,
            texts,
            childData: childData.slice(0, 300)
          });
        }
      } catch (_) {}
    });

    return out;
  }

  function collectCanvas() {
    return Array.from(
      document.querySelectorAll("canvas")
    ).map((canvas, index) => ({
      index,
      width: canvas.width,
      height: canvas.height,
      class: canvas.className || "",
      id: canvas.id || "",
      parentText: truncate(
        canvas.parentElement?.innerText || "",
        1000
      )
    }));
  }

  function collectPerformanceResources() {
    const entries =
      performance.getEntriesByType("resource") || [];

    return entries
      .map(entry => ({
        name: entry.name,
        initiatorType: entry.initiatorType,
        duration: Math.round(entry.duration),
        transferSize: entry.transferSize
      }))
      .filter(x =>
        looksInteresting(x.name) ||
        /api|graphql|website|traffic|rank|keyword|analytics/i.test(
          x.name
        )
      );
  }

  function collectWindowCandidates() {
    const out = [];

    const names = Object.getOwnPropertyNames(window);

    for (const name of names) {
      if (
        !looksInteresting(name) &&
        !/^__/.test(name)
      ) {
        continue;
      }

      try {
        const value = window[name];

        if (
          value &&
          typeof value === "object"
        ) {
          const cleaned = cleanObject(value);
          const json = safeJson(cleaned);

          if (
            looksInteresting(json) ||
            looksInteresting(name)
          ) {
            out.push({
              name,
              value: cleaned
            });
          }
        } else if (
          looksInteresting(String(value))
        ) {
          out.push({
            name,
            value
          });
        }
      } catch (_) {}
    }

    return out.slice(0, 150);
  }

  function collectReactHints() {
    const out = [];

    document.querySelectorAll("*").forEach((el, index) => {
      try {
        const keys = Object.keys(el);

        const reactKeys = keys.filter(k =>
          k.startsWith("__reactFiber") ||
          k.startsWith("__reactProps") ||
          k.startsWith("__reactContainer")
        );

        if (!reactKeys.length) return;

        const result = {
          index,
          tag: el.tagName,
          class: truncate(el.className || "", 300),
          reactKeys: []
        };

        for (const key of reactKeys) {
          try {
            const cleaned = cleanObject(
              el[key],
              0,
              new WeakSet()
            );

            const json = safeJson(cleaned);

            if (looksInteresting(json)) {
              result.reactKeys.push({
                key,
                value: cleaned
              });
            }
          } catch (_) {}
        }

        if (result.reactKeys.length) {
          out.push(result);
        }
      } catch (_) {}
    });

    return out.slice(0, 50);
  }

  function collectVisibleText() {
    return truncate(
      document.body?.innerText || "",
      30000
    );
  }

  function collectTooltips() {
    const candidates = [];

    const selectors = [
      '[role="tooltip"]',
      '[class*="tooltip"]',
      '[class*="Tooltip"]',
      '[data-testid*="tooltip"]',
      '[aria-live="polite"]'
    ];

    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach(el => {
        const text = (el.innerText || el.textContent || "").trim();

        if (text) {
          candidates.push({
            selector,
            text: truncate(text, 1000),
            html: truncate(el.outerHTML, 3000)
          });
        }
      });
    }

    return candidates;
  }

  function buildReport() {
    return {
      meta: {
        url: location.href,
        host: location.hostname,
        title: document.title,
        timestamp: new Date().toISOString()
      },

      visibleText: collectVisibleText(),

      jsonScripts: collectJsonScripts(),

      interestingScripts: collectScripts(),

      dataAttributes: collectDataAttributes(),

      svg: collectSvg(),

      canvas: collectCanvas(),

      performanceResources: collectPerformanceResources(),

      windowCandidates: collectWindowCandidates(),

      reactHints: collectReactHints(),

      tooltips: collectTooltips()
    };
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {}

    const textarea = document.createElement("textarea");

    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-99999px";
    textarea.style.top = "0";

    document.body.appendChild(textarea);

    textarea.focus();
    textarea.select();

    const ok = document.execCommand("copy");

    textarea.remove();

    return ok;
  }

  function makeStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");

    style.id = STYLE_ID;

    style.textContent = `
      #${ID},
      #${ID} * {
        box-sizing: border-box !important;
      }

      #${ID} {
        position: fixed !important;
        top: 12px !important;
        right: 12px !important;
        z-index: 2147483647 !important;

        width: min(520px, calc(100vw - 24px)) !important;
        max-height: calc(100vh - 24px) !important;

        overflow: auto !important;

        background: #101114 !important;
        color: #f4f5f7 !important;

        border: 1px solid rgba(255,255,255,.14) !important;
        border-radius: 16px !important;

        box-shadow: 0 18px 60px rgba(0,0,0,.5) !important;

        font-family:
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          Arial,
          sans-serif !important;

        font-size: 13px !important;
        line-height: 1.4 !important;
      }

      .swd-head {
        position: sticky !important;
        top: 0 !important;

        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;

        padding: 14px !important;

        background: rgba(16,17,20,.97) !important;

        border-bottom:
          1px solid rgba(255,255,255,.08) !important;
      }

      .swd-title {
        font-weight: 800 !important;
        font-size: 15px !important;
      }

      .swd-sub {
        margin-top: 2px !important;
        color: #8f96a3 !important;
        font-size: 11px !important;
      }

      .swd-close {
        width: 30px !important;
        height: 30px !important;

        border: 0 !important;
        border-radius: 9px !important;

        background: rgba(255,255,255,.08) !important;
        color: #fff !important;

        cursor: pointer !important;
      }

      .swd-body {
        padding: 14px !important;
      }

      .swd-box {
        padding: 12px !important;

        border-radius: 12px !important;

        background: rgba(255,255,255,.055) !important;

        border:
          1px solid rgba(255,255,255,.07) !important;
      }

      .swd-counts {
        display: grid !important;

        grid-template-columns:
          repeat(2, minmax(0, 1fr)) !important;

        gap: 8px !important;

        margin-top: 12px !important;
      }

      .swd-count {
        padding: 9px !important;

        background:
          rgba(255,255,255,.04) !important;

        border-radius: 9px !important;
      }

      .swd-count strong {
        display: block !important;
        font-size: 16px !important;
      }

      .swd-count span {
        color: #9299a5 !important;
        font-size: 10px !important;
        text-transform: uppercase !important;
      }

      .swd-actions {
        display: flex !important;
        flex-wrap: wrap !important;

        gap: 8px !important;

        margin-top: 12px !important;
      }

      .swd-btn {
        padding: 9px 11px !important;

        border-radius: 9px !important;

        border:
          1px solid rgba(255,255,255,.12) !important;

        background:
          rgba(255,255,255,.07) !important;

        color: #fff !important;

        font-weight: 700 !important;
        cursor: pointer !important;
      }

      .swd-note {
        margin-top: 10px !important;
        color: #8f96a3 !important;
        font-size: 11px !important;
      }

      @media(max-width:560px) {
        #${ID} {
          top: 8px !important;
          right: 8px !important;

          width: calc(100vw - 16px) !important;
          max-height: calc(100vh - 16px) !important;
        }
      }
    `;

    document.documentElement.appendChild(style);
  }

  makeStyle();

  const report = buildReport();

  const root = document.createElement("div");
  root.id = ID;

  root.innerHTML = `
    <div class="swd-head">

      <div>
        <div class="swd-title">
          SW Deep Probe
        </div>

        <div class="swd-sub">
          ${esc(location.hostname)}
        </div>
      </div>

      <button class="swd-close">
        ✕
      </button>

    </div>

    <div class="swd-body">

      <div class="swd-box">

        Deep scan finished.

        <div class="swd-counts">

          <div class="swd-count">
            <strong>
              ${report.jsonScripts.length}
            </strong>
            <span>JSON scripts</span>
          </div>

          <div class="swd-count">
            <strong>
              ${report.interestingScripts.length}
            </strong>
            <span>Scripts</span>
          </div>

          <div class="swd-count">
            <strong>
              ${report.svg.length}
            </strong>
            <span>SVG charts</span>
          </div>

          <div class="swd-count">
            <strong>
              ${report.performanceResources.length}
            </strong>
            <span>Network URLs</span>
          </div>

          <div class="swd-count">
            <strong>
              ${report.windowCandidates.length}
            </strong>
            <span>Window objects</span>
          </div>

          <div class="swd-count">
            <strong>
              ${report.reactHints.length}
            </strong>
            <span>React objects</span>
          </div>

          <div class="swd-count">
            <strong>
              ${report.dataAttributes.length}
            </strong>
            <span>Data attrs</span>
          </div>

          <div class="swd-count">
            <strong>
              ${report.tooltips.length}
            </strong>
            <span>Tooltips</span>
          </div>

        </div>

        <div class="swd-actions">

          <button
            class="swd-btn"
            data-action="copy"
          >
            COPY DIAGNOSTIC
          </button>

          <button
            class="swd-btn"
            data-action="copy-network"
          >
            COPY NETWORK URLS
          </button>

        </div>

        <div
          class="swd-note"
          data-status
        >
          Hover the traffic chart once before running this if you want tooltip data included.
        </div>

      </div>

    </div>
  `;

  root
    .querySelector(".swd-close")
    .onclick = () => root.remove();

  root
    .querySelector('[data-action="copy"]')
    .onclick = async () => {
      const btn =
        root.querySelector(
          '[data-action="copy"]'
        );

      const status =
        root.querySelector(
          "[data-status]"
        );

      btn.textContent =
        "COPYING…";

      const ok =
        await copy(
          JSON.stringify(
            report,
            null,
            2
          )
        );

      btn.textContent =
        ok
          ? "COPIED"
          : "COPY FAILED";

      status.textContent =
        ok
          ? "Diagnostic copied. Send me the JSON."
          : "Browser blocked clipboard access.";

      setTimeout(() => {
        if (btn.isConnected) {
          btn.textContent =
            "COPY DIAGNOSTIC";
        }
      }, 1500);
    };

  root
    .querySelector(
      '[data-action="copy-network"]'
    )
    .onclick = async () => {
      const urls =
        report.performanceResources
          .map(x => x.name)
          .join("\n");

      await copy(urls);

      const btn =
        root.querySelector(
          '[data-action="copy-network"]'
        );

      btn.textContent =
        "COPIED";

      setTimeout(() => {
        if (btn.isConnected) {
          btn.textContent =
            "COPY NETWORK URLS";
        }
      }, 1500);
    };

  document.documentElement.appendChild(root);
})();
