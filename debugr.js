(function () {
  if (window.top !== window.self) return;

  if (window.__QAI_v10) return;
  window.__QAI_v10 = true;

  // ---------- small helpers

  const esc = s =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  function rectSize(el) {
    const r = el?.getBoundingClientRect?.();

    return r
      ? {
          w: Math.round(r.width || 0),
          h: Math.round(r.height || 0)
        }
      : {
          w: 0,
          h: 0
        };
  }

  function declaredSize(el) {
    const fmt = el.getAttribute('data-ad-format');

    if (
      fmt &&
      fmt !== 'auto' &&
      /^\d+x\d+$/i.test(fmt)
    ) {
      return fmt;
    }

    if (fmt === 'auto') {
      return 'auto';
    }

    const st = (el.getAttribute('style') || '').toLowerCase();

    const w = (
      /width:\s*([\d.]+)px/.exec(st) || []
    )[1];

    const h = (
      /height:\s*([\d.]+)px/.exec(st) || []
    )[1];

    if (w && h) {
      return `${Math.round(+w)}x${Math.round(+h)}`;
    }

    const aw = el.getAttribute('width');
    const ah = el.getAttribute('height');

    if (aw && ah) {
      return `${aw}x${ah}`;
    }

    return '';
  }

  function ensurePositioned(el) {
    try {
      const cs = window.getComputedStyle(el);

      if (cs && cs.position === 'static') {
        el.style.position = 'relative';
      }
    } catch {}
  }

  // ---------- HEADER BIDDING DETECTION

  function detectHB(targeting) {
    const targetingObj = targeting || {};
    const keys = Object.keys(targetingObj);

    const prebidKeys = [];
    const amazonKeys = [];
    const otherHbKeys = [];

    keys.forEach(key => {
      const lower = String(key).toLowerCase();

      // Standard Prebid targeting
      if (
        lower === 'hb_bidder' ||
        lower === 'hb_pb' ||
        lower === 'hb_adid' ||
        lower === 'hb_size' ||
        lower === 'hb_source' ||
        lower === 'hb_format' ||
        lower === 'hb_deal' ||
        lower === 'hb_cache_host' ||
        lower === 'hb_uuid' ||
        lower === 'hb_env' ||
        lower === 'hb_tmax' ||
        lower.startsWith('hb_')
      ) {
        prebidKeys.push(key);
        return;
      }

      // Amazon Publisher Services / TAM / UAM
      if (
        lower.startsWith('amzn') ||
        lower.startsWith('amazon')
      ) {
        amazonKeys.push(key);
        return;
      }

      // Additional common custom HB naming
      if (
        lower === 'prebid' ||
        lower === 'prebid_bidder' ||
        lower === 'headerbid' ||
        lower === 'header_bidding'
      ) {
        otherHbKeys.push(key);
      }
    });

    const engines = [];

    if (prebidKeys.length) {
      engines.push('Prebid');
    }

    if (amazonKeys.length) {
      engines.push('Amazon');
    }

    if (otherHbKeys.length) {
      engines.push('HB');
    }

    const allKeys = [
      ...prebidKeys,
      ...amazonKeys,
      ...otherHbKeys
    ];

    return {
      active: allKeys.length > 0,
      engines,
      keys: allKeys,
      prebidKeys,
      amazonKeys,
      otherHbKeys
    };
  }

  function detectPageHB() {
    const prebid = !!(
      window.pbjs &&
      (
        Array.isArray(window.pbjs.que) ||
        typeof window.pbjs.getBidResponses === 'function' ||
        typeof window.pbjs.requestBids === 'function'
      )
    );

    const amazon = !!(
      window.apstag &&
      (
        typeof window.apstag.fetchBids === 'function' ||
        typeof window.apstag.setDisplayBids === 'function' ||
        Array.isArray(window.apstag._Q)
      )
    );

    return {
      prebid,
      amazon,
      any: prebid || amazon
    };
  }

  function hbBadgeHTML(hb) {
    if (hb?.active) {
      const label = hb.engines?.length
        ? hb.engines.join(' + ')
        : 'HB';

      return `
        <span
          title="${esc(
            hb.keys?.length
              ? `Detected targeting: ${hb.keys.join(', ')}`
              : 'Header bidding detected'
          )}"
          style="
            display:inline-block;
            padding:2px 6px;
            border-radius:5px;
            background:#dff5e5;
            border:1px solid #83c996;
            color:#176b2c;
            font-weight:700;
            white-space:nowrap;
          "
        >
          HB ✓
          <span style="font-weight:400">
            ${esc(label)}
          </span>
        </span>
      `;
    }

    return `
      <span
        title="No HB targeting detected on this GAM slot"
        style="
          display:inline-block;
          padding:2px 6px;
          border-radius:5px;
          background:#ffe1e1;
          border:1px solid #e49a9a;
          color:#a31d1d;
          font-weight:700;
          white-space:nowrap;
        "
      >
        HB ✕
      </span>
    `;
  }

  // ---------- slot badge + overlay on physical slot

  function addBadge(el, num) {
    if (!el) return;

    const old = el.querySelector?.('.qai-slot-badge');

    if (old) {
      old.remove();
    }

    ensurePositioned(el);

    const b = document.createElement('div');

    b.className = 'qai-slot-badge';
    b.textContent = String(num);

    b.style.cssText = [
      'position:absolute',
      'right:3px',
      'bottom:2px',
      'background:#5b3d8a',
      'color:#fff',
      'font-size:11px',
      'font-weight:bold',
      'border-radius:50%',
      'width:16px',
      'height:16px',
      'text-align:center',
      'line-height:16px',
      'opacity:0.9',
      'box-shadow:0 0 2px rgba(0,0,0,0.3)',
      'pointer-events:none',
      'z-index:2147483647'
    ].join(';');

    const r = rectSize(el);

    if (r.h && r.h < 50) {
      b.style.bottom = '6px';
    }

    el.appendChild(b);
  }

  function addSlotOverlay(el, num, lines) {
    if (!el) return;

    const old = el.querySelector?.('.qai-slot-overlay');

    if (old) {
      old.remove();
    }

    ensurePositioned(el);

    const o = document.createElement('div');

    o.className = 'qai-slot-overlay';

    o.style.cssText = [
      'position:absolute',
      'left:3px',
      'bottom:2px',
      'max-width:70%',
      'background:rgba(255, 235, 175, 0.6)',
      'backdrop-filter:blur(6px)',
      '-webkit-backdrop-filter:blur(6px)',
      'border:1px solid rgba(91,61,138,0.25)',
      'border-radius:8px',
      'padding:4px 6px',
      'font:11px Arial,sans-serif',
      'color:#2b1e45',
      'box-shadow:0 2px 8px rgba(0,0,0,0.15)',
      'pointer-events:none',
      'z-index:2147483647',
      'white-space:nowrap',
      'overflow:hidden',
      'text-overflow:ellipsis'
    ].join(';');

    const safeLines = (lines || []).map(esc);

    o.innerHTML = `<b>#${num}</b> ${safeLines.join('<br>')}`;

    const r = rectSize(el);

    if (r.h && r.h < 70) {
      o.style.bottom = '24px';
    }

    el.appendChild(o);
  }

  // ---------- styles

  const qaiStyle = document.createElement('style');

  qaiStyle.textContent = `
    #qai-panel {
      width: 560px;
      max-height: 52vh;
      overflow: hidden;
    }

    #qai-body {
      display:flex;
      flex-direction:column;
      gap:8px;
      max-height:calc(52vh - 44px);
    }

    #qai-top {
      flex:0 0 auto;
      max-height:22vh;
      overflow:auto;
      padding-right:4px;
    }

    #qai-panels {
      flex:1 1 auto;
      overflow:auto !important;
      max-height:none !important;
      padding-right:4px;
    }

    #qai-panel .qai-table {
      border-collapse:collapse;
      margin-top:4px;
      font-size:11px;
      width:100%;
    }

    #qai-panel .qai-table thead tr {
      background:rgba(233,221,255,0.35) !important;
      backdrop-filter:blur(4px);
      -webkit-backdrop-filter:blur(4px);
    }

    #qai-panel .qai-table th {
      background:rgba(233,221,255,0.25);
    }

    #qai-panel .qai-table td {
      background:rgba(245,240,255,0.18);
    }

    #qai-panel .qai-table td,
    #qai-panel .qai-table th {
      border:1px solid rgba(209,196,255,0.55) !important;
    }

    #qai-panel .qai-det {
      position:relative;
      margin:6px 0;
      border:1px dashed rgba(215,202,255,0.6);
      border-radius:8px;
      padding:8px 8px 24px;
      background:rgba(245,240,255,0.25);
      backdrop-filter:blur(6px);
      -webkit-backdrop-filter:blur(6px);
    }

    #qai-panel .qai-sum {
      cursor:pointer;
      font-weight:600;
      background:rgba(233,221,255,0.22);
      padding:4px 6px;
      border-radius:6px;
    }

    #qai-panel .qai-mismatch {
      background:rgba(255,120,120,0.22) !important;
    }
  `;

  document.head.appendChild(qaiStyle);

  // ---------- state

  const S = {
    lastScan: 0,
    showPH: false,
    adsense: [],
    gam: [],
    hbPage: {
      prebid: false,
      amazon: false,
      any: false
    },
    collapsed: false
  };

  // ---------- scanners

  function scanAdsense() {
    const list = Array.from(
      document.querySelectorAll('ins.adsbygoogle')
    );

    return list.map((el, i) => {
      if (!el.id) {
        el.id = `qai-adsense-${i + 1}`;
      }

      const client =
        el.getAttribute('data-ad-client') ||
        window.google_ad_client ||
        '';

      const slot =
        el.getAttribute('data-ad-slot') ||
        '';

      const ds = declaredSize(el);
      const rc = rectSize(el);

      const cs = `${rc.w}x${rc.h}`;

      const format =
        el.getAttribute('data-ad-format') ||
        '';

      const isPlaceholder =
        !client &&
        !slot &&
        ds === '' &&
        (rc.w === 0 || rc.h === 0);

      const isUninitialized =
        !client &&
        !slot &&
        !isPlaceholder;

      return {
        elementId: el.id,
        domIndex: i,
        client,
        slot,
        declared: ds,
        computed: cs,
        format,
        state: isPlaceholder
          ? 'placeholder'
          : (
              isUninitialized
                ? 'uninitialized'
                : 'normal'
            )
      };
    });
  }

  function scanGAM() {
    try {
      if (!(window.googletag?.pubads)) {
        return [];
      }

      const slots =
        window.googletag.pubads().getSlots?.() ||
        [];

      return slots.map(s => {
        let sizesArr = [];

        try {
          const arr = s.getSizes?.() || [];

          sizesArr = arr
            .map(o => {
              if (o?.getWidth) {
                return `${o.getWidth()}x${o.getHeight()}`;
              }

              if (o?.w && o?.h) {
                return `${o.w}x${o.h}`;
              }

              return '';
            })
            .filter(Boolean);
        } catch {}

        sizesArr = Array.from(
          new Set(sizesArr)
        );

        let targeting = {};

        try {
          const keys =
            s.getTargetingKeys?.() ||
            [];

          keys.forEach(k => {
            targeting[k] =
              s.getTargeting?.(k) ||
              [];
          });
        } catch {}

        const hb = detectHB(targeting);

        return {
          adUnitPath:
            s.getAdUnitPath?.() ||
            '',

          slotElementId:
            s.getSlotElementId?.() ||
            '',

          sizesArr,

          sizesStr:
            sizesArr.join('|'),

          targeting,

          hb
        };
      });
    } catch {
      return [];
    }
  }

  function rescan() {
    S.adsense = scanAdsense();
    S.gam = scanGAM();
    S.hbPage = detectPageHB();
    S.lastScan = Date.now();
  }

  // ---------- UI panel

  const panel = document.createElement('div');

  panel.id = 'qai-panel';

  panel.style = [
    'position:fixed',
    'right:10px',
    'top:10px',
    'z-index:2147483646',
    'background:rgba(245,240,255,0.25)',
    'backdrop-filter:blur(6px)',
    '-webkit-backdrop-filter:blur(6px)',
    'border:1px solid rgba(91,61,138,0.35)',
    'padding:10px',
    'font:12px Arial,sans-serif',
    'box-shadow:0 6px 18px rgba(0,0,0,.25)',
    'border-radius:10px'
  ].join(';');

  panel.innerHTML = `
    <div
      style="
        display:flex;
        gap:8px;
        align-items:center;
        flex-wrap:wrap
      "
    >
      <b
        style="
          font-size:13px;
          user-select:none
        "
        id="qai-title"
      >
        Ad Inspector
      </b>

      <button id="qai-r">
        Refresh
      </button>

      <button id="qai-ph">
        Show placeholders
      </button>

      <button id="qai-min">
        Minimize
      </button>

      <span
        style="
          margin-left:auto;
          color:#4b3a6b
        "
        id="qai-meta"
      ></span>
    </div>

    <div id="qai-body">

      <div
        id="qai-head"
        style="margin-top:8px"
      ></div>

      <div id="qai-top">
        <div id="qai-slots"></div>
      </div>

      <div id="qai-panels"></div>

    </div>
  `;

  document.documentElement.appendChild(panel);

  const icon = document.createElement('div');

  icon.id = 'qai-collapsed';
  icon.textContent = 'Ad';
  icon.title = 'Open Ad Inspector';

  icon.style = [
    'position:fixed',
    'right:10px',
    'top:10px',
    'width:34px',
    'height:34px',
    'border-radius:50%',
    'background:#5b3d8a',
    'color:#fff',
    'display:none',
    'align-items:center',
    'justify-content:center',
    'font:12px Arial,sans-serif',
    'z-index:2147483647',
    'box-shadow:0 6px 18px rgba(0,0,0,.25)',
    'cursor:pointer',
    'user-select:none'
  ].join(';');

  document.documentElement.appendChild(icon);

  function visibleAdsense() {
    return S.showPH
      ? S.adsense
      : S.adsense.filter(
          s => s.state !== 'placeholder'
        );
  }

  function renderHead() {
    const Aall = S.adsense;
    const A = visibleAdsense();

    const ph =
      Aall.length -
      A.length;

    const G =
      S.gam.length;

    const hbSlots =
      S.gam.filter(g => g.hb?.active).length;

    const pageEngines = [];

    if (S.hbPage.prebid) {
      pageEngines.push('Prebid');
    }

    if (S.hbPage.amazon) {
      pageEngines.push('Amazon');
    }

    let hbPageHtml = '';

    if (S.hbPage.any) {
      hbPageHtml = `
        <span
          style="
            margin-left:6px;
            color:#176b2c;
            font-weight:600
          "
        >
          HB library: ${esc(pageEngines.join(' + '))}
        </span>
      `;
    }

    document.getElementById('qai-head').innerHTML = `
      <div>
        AdSense slots:
        <b>${A.length}</b>

        ${
          ph
            ? ` (+${ph} placeholders hidden)`
            : ''
        }

        |

        GAM slots:
        <b>${G}</b>

        |

        HB:
        <b>${hbSlots}/${G}</b>

        ${hbPageHtml}
      </div>

      <div
        style="
          color:#4b3a6b;
          font-size:11px
        "
      >
        Last scan:
        ${new Date(S.lastScan).toLocaleTimeString()}
      </div>
    `;

    document.getElementById('qai-ph').textContent =
      S.showPH
        ? 'Hide placeholders'
        : 'Show placeholders';
  }

  function renderTables() {
    const wrap =
      document.getElementById('qai-slots');

    const A =
      visibleAdsense();

    const base =
      A.length;

    let html = '';

    // ---------- AdSense table

    if (A.length) {
      html += `
        <div
          style="
            margin-top:6px;
            font-weight:600
          "
        >
          AdSense slot details
        </div>
      `;

      html += `
        <table class="qai-table">

          <thead>
            <tr>
              <th style="text-align:left;padding:4px 6px">#</th>
              <th style="text-align:left;padding:4px 6px">Publisher ID</th>
              <th style="text-align:left;padding:4px 6px">Slot ID</th>
              <th style="text-align:left;padding:4px 6px">Declared size</th>
              <th style="text-align:left;padding:4px 6px">Computed size</th>
              <th style="text-align:left;padding:4px 6px">Format</th>
              <th style="text-align:left;padding:4px 6px">Element ID</th>
              <th style="text-align:left;padding:4px 6px">State</th>
            </tr>
          </thead>

          <tbody>
      `;

      A.forEach((s, i) => {
        const mismatch =
          s.declared &&
          s.declared !== 'auto' &&
          s.computed &&
          s.declared !== s.computed;

        html += `
          <tr>

            <td style="padding:3px 6px">
              ${i + 1}
            </td>

            <td style="padding:3px 6px">
              ${esc(s.client)}
            </td>

            <td style="padding:3px 6px">
              ${esc(s.slot)}
            </td>

            <td style="padding:3px 6px">
              ${esc(s.declared)}
            </td>

            <td
              class="${mismatch ? 'qai-mismatch' : ''}"
              style="padding:3px 6px"
            >
              ${esc(s.computed)}
            </td>

            <td style="padding:3px 6px">
              ${esc(s.format)}
            </td>

            <td style="padding:3px 6px">
              ${esc(s.elementId)}
            </td>

            <td style="padding:3px 6px">
              ${esc(s.state)}
            </td>

          </tr>
        `;
      });

      html += `
          </tbody>
        </table>
      `;
    } else {
      html += `
        <div
          style="
            margin-top:6px;
            color:#6a5aa4
          "
        >
          AdSense slots: not detected
        </div>
      `;
    }

    // ---------- GAM table

    if (S.gam.length) {
      html += `
        <div
          style="
            margin-top:10px;
            font-weight:600
          "
        >
          GAM slot details
        </div>
      `;

      html += `
        <table class="qai-table">

          <thead>
            <tr>

              <th
                style="
                  text-align:left;
                  padding:4px 6px
                "
              >
                #
              </th>

              <th
                style="
                  text-align:left;
                  padding:4px 6px
                "
              >
                HB
              </th>

              <th
                style="
                  text-align:left;
                  padding:4px 6px
                "
              >
                AdUnitPath
              </th>

              <th
                style="
                  text-align:left;
                  padding:4px 6px
                "
              >
                SlotElementId
              </th>

              <th
                style="
                  text-align:left;
                  padding:4px 6px
                "
              >
                Sizes
              </th>

              <th
                style="
                  text-align:left;
                  padding:4px 6px
                "
              >
                Targeting
              </th>

            </tr>
          </thead>

          <tbody>
      `;

      S.gam.forEach((g, idx) => {
        const num =
          base +
          idx +
          1;

        const tgt =
          Object.keys(g.targeting || {})
            .slice(0, 20)
            .map(
              k =>
                `${esc(k)}=${esc(
                  (g.targeting[k] || []).join('|')
                )}`
            )
            .join('; ');

        html += `
          <tr>

            <td
              style="
                padding:3px 6px;
                white-space:nowrap
              "
            >
              ${num}
            </td>

            <td
              style="
                padding:3px 6px;
                white-space:nowrap
              "
            >
              ${hbBadgeHTML(g.hb)}
            </td>

            <td
              style="
                padding:3px 6px
              "
            >
              ${esc(g.adUnitPath)}
            </td>

            <td
              style="
                padding:3px 6px
              "
            >
              ${esc(g.slotElementId)}
            </td>

            <td
              style="
                padding:3px 6px
              "
            >
              ${esc(g.sizesStr)}
            </td>

            <td
              style="
                padding:3px 6px
              "
            >
              ${tgt}
            </td>

          </tr>
        `;
      });

      html += `
          </tbody>
        </table>
      `;
    }

    wrap.innerHTML = html;
  }

  function renderPanels() {
    const box =
      document.getElementById('qai-panels');

    box.innerHTML = '';

    const A =
      visibleAdsense();

    const base =
      A.length;

    if (A.length || S.gam.length) {
      const h =
        document.createElement('div');

      h.style =
        'margin-top:2px;font-weight:600';

      h.textContent =
        'Per-slot panels (scroll here)';

      box.appendChild(h);
    }

    const makeCornerBadge = num => {
      const b =
        document.createElement('div');

      b.textContent =
        num;

      b.style =
        'position:absolute;right:6px;bottom:6px;background:#5b3d8a;color:#fff;border-radius:12px;padding:2px 7px;font-size:12px;line-height:1;box-shadow:0 1px 3px rgba(0,0,0,.25)';

      return b;
    };

    // ---------- AdSense detail panels

    A.forEach((s, i) => {
      const num =
        i + 1;

      const det =
        document.createElement('details');

      det.className =
        'qai-det';

      const sum =
        document.createElement('summary');

      sum.className =
        'qai-sum';

      sum.innerHTML = `
        #${num}
        [AdSense]
        ${esc(s.client || '-')}
        /
        ${esc(s.slot || '-')}

        &nbsp;

        <button
          data-kind="adsense"
          data-el="${esc(s.elementId)}"
          data-idx="${s.domIndex}"
          class="qai-hl"
          style="margin-left:8px"
        >
          Highlight
        </button>
      `;

      const mismatch =
        s.declared &&
        s.declared !== 'auto' &&
        s.computed &&
        s.declared !== s.computed;

      const inner =
        document.createElement('div');

      inner.style =
        'margin-top:6px;font-size:11px';

      inner.innerHTML = `
        <div>
          Element ID:
          <b>${esc(s.elementId || '')}</b>
        </div>

        <div>
          State:
          <b>${esc(s.state)}</b>
        </div>

        <div>
          Declared:
          <b>${esc(s.declared || '')}</b>

          |

          Computed:
          <b class="${mismatch ? 'qai-mismatch' : ''}">
            ${esc(s.computed || '')}
          </b>

          |

          Format:
          <b>${esc(s.format || '')}</b>
        </div>
      `;

      det.appendChild(sum);
      det.appendChild(inner);
      det.appendChild(makeCornerBadge(num));

      box.appendChild(det);
    });

    // ---------- GAM detail panels

    S.gam.forEach((g, idx) => {
      const num =
        base +
        idx +
        1;

      const det =
        document.createElement('details');

      det.className =
        'qai-det';

      const sum =
        document.createElement('summary');

      sum.className =
        'qai-sum';

      sum.innerHTML = `
        #${num}
        [GAM]
        ${esc(g.adUnitPath || '-')}

        &nbsp;

        ${hbBadgeHTML(g.hb)}

        &nbsp;

        <button
          data-kind="gam"
          data-el="${esc(g.slotElementId)}"
          class="qai-hl"
          style="margin-left:8px"
        >
          Highlight
        </button>
      `;

      const inner =
        document.createElement('div');

      inner.style =
        'margin-top:6px;font-size:11px;white-space:pre-wrap';

      const tgt =
        Object.keys(g.targeting || {})
          .slice(0, 50)
          .map(
            k =>
              `${k} = ${(g.targeting[k] || []).join('|')}`
          )
          .join('\n');

      const hbKeys =
        g.hb?.keys?.length
          ? g.hb.keys
              .map(k => {
                const values =
                  g.targeting?.[k] || [];

                return `${k} = ${values.join('|')}`;
              })
              .join('\n')
          : '(none)';

      const hbEngine =
        g.hb?.engines?.length
          ? g.hb.engines.join(' + ')
          : 'none';

      inner.innerHTML = `
        <div>
          SlotElementId:
          <b>${esc(g.slotElementId || '')}</b>
        </div>

        <div>
          Sizes:
          <b>${esc(g.sizesStr || '')}</b>
        </div>

        <div style="margin-top:5px">
          HB:
          ${
            g.hb?.active
              ? '<b style="color:#176b2c">YES ✓</b>'
              : '<b style="color:#a31d1d">NO ✕</b>'
          }
        </div>

        <div>
          HB engine:
          <b>${esc(hbEngine)}</b>
        </div>

        <div style="margin-top:4px">
          <u>HB targeting</u>:
${esc(hbKeys)}
        </div>

        <div style="margin-top:6px">
          <u>All targeting</u>:
${esc(tgt || '(none)')}
        </div>
      `;

      det.appendChild(sum);
      det.appendChild(inner);
      det.appendChild(makeCornerBadge(num));

      box.appendChild(det);
    });

    // ---------- Highlight handlers

    box.querySelectorAll('.qai-hl').forEach(btn => {
      btn.onclick = e => {
        e.preventDefault();

        const kind =
          btn.getAttribute('data-kind');

        const elId =
          btn.getAttribute('data-el');

        let el =
          elId
            ? document.getElementById(elId)
            : null;

        if (!el && kind === 'adsense') {
          const idx =
            parseInt(
              btn.getAttribute('data-idx') || '-1',
              10
            );

          const list =
            document.querySelectorAll(
              'ins.adsbygoogle'
            );

          if (
            idx >= 0 &&
            list[idx]
          ) {
            el =
              list[idx];
          }
        }

        if (!el) {
          return;
        }

        el.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });

        const old =
          el.style.outline;

        el.style.outline =
          '3px solid #8a2be2';

        setTimeout(() => {
          el.style.outline = old;
        }, 1500);
      };
    });
  }

  function placeBadgesAndOverlays() {
    document
      .querySelectorAll('.qai-slot-badge')
      .forEach(n => n.remove());

    document
      .querySelectorAll('.qai-slot-overlay')
      .forEach(n => n.remove());

    const A =
      visibleAdsense();

    // ---------- AdSense overlays

    A.forEach((s, i) => {
      const num =
        i + 1;

      const el =
        document.getElementById(
          s.elementId
        );

      if (!el) {
        return;
      }

      addBadge(
        el,
        num
      );

      const lines = [
        `[AdSense] ${s.client || '-'} / ${s.slot || '-'}`,
        `Declared: ${s.declared || '-'} | Computed: ${s.computed || '-'}`
      ];

      addSlotOverlay(
        el,
        num,
        lines
      );
    });

    // ---------- GAM overlays

    S.gam.forEach((g, idx) => {
      const num =
        A.length +
        idx +
        1;

      if (!g.slotElementId) {
        return;
      }

      const el =
        document.getElementById(
          g.slotElementId
        );

      if (!el) {
        return;
      }

      addBadge(
        el,
        num
      );

      const hbText =
        g.hb?.active
          ? `HB: YES (${g.hb.engines.join(' + ') || 'detected'})`
          : 'HB: NO';

      const lines = [
        `[GAM] ${g.adUnitPath || '-'}`,
        `Sizes: ${g.sizesStr || '-'}`,
        hbText
      ];

      addSlotOverlay(
        el,
        num,
        lines
      );
    });
  }

  function renderAll() {
    if (S.collapsed) {
      return;
    }

    renderHead();
    renderTables();
    renderPanels();
    placeBadgesAndOverlays();
  }

  // ---------- collapse / expand

  function saveCollapsed() {
    try {
      localStorage.setItem(
        '__qai_collapsed',
        '1'
      );
    } catch {}
  }

  function saveExpanded() {
    try {
      localStorage.removeItem(
        '__qai_collapsed'
      );
    } catch {}
  }

  function collapse() {
    S.collapsed = true;

    panel.style.display =
      'none';

    icon.style.display =
      'flex';

    saveCollapsed();
  }

  function expand() {
    S.collapsed = false;

    icon.style.display =
      'none';

    panel.style.display =
      'block';

    saveExpanded();

    rescan();
    renderAll();
  }

  document.getElementById('qai-r').onclick = () => {
    rescan();
    renderAll();
  };

  document.getElementById('qai-ph').onclick = () => {
    S.showPH =
      !S.showPH;

    renderAll();
  };

  document.getElementById('qai-min').onclick =
    collapse;

  document.getElementById('qai-title').ondblclick =
    collapse;

  icon.onclick =
    expand;

  function init() {
    try {
      S.collapsed =
        !!localStorage.getItem(
          '__qai_collapsed'
        );
    } catch {}

    if (S.collapsed) {
      collapse();
    } else {
      icon.style.display =
        'none';

      panel.style.display =
        'block';
    }

    rescan();
    renderAll();

    window.addEventListener(
      'load',
      () => {
        setTimeout(() => {
          rescan();
          renderAll();
        }, 400);

        setTimeout(() => {
          rescan();
          renderAll();
        }, 1500);

        setTimeout(() => {
          rescan();
          renderAll();
        }, 3000);
      }
    );
  }

  init();
})();
